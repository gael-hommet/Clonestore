// src/lib/pierre/v1/signatures.ts
// PHASE 8.3-B3 — governed e-signature orchestration. Submits a final contract to a real
// provider (behind the provider-neutral contract), processes verified webhook events
// asynchronously, finalizes ONLY after the signed document + evidence are downloaded, scanned
// clean and integrity-checked, reconciles missed webhooks, and activates contracts/amendments.
// A provider "completed" NEVER signs the contract by itself.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";
import { assertContractTransition, emitContractEvent } from "./contract-state";
import { resolveSignatureProvider, signatureCapabilities } from "./signature-provider-config";
import { type SignatureProvider, SignatureProviderError, type SignatureLevel } from "./signature-provider";
import { resolveYousignSignerSecurity } from "./signature-security";
import { mapProviderEventToCanonical, requestStatusForEvent, contractStatusForEvent, eventRank, isTerminalEvent, statusRank, type CanonicalSignatureEvent } from "./signature-events";
import { createUploadIntent, finalizeUpload, type FileRow } from "./files";
import { getFileStorageProvider, type FileStorageProvider } from "./file-storage";
import { createVersion } from "./documents";
import { emitRuntimeEvent } from "./runtime-event-bus";
import { sha256 } from "./renderers";

export type SignatureDeps = { provider?: SignatureProvider; storage?: FileStorageProvider; scanner?: import("./file-scan").FileScanProvider; now?: string; __failpoint?: string };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SignatureEventKind =
  | "signature.provider_request_created" | "signature.document_uploaded" | "signature.recipient_created"
  | "signature.request_activated" | "signature.webhook_received" | "signature.event_applied"
  | "signature.recipient_signed" | "signature.completed" | "signature.declined" | "signature.expired"
  | "signature.cancelled" | "signature.failed" | "signature.reconciliation_started" | "signature.reconciliation_completed"
  | "signature.evidence_downloaded" | "signature.signed_document_stored";

/** B3.14 — stable signature audit/outbox event. Deterministic dedup; NEVER carries secrets,
 *  full payloads, document bytes, or unnecessary PII (only ids + status + hashes). */
async function emitSignatureEvent(db: SqlExecutor, ctx: TenantContext, kind: SignatureEventKind, data: { request_id: string; provider?: string; provider_request_id?: string | null; document_id?: string | null; status?: string | null; detail?: Record<string, string | number | null> }): Promise<void> {
  const payload = { signature_request_id: data.request_id, provider: data.provider ?? null, provider_request_id: data.provider_request_id ?? null, document_id: data.document_id ?? null, status: data.status ?? null, ...(data.detail ?? {}) };
  await db.query(`insert into pierre_rt_document_access_log (id, company_id, document_id, actor_user_id, action, detail) values ($1,$2,$3,$4,$5,$6)`,
    [newUuid(), ctx.company_id, data.document_id ?? null, ctx.user_id, kind, JSON.stringify({ signature_request_id: data.request_id, status: data.status ?? null })]);
  const dedup = [kind, data.request_id, data.provider_request_id ?? "_", data.status ?? "_"].join(":");
  await db.query(`insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key) values ($1,$2,$3,$4,$5) on conflict (company_id, dedup_key) do nothing`,
    [newUuid(), ctx.company_id, kind, JSON.stringify(payload), dedup]);
}

type SigRequestRow = {
  id: string; company_id: string; document_id: string; document_version_id: string; provider: string; provider_request_id: string | null;
  signature_level: string; status: string; approved_content_hash: string | null; idempotency_key: string | null;
  provider_status: string | null; signed_document_version_id: string | null; reconcile_status: string; retry_count: number;
  external_id: string | null; provider_document_id: string | null; provisioning_step: string | null;
};

// Split a display name into first/last for the provider's signer identity (R1.3). Deterministic.
function splitName(name: string): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Signataire", last: "CloneStore" };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

// Deterministic, documented signature-field placement on the LAST page (A4, 595×842pt, origin
// bottom-left). Employer signs left, employee right — fixed coordinates so two runs are identical
// (R1.3). The field references the real provider document id (never a guessed one).
function signatureFieldFor(role: string, providerDocumentId: string): { type: "signature"; document_id: string; page: number; x: number; y: number; width: number; height: number } {
  const employer = role === "employer" || role === "company" || role === "owner";
  return { type: "signature", document_id: providerDocumentId, page: 1, x: employer ? 70 : 320, y: 120, width: 180, height: 60 };
}
type RecipientRow = { id: string; email: string; name: string; role: string; signing_order: number; status: string; provider_recipient_id: string | null; phone_number: string | null };

// R2.1 — the per-signer requested authentication mode derived from the request signature level.
// SES → no_otp (no phone needed by default); AES → otp_sms; QES → none (omitted).
function requestedAuthModeForLevel(level: SignatureLevel): "no_otp" | "otp_sms" | null {
  if (level === "advanced_provider_managed") return "otp_sms";
  if (level === "qualified_provider_managed") return null;
  return "no_otp";
}

async function loadContract(db: SqlExecutor, ctx: TenantContext, id: string, forUpdate = false): Promise<{ id: string; workflow_status: string; document_id: string | null; parent_contract_id: string | null; contract_type: string }> {
  const { rows } = await db.query<{ id: string; workflow_status: string; document_id: string | null; parent_contract_id: string | null; contract_type: string }>(`select id, workflow_status, document_id, parent_contract_id, contract_type from pierre_rt_employee_contracts where company_id=$1 and id=$2${forUpdate ? " for update" : ""}`, [ctx.company_id, id]);
  if (rows.length === 0) throw Errors.notFound("Contract not found");
  return rows[0];
}
async function headVersion(db: SqlExecutor, ctx: TenantContext, contractId: string): Promise<{ id: string; document_version_id: string | null; canonical_hash: string | null; workflow_status: string }> {
  const { rows } = await db.query<{ id: string; document_version_id: string | null; canonical_hash: string | null; workflow_status: string }>(`select id, document_version_id, canonical_hash, workflow_status from pierre_rt_employee_contract_versions where company_id=$1 and contract_id=$2 order by version desc limit 1`, [ctx.company_id, contractId]);
  if (rows.length === 0) throw Errors.notFound("Contract has no version");
  return rows[0];
}
async function loadSigRequest(db: SqlExecutor, ctx: TenantContext, id: string, forUpdate = false): Promise<SigRequestRow> {
  const { rows } = await db.query<SigRequestRow>(`select * from pierre_rt_signature_requests where company_id=$1 and id=$2${forUpdate ? " for update" : ""}`, [ctx.company_id, id]);
  if (rows.length === 0) throw Errors.notFound("Signature request not found");
  return rows[0];
}
async function sigRequestForContract(db: SqlExecutor, ctx: TenantContext, contractId: string): Promise<SigRequestRow | null> {
  // the contract's current document version's request
  const v = await headVersion(db, ctx, contractId);
  if (!v.document_version_id) return null;
  const { rows } = await db.query<SigRequestRow>(`select * from pierre_rt_signature_requests where company_id=$1 and document_version_id=$2 order by created_at desc limit 1`, [ctx.company_id, v.document_version_id]);
  return rows[0] ?? null;
}

// ── B3.3/B3.4 — submit a ready contract to the provider (idempotent, resumable) ────
export type SubmitResult = { contract_id: string; signature_request_id: string; provider: string; provider_request_id: string; status: string; idempotent: boolean };

export async function submitContractToSignatureProvider(db: SqlExecutor, ctx: TenantContext, contractId: string, opts: { idempotency_key?: string } = {}, deps: SignatureDeps = {}): Promise<SubmitResult> {
  requirePermission(ctx, "document.approve");
  const provider = resolveSignatureProvider(deps.provider);
  const storage = deps.storage ?? getFileStorageProvider();

  const c = await loadContract(db, ctx, contractId);
  const sr = await sigRequestForContract(db, ctx, contractId);
  if (!sr) throw Errors.conflict("Contract has no prepared signature request");

  // idempotent FIRST: provisioning fully COMPLETED (activated) → return as-is. A request whose
  // provisioning crashed partway (provider_request_id set but provisioning_step < 'activated')
  // does NOT return here — it RESUMES below from its last persisted step (R1.5).
  if (sr.provider_request_id && sr.provisioning_step === "activated") {
    const pr = await provider.getRequest(sr.provider_request_id);
    return { contract_id: contractId, signature_request_id: sr.id, provider: provider.providerKey, provider_request_id: sr.provider_request_id, status: pr.status, idempotent: true };
  }
  if (!sr.provider_request_id && c.workflow_status !== "ready_for_signature") throw Errors.conflict(`Contract is not ready_for_signature (is ${c.workflow_status})`);

  // verify the final, clean artifact
  const dv = (await db.query<{ status: string; rendered_pdf_file_id: string | null }>(`select status, rendered_pdf_file_id from pierre_rt_document_versions where company_id=$1 and id=$2`, [ctx.company_id, sr.document_version_id])).rows[0];
  if (!dv || (dv.status !== "final" && dv.status !== "signed")) throw Errors.conflict("Underlying document version is not finalized");
  if (!dv.rendered_pdf_file_id) throw Errors.conflict("No rendered PDF for the contract");
  const file = (await db.query<{ object_key: string; upload_status: string; scan_status: string; sha256: string | null }>(`select object_key, upload_status, scan_status, sha256 from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, dv.rendered_pdf_file_id])).rows[0];
  if (!file || file.upload_status !== "clean" || file.scan_status !== "clean") throw Errors.conflict("Contract PDF is not clean");
  const recipients = (await db.query<RecipientRow>(`select id, email, name, role, signing_order, status, provider_recipient_id, phone_number from pierre_rt_signature_recipients where company_id=$1 and signature_request_id=$2 order by signing_order`, [ctx.company_id, sr.id])).rows;
  if (recipients.length === 0) throw Errors.conflict("No recipients to submit");
  for (const r of recipients) if (!EMAIL_RE.test(r.email)) throw Errors.validation(`Recipient ${r.role} has an invalid email`);

  const level = (sr.signature_level as SignatureLevel) ?? "simple";

  // R3.1 — PRE-FLIGHT the EXACT SES/AES/QES security for EVERY recipient BEFORE ANY provider HTTP.
  // If the required tier is infeasible (capability disabled, a required phone missing, an
  // unsupported combination), submission is REFUSED here — no request is created, no document is
  // uploaded, and the stronger requirement is NEVER silently executed as a weaker SES.
  const caps = signatureCapabilities();
  const requestedMode = requestedAuthModeForLevel(level);
  for (const r of recipients) {
    resolveYousignSignerSecurity({ signature_level: level, requested_authentication_mode: requestedMode, phone_number: r.phone_number, provider_capabilities: { aes_enabled: caps.aesEnabled, qes_enabled: caps.qesEnabled } });
  }

  const bytes = await storage.downloadBytes(file.object_key);
  // deterministic external_id — the official idempotency anchor (survives a timeout/retry).
  const externalId = sr.external_id ?? `clonestore:${ctx.company_id}:${sr.id}:${(file.sha256 ?? sha256(bytes)).slice(0, 16)}`;

  // 1. create the provider request (idempotent by external_id) and persist its id + external_id
  //    IMMEDIATELY so a timeout/retry resumes (via findRequestByIdempotencyKey) instead of
  //    creating a second request.
  // resume: reuse the already-created provider request (R1.5 — never re-create on resume).
  let providerRequestId: string;
  if (sr.provider_request_id) {
    providerRequestId = sr.provider_request_id;
  } else {
    try {
      const created = await provider.createRequest({ name: `Contrat ${contractId.slice(0, 8)}`, signature_level: level, external_id: externalId, ordered: true, correlation_id: ctx.correlation_id ?? null });
      providerRequestId = created.provider_request_id;
    } catch (e) {
      if (e instanceof SignatureProviderError && e.retriable && provider.findRequestByIdempotencyKey) {
        const found = await provider.findRequestByIdempotencyKey(externalId);
        if (found) providerRequestId = found.provider_request_id; else throw e;
      } else throw e;
    }
    await db.query(`update pierre_rt_signature_requests set provider_request_id=$3, provider=$4, provider_status='draft', provider_correlation_id=$5, external_id=$6, provisioning_step='provider_request_created', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, sr.id, providerRequestId, provider.providerKey, ctx.correlation_id ?? null, externalId]);
    await emitSignatureEvent(db, ctx, "signature.provider_request_created", { request_id: sr.id, provider: provider.providerKey, provider_request_id: providerRequestId, document_id: c.document_id });
  }

  // 2. upload the final document (multipart) and PERSIST the provider document id (R1.2) so a
  //    resume never uploads a second document.
  let providerDocumentId = sr.provider_document_id;
  if (!providerDocumentId) {
    const docMeta = await provider.uploadDocument({ provider_request_id: providerRequestId, filename: `contract-${contractId.slice(0, 8)}.pdf`, bytes, content_hash: file.sha256 ?? sha256(bytes) });
    providerDocumentId = docMeta.provider_document_id;
    await db.query(`update pierre_rt_signature_requests set provider_document_id=$3, provider_payload_hash=$4, provisioning_step='document_uploaded', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, sr.id, providerDocumentId, docMeta.sha256]);
    await emitSignatureEvent(db, ctx, "signature.document_uploaded", { request_id: sr.id, provider: provider.providerKey, provider_request_id: providerRequestId, document_id: c.document_id, detail: { provider_document_id: providerDocumentId } });
  }

  // 3. add recipients with full identity + a REAL signature field (deterministic placement), in
  //    signing order. The SES/AES/QES security was already resolved fail-closed in the pre-flight
  //    above (no HTTP happens for an infeasible tier).
  for (const r of recipients) {
    if (r.provider_recipient_id) continue;
    const fields = [signatureFieldFor(r.role, providerDocumentId!)];
    const nm = splitName(r.name);
    const pr = await provider.addRecipient({ provider_request_id: providerRequestId, email: r.email, name: r.name, first_name: nm.first, last_name: nm.last, role: r.role, signing_order: r.signing_order, locale: "fr", signature_level: level, auth_method: requestedMode ?? undefined, phone_number: r.phone_number, provider_document_id: providerDocumentId!, fields });
    await db.query(`update pierre_rt_signature_recipients set provider_recipient_id=$3, status=$4 where company_id=$1 and id=$2`, [ctx.company_id, r.id, pr.provider_recipient_id, pr.status]);
    await emitSignatureEvent(db, ctx, "signature.recipient_created", { request_id: sr.id, provider: provider.providerKey, provider_request_id: providerRequestId, detail: { role: r.role, signing_order: r.signing_order } });
  }
  await db.query(`update pierre_rt_signature_requests set provisioning_step='recipients_created', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, sr.id]);
  const docMeta = { sha256: file.sha256 ?? sha256(bytes) };
  // 4. activate
  const activated = await provider.activateRequest({ provider_request_id: providerRequestId });

  // 5. persist + transition the contract to submitted (atomic)
  return db.transaction(async (tx) => {
    const lc = await loadContract(tx, ctx, contractId, true);
    assertContractTransition(lc.workflow_status, "submitted");
    await tx.query(`update pierre_rt_signature_requests set status='submitted', provider_status=$3, submitted_at=now(), provider_payload_hash=$4, provisioning_step='activated', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, sr.id, activated.status, docMeta.sha256]);
    await tx.query(`update pierre_rt_employee_contracts set workflow_status='submitted' where company_id=$1 and id=$2`, [ctx.company_id, contractId]);
    await emitSignatureEvent(tx, ctx, "signature.request_activated", { request_id: sr.id, provider: provider.providerKey, provider_request_id: providerRequestId, document_id: lc.document_id, status: activated.status });
    await emitContractEvent(tx, ctx, "contract.signature_prepared", { contract_id: contractId, status_before: lc.workflow_status, status_after: "submitted", reason: "request_activated" });
    return { contract_id: contractId, signature_request_id: sr.id, provider: provider.providerKey, provider_request_id: providerRequestId, status: activated.status, idempotent: false };
  });
}

// R3.1 — signature submission READINESS (non-throwing). Resolves the EXACT SES/AES/QES security
// for the prepared recipients without contacting any provider. Returns `blocked` when the required
// tier is infeasible in this environment (capability disabled, a required phone missing, …) so the
// product can surface "advanced signature not yet enabled" — NEVER downgrade to SES.
export type SignatureReadiness = { ready: boolean; provider_tier: string; blockers: string[] };
export async function evaluateContractSignatureReadiness(db: SqlExecutor, ctx: TenantContext, contractId: string): Promise<SignatureReadiness> {
  requirePermission(ctx, "document.read");
  const sr = await sigRequestForContract(db, ctx, contractId);
  if (!sr) return { ready: false, provider_tier: "none", blockers: ["no_signature_request"] };
  const level = (sr.signature_level as SignatureLevel) ?? "simple";
  const recipients = (await db.query<RecipientRow>(`select id, email, name, role, signing_order, status, provider_recipient_id, phone_number from pierre_rt_signature_recipients where company_id=$1 and signature_request_id=$2 order by signing_order`, [ctx.company_id, sr.id])).rows;
  const caps = signatureCapabilities();
  const requestedMode = requestedAuthModeForLevel(level);
  const blockers: string[] = [];
  for (const r of recipients) {
    try { resolveYousignSignerSecurity({ signature_level: level, requested_authentication_mode: requestedMode, phone_number: r.phone_number, provider_capabilities: { aes_enabled: caps.aesEnabled, qes_enabled: caps.qesEnabled } }); }
    catch (e) { blockers.push(`${r.role}:${(e as { code?: string }).code ?? "security_infeasible"}`); }
  }
  return { ready: blockers.length === 0, provider_tier: level, blockers };
}

// ── B3.5 — receive a public webhook: verify (provider) → resolve local id → governed ingest ──
// `db` MUST be the minimal-privilege webhook-ingress executor. The provider verifies the HMAC
// and parses the payload; the local request id is resolved through the governed resolver (the
// ingress role never reads business tables); ingestion is the B2F governed function.
export async function receiveSignatureWebhook(db: SqlExecutor, input: { provider: string; raw_body: string | Buffer; signature_header?: string | null; secret: string; issued_at_header?: string | null; providerInstance?: SignatureProvider }): Promise<{ status: string; canonical_enqueued: boolean }> {
  const provider = input.providerInstance ?? resolveSignatureProvider();
  // R1.9 — the issued-at header feeds the provider's anti-replay window (independent of any
  // optional timestamp inside the payload body).
  const verified = await provider.verifyWebhook({ raw_body: input.raw_body, signature_header: input.signature_header, secret: input.secret, issued_at_header: input.issued_at_header ?? null }); // throws on bad signature / replay
  const { ingestSignatureWebhook } = await import("./signature-webhooks");
  let localId: string | null = null;
  if (verified.provider_request_id) {
    const r = await db.query<{ signature_request_id: string }>(`select * from pierre_rt_resolve_signature_request($1,$2)`, [verified.provider, verified.provider_request_id]);
    localId = r.rows[0]?.signature_request_id ?? null;
  }
  const out = await ingestSignatureWebhook(db, {
    provider: verified.provider, event_id: verified.event_id, event_type: verified.event_type, raw_body: input.raw_body,
    signature_header: input.signature_header, secret: input.secret, signature_request_id: localId, event_time: verified.event_time,
  });
  return { status: out.status, canonical_enqueued: !!localId };
}

// ── B3.6/B3.7 — process pending webhook events (async worker), monotonic + idempotent ──
export type ProcessResult = { processed: number; applied: number; ignored: number; unknown: number; finalized: number };

export async function processPendingSignatureEvents(db: SqlExecutor, ctx: TenantContext, opts: { limit?: number; worker?: string; lease_seconds?: number } = {}, deps: SignatureDeps = {}): Promise<ProcessResult> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const worker = opts.worker ?? `worker:${newUuid().slice(0, 8)}`;
  const lease = Math.max(opts.lease_seconds ?? 60, 1);
  const res: ProcessResult = { processed: 0, applied: 0, ignored: 0, unknown: 0, finalized: 0 };
  // R1.10/R2.4 — atomically CLAIM a batch (FOR UPDATE SKIP LOCKED inside the governed function),
  // TENANT-BOUND to the SESSION tenant (the function reads app.current_company, not a free
  // p_company). A second concurrent worker claiming the same company gets a DISJOINT set (or
  // none); a worker can never claim another tenant's events. The claim commits (lease persisted).
  const events = await db.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
    return (await tx.query<{ id: string; signature_request_id: string; event_type: string; provider_event_time: string | null }>(
      `select id, signature_request_id, event_type, provider_event_time from pierre_rt_claim_signature_events($1,$2,$3,$4) order by occurred_at asc`,
      [ctx.company_id, limit, worker, lease])).rows;
  });
  for (const ev of events) {
    res.processed += 1;
    try {
      const outcome = await applyOneEvent(db, ctx, ev.id, ev.signature_request_id, ev.event_type, deps);
      res[outcome.kind] += 1;
      if (outcome.finalized) res.finalized += 1;
      // release the lease: the event is terminally applied (application_status already set).
      await db.query(`update pierre_rt_signature_events set processing_status='done', locked_at=null, locked_by=null, lease_expires_at=null where company_id=$1 and id=$2`, [ctx.company_id, ev.id]);
    } catch (e) {
      // leave application_status='pending' and release the lease so a later worker can retry it.
      await db.query(`update pierre_rt_signature_events set processing_status='pending', locked_at=null, locked_by=null, lease_expires_at=null where company_id=$1 and id=$2`, [ctx.company_id, ev.id]);
      throw e;
    }
  }
  return res;
}

async function applyOneEvent(db: SqlExecutor, ctx: TenantContext, eventId: string, requestId: string, providerEventType: string, deps: SignatureDeps): Promise<{ kind: "applied" | "ignored" | "unknown"; finalized?: boolean }> {
  const sr = await loadSigRequest(db, ctx, requestId);
  const canonical = mapProviderEventToCanonical(sr.provider, providerEventType);
  if (!canonical) {
    await db.query(`update pierre_rt_signature_events set application_status='unknown', canonical_event=null, applied_at=now() where company_id=$1 and id=$2`, [ctx.company_id, eventId]);
    return { kind: "unknown" };
  }
  const incomingRank = eventRank(canonical);
  const reqStatus = requestStatusForEvent(canonical);
  // monotonic guard: if the request already reached a status >= this event's rank, ignore (no regression)
  if (reqStatus && statusRank(sr.status) > incomingRank && !(canonical === "request.completed")) {
    await db.query(`update pierre_rt_signature_events set application_status='ignored', canonical_event=$3, event_rank=$4, applied_at=now() where company_id=$1 and id=$2`, [ctx.company_id, eventId, canonical, incomingRank]);
    return { kind: "ignored" };
  }
  // a terminal that conflicts with an already-terminal different state → conflict (declined after signed)
  if (isTerminalEvent(canonical) && (sr.status === "completed" || sr.signed_document_version_id) && canonical !== "request.completed") {
    await db.query(`update pierre_rt_signature_events set application_status='ignored', canonical_event=$3, event_rank=$4, applied_at=now() where company_id=$1 and id=$2`, [ctx.company_id, eventId, canonical, incomingRank]);
    return { kind: "ignored" };
  }

  let finalized = false;
  await db.transaction(async (tx) => {
    const lsr = await loadSigRequest(tx, ctx, requestId, true);
    if (canonical === "request.completed") {
      // do NOT sign here — only mark provider-completed; finalization downloads doc+evidence.
      await tx.query(`update pierre_rt_signature_requests set provider_status='done', last_provider_event_at=now(), updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, requestId]);
    } else if (reqStatus) {
      // forward-only request status + contract status
      if (statusRank(reqStatus) >= statusRank(lsr.status)) {
        await tx.query(`update pierre_rt_signature_requests set status=$3, provider_status=$3, last_provider_event_at=now(), updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, requestId, reqStatus]);
        const cs = contractStatusForEvent(canonical);
        if (cs) await applyContractStatus(tx, ctx, requestId, cs);
        // P8.5-FINAL §4 — a NON-completed terminal transition (declined/expired/cancelled/failed) emits a
        // RECORD-ONLY durable runtime event (resolve=null): it is observable by the runtime/operator but
        // NEVER auto-resumes the signature wait (which only resolves on a real completion).
        if (["declined", "expired", "cancelled", "failed"].includes(reqStatus)) {
          await emitRuntimeEvent(tx, ctx, {
            source: "p83_signature",
            event_key: `sig:${requestId}:${reqStatus}`,
            kind: `signature.${reqStatus}`,
            object_type: "signature_request",
            object_id: requestId,
            payload_hash: sha256(Buffer.from(`sig:${requestId}:${reqStatus}`)),
            resolve: null,
          });
        }
      }
    }
    await tx.query(`update pierre_rt_signature_events set application_status='applied', canonical_event=$3, event_rank=$4, applied_at=now() where company_id=$1 and id=$2`, [ctx.company_id, eventId, canonical, incomingRank]);
  });

  // completed → run governed finalization (download signed doc + evidence). Failure leaves the
  // contract unsigned and flags reconciliation; it NEVER signs without the artifacts.
  if (canonical === "request.completed") {
    try { await finalizeSignedContract(db, ctx, requestId, deps); finalized = true; }
    catch { await db.query(`update pierre_rt_signature_requests set reconcile_status='needs_finalization', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, requestId]); }
  }
  return { kind: "applied", finalized };
}

async function applyContractStatus(tx: SqlExecutor, ctx: TenantContext, requestId: string, contractStatus: string): Promise<void> {
  const sr = await loadSigRequest(tx, ctx, requestId);
  const cv = (await tx.query<{ id: string; contract_id: string; workflow_status: string }>(`select id, contract_id, workflow_status from pierre_rt_employee_contract_versions where company_id=$1 and document_version_id=$2 order by version desc limit 1`, [ctx.company_id, sr.document_version_id])).rows[0];
  if (!cv) return;
  const c = (await tx.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contracts where company_id=$1 and id=$2 for update`, [ctx.company_id, cv.contract_id])).rows[0];
  if (!c) return;
  if (c.workflow_status === contractStatus) return;
  // only apply if the transition is legal (forward); illegal/out-of-order is skipped.
  try { assertContractTransition(c.workflow_status, contractStatus); } catch { return; }
  await tx.query(`update pierre_rt_employee_contracts set workflow_status=$3 where company_id=$1 and id=$2`, [ctx.company_id, cv.contract_id, contractStatus]);
  await emitContractEvent(tx, ctx, contractStatus === "declined" ? "contract.generation_blocked" : "contract.signature_prepared", { contract_id: cv.contract_id, status_before: c.workflow_status, status_after: contractStatus, reason: `provider_${contractStatus}` });
}

// ── B3.8/B3.9 — finalize: download signed doc + evidence, store, scan, mark signed ──
export async function finalizeSignedContract(db: SqlExecutor, ctx: TenantContext, requestId: string, deps: SignatureDeps = {}): Promise<{ signature_request_id: string; signed_document_version_id: string; evidence_count: number }> {
  const provider = resolveSignatureProvider(deps.provider);
  const sr = await loadSigRequest(db, ctx, requestId);
  if (sr.signed_document_version_id) {
    // idempotent: already finalized
    const ev = (await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_signature_evidence where company_id=$1 and signature_request_id=$2`, [ctx.company_id, requestId])).rows[0].n;
    return { signature_request_id: requestId, signed_document_version_id: sr.signed_document_version_id, evidence_count: ev };
  }
  if (!sr.provider_request_id) throw Errors.conflict("No provider request to finalize");

  // 1. reload provider state — ALL required recipients must be signed
  const pr = await provider.getRequest(sr.provider_request_id);
  if (pr.status !== "done") throw Errors.conflict(`Provider request not done (is ${pr.status})`);
  const providerRecipients = await provider.listRecipients(sr.provider_request_id);
  if (providerRecipients.length === 0 || !providerRecipients.every((r) => r.status === "signed")) throw Errors.conflict("Not all recipients have signed");

  // 2. download the signed document (version=completed) + evidence
  const signedBytes = await provider.downloadSignedDocument(sr.provider_request_id);
  if (!signedBytes || signedBytes.length === 0) throw Errors.conflict("Signed document is empty");
  const evidence = await provider.downloadEvidence(sr.provider_request_id);
  if (evidence.length === 0) throw Errors.conflict("No evidence retrieved");

  // 2b. REAL integrity verification (R1.11) BEFORE storing anything — recompute hashes, confirm
  // the artifacts belong to this request and the document is a true PDF. Refuses (throws) on any lie.
  assertSignedIntegrity({ sr, pr: pr as { provider_request_id?: string | null; status: string }, signedBytes, recipients: providerRecipients as Array<{ status: string; provider_request_id?: string | null }>, evidence: evidence as Array<{ type: string; bytes: Buffer; sha256: string; mime: string; provider_request_id?: string | null }> });

  // 3. store + scan the signed document (must be clean) and the evidence files. Track every stored
  // object so a later failure compensates (deletes) them instead of leaving an orphan (R1.12).
  const storage = deps.storage ?? getFileStorageProvider();
  const stored: Array<{ file_id: string; object_key: string }> = [];
  try {
    const signedStored = await storeAndScan(db, ctx, signedBytes, `signed-${requestId.slice(0, 8)}.pdf`, "application/pdf", deps);
    stored.push({ file_id: signedStored.file.id, object_key: signedStored.object_key });
    const signedFile = signedStored.file;
    if (signedFile.upload_status !== "clean" || signedFile.scan_status !== "clean") {
      await db.query(`update pierre_rt_signature_requests set reconcile_status='signed_doc_unclean', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, requestId]);
      throw Errors.conflict("Signed document failed the clean gate");
    }
    failpoint(deps, "after_signed_store");
    const evidenceFiles: Array<{ artifact: typeof evidence[number]; file: FileRow }> = [];
    for (const a of evidence) {
      // the canonical signed document is `signedFile` (downloaded via version=completed and linked
      // to the request's signed document version). The provider's evidence bundle MAY also carry a
      // redundant signed_document copy — skip it (it would be an unlinked duplicate of the same bytes).
      if (a.type === "signed_document") continue;
      const f = await storeAndScan(db, ctx, a.bytes, a.filename, a.mime, deps);
      stored.push({ file_id: f.file.id, object_key: f.object_key });
      if (f.file.upload_status !== "clean" || f.file.scan_status !== "clean") throw Errors.conflict(`Evidence ${a.type} failed the clean gate`);
      evidenceFiles.push({ artifact: a, file: f.file });
    }
    failpoint(deps, "after_evidence_store");

    // 4. governed signed artifact + evidence + state, in one transaction
    return await db.transaction(async (tx) => {
      const lsr = await loadSigRequest(tx, ctx, requestId, true);
      if (lsr.signed_document_version_id) return { signature_request_id: requestId, signed_document_version_id: lsr.signed_document_version_id, evidence_count: evidenceFiles.length };
      const signedHash = sha256(signedBytes);
      // create a signed document version (new version of the SAME document) and mark it signed
      const dv = await createVersion(tx, ctx, lsr.document_id, { rendered_pdf_file_id: signedFile.id, content_hash: signedHash, change_summary: "signed artifact" });
      await tx.query(`update pierre_rt_document_versions set status='signed', signed_at=now() where company_id=$1 and id=$2`, [ctx.company_id, dv.id]);
      await tx.query(`update pierre_rt_documents set status='signed', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, lsr.document_id]);
      const beforeHash = lsr.approved_content_hash;
      const evidenceId = newUuid();
      // integrity is now PROVEN (assertSignedIntegrity above did not throw) → record it as true.
      await tx.query(
        `insert into pierre_rt_signature_evidence (id, company_id, signature_request_id, provider, provider_request_id, signature_level, content_hash_before, content_hash_signed, evidence_file_id, recipients, events, integrity_verified)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
         on conflict (signature_request_id) do nothing`,
        [evidenceId, ctx.company_id, requestId, lsr.provider, lsr.provider_request_id, lsr.signature_level, beforeHash, signedHash, evidenceFiles.find((e) => e.artifact.type === "audit_trail")?.file.id ?? evidenceFiles[0]?.file.id ?? null, JSON.stringify(providerRecipients.map((r) => ({ role: r.role, status: r.status }))), JSON.stringify(evidence.map((a) => ({ type: a.type, sha256: a.sha256 })))]);
      // R2.7/R3.3 — every evidence artifact is recorded ONLY through the GOVERNED function. It
      // requires a REAL file_id and DERIVES the verified truth (sha256/mime/size) from the actual
      // pierre_rt_files row — never from caller metadata — and verifies the file is clean, same
      // tenant, and linked to THIS request. The app role can't record a proof. Bind the tenant.
      await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
      await tx.query(`select * from pierre_rt_record_signature_evidence_artifact($1,$2,$3,$4,$5,$6,$7)`,
        [ctx.company_id, requestId, evidenceId, "signed_document", lsr.provider_document_id, signedFile.id, null]);
      for (const e of evidenceFiles) {
        await tx.query(`select * from pierre_rt_record_signature_evidence_artifact($1,$2,$3,$4,$5,$6,$7)`,
          [ctx.company_id, requestId, evidenceId, e.artifact.type, (e.artifact as { provider_artifact_id?: string | null }).provider_artifact_id ?? null, e.file.id, e.artifact.provider_timestamp ?? null]);
      }
      await tx.query(`update pierre_rt_signature_requests set status='completed', provider_status='done', completed_at=now(), signed_document_version_id=$3, reconcile_status='idle', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, requestId, dv.id]);
      await emitSignatureEvent(tx, ctx, "signature.evidence_downloaded", { request_id: requestId, provider: lsr.provider, provider_request_id: lsr.provider_request_id, document_id: lsr.document_id, detail: { evidence_count: evidenceFiles.length } });
      await emitSignatureEvent(tx, ctx, "signature.signed_document_stored", { request_id: requestId, document_id: lsr.document_id, status: "completed", detail: { signed_hash: signedHash.slice(0, 16) } });
      await emitSignatureEvent(tx, ctx, "signature.completed", { request_id: requestId, provider: lsr.provider, provider_request_id: lsr.provider_request_id, document_id: lsr.document_id, status: "completed" });
      // P8.5-FINAL §4 — the REAL P8.3 terminal transition emits a durable runtime event IN THIS
      // TRANSACTION (never a later poll of completed requests). It resumes the durable signature wait
      // bound to the real signature_request_id; the runtime never imports the provider adapter.
      await emitRuntimeEvent(tx, ctx, {
        source: "p83_signature",
        event_key: `sig:${requestId}:completed`,
        kind: "signature.completed",
        object_type: "signature_request",
        object_id: requestId,
        payload_hash: signedHash,
        provider_event_id: lsr.provider_request_id ?? null,
        resolve: { event_kind: "signature.completed", object_type: "signature_request", object_id: requestId },
      });
      failpoint(deps, "before_commit");

      // the contract version → signed; the contract → signed; signed_at
      const cv = (await tx.query<{ id: string; contract_id: string; workflow_status: string }>(`select id, contract_id, workflow_status from pierre_rt_employee_contract_versions where company_id=$1 and document_version_id=$2 order by version desc limit 1`, [ctx.company_id, lsr.document_version_id])).rows[0];
      if (cv) {
        const c = (await tx.query<{ workflow_status: string }>(`select workflow_status from pierre_rt_employee_contracts where company_id=$1 and id=$2 for update`, [ctx.company_id, cv.contract_id])).rows[0];
        // route through in_progress if needed (submitted → in_progress → signed)
        if (c && c.workflow_status === "submitted") { await tx.query(`update pierre_rt_employee_contracts set workflow_status='in_progress' where company_id=$1 and id=$2`, [ctx.company_id, cv.contract_id]); }
        if (cv.workflow_status === "final") await tx.query(`update pierre_rt_employee_contract_versions set workflow_status='signed', status='signed', signed_at=now() where company_id=$1 and id=$2`, [ctx.company_id, cv.id]);
        await tx.query(`update pierre_rt_employee_contracts set workflow_status='signed', signed_at=now() where company_id=$1 and id=$2`, [ctx.company_id, cv.contract_id]);
        await emitContractEvent(tx, ctx, "contract.finalized", { contract_id: cv.contract_id, version_id: cv.id, document_id: lsr.document_id, status_after: "signed", reason: "signature_completed" });
      }
      return { signature_request_id: requestId, signed_document_version_id: dv.id, evidence_count: evidenceFiles.length };
    });
  } catch (primaryError) {
    // R1.12 — compensation: a clean gate or a crash AFTER objects were stored must NOT leave an
    // orphan. The DB transaction already rolled back (no signed version, no contract.signed); now
    // delete the stored storage objects + file rows, audit the incident, and PRESERVE the primary
    // error. Compensation is best-effort and resilient even if a delete itself fails.
    let compensated = 0;
    for (const s of stored) {
      try { await storage.deleteObject(s.object_key); failpoint(deps, "during_compensation"); compensated += 1; } catch { /* resilient */ }
      try { await db.query(`delete from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, s.file_id]); } catch { /* FK-safe */ }
    }
    try {
      await db.query(`insert into pierre_rt_document_access_log (id, company_id, document_id, actor_user_id, action, detail) values ($1,$2,$3,$4,$5,$6)`,
        [newUuid(), ctx.company_id, sr.document_id, ctx.user_id, "signature.finalization_compensated", JSON.stringify({ signature_request_id: requestId, stored: stored.length, compensated, reason: primaryError instanceof Error ? primaryError.message.slice(0, 120) : "error" })]);
      await db.query(`update pierre_rt_signature_requests set reconcile_status='needs_finalization', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, requestId]);
    } catch { /* audit is best-effort */ }
    throw primaryError;
  }
}

async function storeAndScan(db: SqlExecutor, ctx: TenantContext, bytes: Buffer, filename: string, mime: string, deps: SignatureDeps): Promise<{ file: FileRow; object_key: string }> {
  const storage = deps.storage ?? getFileStorageProvider();
  const intent = await createUploadIntent(db, ctx, { declared_mime_type: mime, original_filename: filename, declared_sha256: sha256(bytes), declared_size_bytes: bytes.length }, deps);
  const key = (await db.query<{ object_key: string }>(`select object_key from pierre_rt_files where company_id=$1 and id=$2`, [ctx.company_id, intent.file_id])).rows[0].object_key;
  await storage.upload(key, bytes);
  const file = await finalizeUpload(db, ctx, intent.file_id, bytes, deps);
  return { file, object_key: key };
}

// R1.11 — REAL integrity verification. Recompute every hash, confirm the document is a true PDF,
// confirm the artifacts belong to THIS provider request (not another), and that the provider
// itself considers the request done. Throws (fail-closed) on the first lie — integrity_verified
// is NEVER set true by convention.
function assertSignedIntegrity(input: {
  sr: SigRequestRow; pr: { provider_request_id?: string | null; status: string }; signedBytes: Buffer;
  recipients: Array<{ status: string; provider_request_id?: string | null }>;
  evidence: Array<{ type: string; bytes: Buffer; sha256: string; mime: string; provider_request_id?: string | null }>;
}): void {
  const { sr, pr, signedBytes, recipients, evidence } = input;
  const isPdf = (b: Buffer) => b.length >= 5 && b.subarray(0, 5).toString("latin1") === "%PDF-";
  if (pr.status !== "done") throw Errors.conflict("integrity: provider does not consider the request done");
  if (pr.provider_request_id && sr.provider_request_id && pr.provider_request_id !== sr.provider_request_id) throw Errors.conflict("integrity: provider request id mismatch (evidence of another request)");
  if (!sr.approved_content_hash) throw Errors.conflict("integrity: no approved source hash to compare against");
  if (!signedBytes || signedBytes.length === 0) throw Errors.conflict("integrity: signed document is empty");
  if (!isPdf(signedBytes)) throw Errors.conflict("integrity: signed document is not a real PDF");
  if (recipients.length === 0 || !recipients.every((r) => r.status === "signed")) throw Errors.conflict("integrity: not every required signer has signed");
  for (const r of recipients) if (r.provider_request_id && sr.provider_request_id && r.provider_request_id !== sr.provider_request_id) throw Errors.conflict("integrity: a recipient belongs to another provider request");
  for (const a of evidence) {
    if (a.provider_request_id && sr.provider_request_id && a.provider_request_id !== sr.provider_request_id) throw Errors.conflict(`integrity: evidence ${a.type} belongs to another provider request`);
    const recomputed = sha256(a.bytes);
    if (recomputed !== a.sha256) throw Errors.conflict(`integrity: evidence ${a.type} hash does not match its bytes (lying hash)`);
    if (a.mime === "application/pdf" && !isPdf(a.bytes)) throw Errors.conflict(`integrity: evidence ${a.type} is declared PDF but is not a real PDF`);
  }
}

function failpoint(deps: SignatureDeps, point: string): void {
  if (deps.__failpoint === point) throw new Error(`__failpoint:${point}`);
}

// ── B3.11 — reconciliation (missed webhooks). Never creates a new provider request. ──
export type ReconcileResult = { scanned: number; advanced: number; finalized: number; dead_lettered: number };
const MAX_RECONCILE_RETRIES = 5;

export async function reconcileSignatureRequests(db: SqlExecutor, ctx: TenantContext, opts: { limit?: number } = {}, deps: SignatureDeps = {}): Promise<ReconcileResult> {
  // P16E §17 (F19) — reconciliation ADVANCES signature requests and FINALIZES signed contracts
  // (finalizeSignedContract below). It is a sensitive document operation and must require the
  // same permission as finalize/approve — the route enforced entitlement but NO RBAC permission,
  // so an entitled read-only viewer could drive signature finalization. Fail-closed here.
  requirePermission(ctx, "document.approve");
  const provider = resolveSignatureProvider(deps.provider);
  const limit = Math.min(opts.limit ?? 25, 100);
  const res: ReconcileResult = { scanned: 0, advanced: 0, finalized: 0, dead_lettered: 0 };
  const open = (await db.query<SigRequestRow>(
    `select * from pierre_rt_signature_requests where company_id=$1 and status in ('submitted','in_progress') and provider_request_id is not null and reconcile_status <> 'dead_letter' order by updated_at asc limit $2`, [ctx.company_id, limit])).rows;
  for (const sr of open) {
    res.scanned += 1;
    try {
      const pr = await provider.getRequest(sr.provider_request_id!);
      if (pr.status === "done") {
        try { await finalizeSignedContract(db, ctx, sr.id, deps); res.finalized += 1; res.advanced += 1; }
        catch { await bumpRetry(db, ctx, sr); if (sr.retry_count + 1 >= MAX_RECONCILE_RETRIES) res.dead_lettered += 1; }
      } else if (["declined", "expired", "cancelled", "failed"].includes(pr.status)) {
        await applyTerminalFromReconcile(db, ctx, sr, pr.status); res.advanced += 1;
      } else {
        await db.query(`update pierre_rt_signature_requests set reconcile_status='idle', last_provider_event_at=now(), updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, sr.id]);
      }
    } catch { await bumpRetry(db, ctx, sr); if (sr.retry_count + 1 >= MAX_RECONCILE_RETRIES) res.dead_lettered += 1; }
  }
  return res;
}
async function bumpRetry(db: SqlExecutor, ctx: TenantContext, sr: SigRequestRow): Promise<void> {
  const next = sr.retry_count + 1;
  const dead = next >= MAX_RECONCILE_RETRIES;
  await db.query(`update pierre_rt_signature_requests set retry_count=$3, reconcile_status=$4, dead_letter_reason=$5, next_retry_at=now() + interval '5 minutes', updated_at=now() where company_id=$1 and id=$2`,
    [ctx.company_id, sr.id, next, dead ? "dead_letter" : "retry", dead ? "max_retries_exceeded" : null]);
}
async function applyTerminalFromReconcile(db: SqlExecutor, ctx: TenantContext, sr: SigRequestRow, status: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(`update pierre_rt_signature_requests set status=$3, provider_status=$3, reconcile_status='idle', updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, sr.id, status]);
    await applyContractStatus(tx, ctx, sr.id, status);
  });
}

// ── cancel + reads ─────────────────────────────────────────────────────────────────
export async function cancelContractSignature(db: SqlExecutor, ctx: TenantContext, contractId: string, deps: SignatureDeps = {}): Promise<void> {
  requirePermission(ctx, "document.approve");
  const provider = resolveSignatureProvider(deps.provider);
  const c = await loadContract(db, ctx, contractId);
  const sr = await sigRequestForContract(db, ctx, contractId);
  if (!sr) throw Errors.notFound("No signature request");
  if (sr.signed_document_version_id || sr.status === "completed") throw Errors.conflict("A completed signature cannot be cancelled");
  if (sr.provider_request_id) { try { await provider.cancelRequest({ provider_request_id: sr.provider_request_id, reason: "cancelled_by_tenant" }); } catch { /* best-effort */ } }
  await db.transaction(async (tx) => {
    const lc = await loadContract(tx, ctx, contractId, true);
    try { assertContractTransition(lc.workflow_status, "cancelled"); } catch { throw Errors.conflict(`Cannot cancel from ${lc.workflow_status}`); }
    await tx.query(`update pierre_rt_signature_requests set status='cancelled', cancelled_at=now(), updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, sr.id]);
    await tx.query(`update pierre_rt_employee_contracts set workflow_status='cancelled' where company_id=$1 and id=$2`, [ctx.company_id, contractId]);
    await emitContractEvent(tx, ctx, "contract.generation_blocked", { contract_id: contractId, status_before: lc.workflow_status, status_after: "cancelled", reason: "signature_cancelled" });
  });
}

export async function getContractSignature(db: SqlExecutor, ctx: TenantContext, contractId: string): Promise<{ contract_id: string; signature: SigRequestRow | null; recipients: RecipientRow[] }> {
  requirePermission(ctx, "document.read");
  await loadContract(db, ctx, contractId);
  const sr = await sigRequestForContract(db, ctx, contractId);
  const recipients = sr ? (await db.query<RecipientRow>(`select id, email, name, role, signing_order, status, provider_recipient_id, phone_number from pierre_rt_signature_recipients where company_id=$1 and signature_request_id=$2 order by signing_order`, [ctx.company_id, sr.id])).rows : [];
  return { contract_id: contractId, signature: sr, recipients };
}

export async function getSignatureEvidence(db: SqlExecutor, ctx: TenantContext, signatureRequestId: string): Promise<{ signature_request_id: string; evidence: Record<string, unknown> | null }> {
  requirePermission(ctx, "document.read");
  await loadSigRequest(db, ctx, signatureRequestId);
  const ev = (await db.query<Record<string, unknown>>(`select provider, provider_request_id, signature_level, content_hash_before, content_hash_signed, evidence_file_id, recipients, events, integrity_verified, retrieved_at from pierre_rt_signature_evidence where company_id=$1 and signature_request_id=$2`, [ctx.company_id, signatureRequestId])).rows[0] ?? null;
  return { signature_request_id: signatureRequestId, evidence: ev };
}

// ── B3.10 / R1.14 — REAL amendment activation. A past/now effective date applies the structured,
// allowlisted effects to the employee + records history/audit/outbox (idempotent, parent untouched,
// rollback on error). A future date persists a real scheduled task (execute_at) and applies NOTHING
// early; the activation worker (runDueContractActivations) applies it idempotently when due. ──

const ACTIVATION_MAX_ATTEMPTS = 3;
function dateStr(v: unknown): string { return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10); }
function previousEffectValue(field: string, emp: { role_title: string | null; site_id: string | null; metadata: Record<string, unknown> | null }): string | null {
  if (field === "employment.role_title") return emp.role_title ?? null;
  if (field === "employment.site_id") return emp.site_id ?? null;
  const active = (emp.metadata?.active_employment ?? null) as Record<string, unknown> | null;
  const v = active?.[field];
  return v === undefined || v === null ? null : String(v);
}

// Apply allowlisted structured effects to the employee record. role_title/site_id are real
// columns; weekly_hours/salary/effective_* are structured employment terms kept in metadata. An
// invalid site_id trips the FK → the transaction rolls back (fail-closed). Never touches the parent.
async function applyAmendmentEffectsToEmployee(tx: SqlExecutor, ctx: TenantContext, employeeId: string, effects: Record<string, string>): Promise<void> {
  if (effects["employment.role_title"] !== undefined) {
    await tx.query(`update pierre_rt_employees set role_title=$3, updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, employeeId, effects["employment.role_title"]]);
  }
  if (effects["employment.site_id"] !== undefined) {
    await tx.query(`update pierre_rt_employees set site_id=$3, updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, employeeId, effects["employment.site_id"]]); // FK validates the site
  }
  // structured employment terms (no dedicated column) persisted as queryable JSON, not free text.
  await tx.query(`update pierre_rt_employees set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('active_employment', $3::jsonb), updated_at=now() where company_id=$1 and id=$2`, [ctx.company_id, employeeId, JSON.stringify(effects)]);
}

// R2.11 — the ATOMIC amendment application: a single transaction that re-reads + re-verifies the
// parent + amendment signatures, applies the allowlisted effects, writes an APPEND-ONLY effect
// history row per change, transitions the task, and emits audit/trace/outbox. A throw anywhere
// (or an injected failpoint) rolls EVERYTHING back — no partial state. The parent is never touched.
async function applyAmendmentActivationAtomic(
  db: SqlExecutor, ctx: TenantContext,
  args: { amendmentId: string; eff: string; effects: Record<string, string>; taskId?: string | null; worker?: string | null; failpoint?: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
    const amd = await loadContract(tx, ctx, args.amendmentId, true);
    if (!amd.parent_contract_id) throw Errors.validation("Not an amendment");
    if (amd.workflow_status !== "signed") throw Errors.conflict("Amendment is not signed");
    const parent = await loadContract(tx, ctx, amd.parent_contract_id, true);
    if (parent.workflow_status !== "signed") throw Errors.conflict("Parent contract is not signed");
    const row = (await tx.query<{ employee_id: string }>(`select employee_id from pierre_rt_employee_contracts where company_id=$1 and id=$2`, [ctx.company_id, args.amendmentId])).rows[0];
    const emp = (await tx.query<{ role_title: string | null; site_id: string | null; metadata: Record<string, unknown> | null }>(`select role_title, site_id, metadata from pierre_rt_employees where company_id=$1 and id=$2`, [ctx.company_id, row.employee_id])).rows[0];

    // 1. apply the structured effects to the employee (parent untouched)
    await applyAmendmentEffectsToEmployee(tx, ctx, row.employee_id, args.effects);
    if (args.failpoint === "after_employee_update") throw new Error("__failpoint:after_employee_update");

    // 2. APPEND-ONLY effect history — one row per allowlisted changed field, with the previous
    //    value, written ONLY through the governed function (R3.5: the app role cannot forge it).
    if (args.failpoint === "before_history") throw new Error("__failpoint:before_history");
    for (const [field, value] of Object.entries(args.effects)) {
      await tx.query(
        `select pierre_rt_record_contract_effect($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [ctx.company_id, row.employee_id, amd.parent_contract_id, args.amendmentId, args.taskId ?? null, field, previousEffectValue(field, emp), value, args.eff, ctx.user_id, ctx.correlation_id ?? null]);
    }
    if (args.failpoint === "after_history") throw new Error("__failpoint:after_history");

    // 3. transition the activation task. A worker-claimed task is completed with WORKER OWNERSHIP
    //    (R3.4 — the lease must belong to this worker). The direct (taskless) path leaves any
    //    scheduled task for the worker to reconcile idempotently (it never owns a lease here).
    if (args.taskId) await tx.query(`select pierre_rt_complete_contract_activation($1,$2,$3)`, [ctx.company_id, args.taskId, args.worker ?? null]);

    // 4. audit + CloneTrace + outbox
    if (args.failpoint === "before_outbox") throw new Error("__failpoint:before_outbox");
    await emitContractEvent(tx, ctx, "contract.amendment_activated", { contract_id: args.amendmentId, status_after: "signed", reason: `effective_${args.eff}` });
  });
}

export async function activateSignedAmendment(db: SqlExecutor, ctx: TenantContext, amendmentContractId: string, opts: { as_of?: string; __failpoint?: string } = {}): Promise<{ activated: boolean; deferred_until: string | null; scheduled: boolean }> {
  requirePermission(ctx, "document.write");
  const { pickAllowedAmendmentEffects } = await import("./contracts");
  const asOf = (opts.as_of ?? (new Date().toISOString())).slice(0, 10);
  const c = await loadContract(db, ctx, amendmentContractId);
  if (!c.parent_contract_id) throw Errors.validation("Not an amendment");
  if (c.workflow_status !== "signed") throw Errors.conflict("Amendment is not signed");
  const row = (await db.query<{ employee_id: string; amendment_effects: Record<string, unknown> | null }>(`select employee_id, amendment_effects from pierre_rt_employee_contracts where company_id=$1 and id=$2`, [ctx.company_id, amendmentContractId])).rows[0];
  const effects = pickAllowedAmendmentEffects(row?.amendment_effects ?? {});
  const v = (await db.query<{ effective_from: string | null }>(`select effective_from from pierre_rt_employee_contract_versions where company_id=$1 and contract_id=$2 order by version desc limit 1`, [ctx.company_id, amendmentContractId])).rows[0];
  const effRaw = (effects["employment.effective_from"] ?? v?.effective_from) as unknown;
  const eff = effRaw ? dateStr(effRaw) : asOf;

  // idempotent: a recorded activation means it already applied — never apply twice.
  const already = (await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where company_id=$1 and contract_id=$2 and event='contract.amendment_activated'`, [ctx.company_id, amendmentContractId])).rows[0].n;
  if (already > 0) return { activated: true, deferred_until: null, scheduled: false };

  if (eff > asOf) {
    // future → GOVERNED scheduling (relational validation + idempotent). Nothing applied now.
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
      await tx.query(`select * from pierre_rt_schedule_contract_activation($1,$2,$3,$4)`, [ctx.company_id, amendmentContractId, eff, JSON.stringify(effects)]);
      await emitContractEvent(tx, ctx, "contract.signature_prepared", { contract_id: amendmentContractId, status_after: "signed", reason: `amendment_effect_scheduled_${eff}` });
    });
    return { activated: false, deferred_until: eff, scheduled: true };
  }

  // past/now → ATOMIC application (effects + append-only history + task + audit/outbox).
  await applyAmendmentActivationAtomic(db, ctx, { amendmentId: amendmentContractId, eff, effects, taskId: null, failpoint: opts.__failpoint });
  return { activated: true, deferred_until: null, scheduled: false };
}

// R2.9/R2.11 — the activation WORKER: governed claim (FOR UPDATE SKIP LOCKED, tenant-bound) of due
// tasks, atomic application per task, governed completion / failure (bounded retry → dead-letter).
export async function runDueContractActivations(db: SqlExecutor, ctx: TenantContext, opts: { as_of?: string; limit?: number; worker?: string; lease_seconds?: number; __failpoint?: string } = {}): Promise<{ scanned: number; applied: number; dead_lettered: number }> {
  requirePermission(ctx, "document.write");
  const { pickAllowedAmendmentEffects } = await import("./contracts");
  const asOf = (opts.as_of ?? (new Date().toISOString())).slice(0, 10);
  const limit = Math.min(opts.limit ?? 50, 200);
  const worker = opts.worker ?? `activation-worker:${newUuid().slice(0, 8)}`;
  const lease = Math.max(opts.lease_seconds ?? 60, 1);
  // 1. CLAIM due tasks atomically (tenant-bound), committing the lease.
  const claimed = await db.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
    return (await tx.query<{ id: string; amendment_contract_id: string; execute_at: unknown; effects: Record<string, unknown> }>(
      `select id, amendment_contract_id, execute_at, effects from pierre_rt_claim_contract_activations($1,$2,$3,$4,$5)`,
      [ctx.company_id, limit, worker, lease, asOf])).rows;
  });
  let applied = 0, deadLettered = 0;
  for (const t of claimed) {
    const effects = pickAllowedAmendmentEffects(t.effects);
    const eff = dateStr(t.execute_at);
    try {
      const already = (await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_contract_audit where company_id=$1 and contract_id=$2 and event='contract.amendment_activated'`, [ctx.company_id, t.amendment_contract_id])).rows[0].n;
      if (already > 0) {
        // already applied (e.g. by a direct activation) → complete WITH worker ownership, idempotent.
        await db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]); await tx.query(`select pierre_rt_complete_contract_activation($1,$2,$3)`, [ctx.company_id, t.id, worker]); });
        applied += 1; continue;
      }
      await applyAmendmentActivationAtomic(db, ctx, { amendmentId: t.amendment_contract_id, eff, effects, taskId: t.id, worker, failpoint: opts.__failpoint });
      applied += 1;
    } catch (e) {
      // governed failure: bounded retry → dead-letter (WORKER OWNERSHIP required). Error redacted/bounded.
      const safe = (e instanceof Error ? e.message : "error").replace(/[A-Za-z0-9._-]{24,}/g, "[redacted]").slice(0, 180);
      await db.transaction(async (tx) => {
        await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
        await tx.query(`select pierre_rt_fail_contract_activation($1,$2,$3,$4,$5)`, [ctx.company_id, t.id, worker, safe, ACTIVATION_MAX_ATTEMPTS]);
      });
      const st = (await db.query<{ status: string }>(`select status from pierre_rt_contract_activation_tasks where company_id=$1 and id=$2`, [ctx.company_id, t.id])).rows[0];
      if (st?.status === "dead_letter") deadLettered += 1;
    }
  }
  return { scanned: claimed.length, applied, dead_lettered: deadLettered };
}
