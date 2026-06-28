// src/lib/pierre/v1/communications.ts
// PHASE 8.4 — governed communication delivery orchestration. Turns pierre_rt_outbox business events
// into intents → recipients → deliveries, dispatches them via a tenant-bound claim worker (in-app
// message OR real email provider), records append-only attempts, recovers timeouts WITHOUT blind
// resend, retries with bounded backoff → dead-letter, ingests verified provider webhooks and drives
// the delivery state machine, and respects preferences + suppressions. The app role can NEVER
// fabricate delivery truth — only the governed SECURITY DEFINER functions do.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { TenantContext } from "./tenant-context";
import { requirePermission } from "./rbac";
import { sha256 } from "./renderers";
import { classifyCommunicationEvent, isMandatoryCategory, type CommunicationEventPolicy, type CommunicationChannel } from "./communication-event-registry";
import { resolveCommunicationRecipient } from "./communication-recipient-resolver";
import { renderCommunication } from "./communication-template-registry";
import { createSecureLink } from "./communication-secure-links";
import { resolveEmailProvider, publicAppBase, emailFrom, emailReplyTo, secureLinkSecret } from "./communication-provider-config";
import { EmailProviderError, type EmailDeliveryProvider } from "./communication-provider";

export type CommunicationDeps = { provider?: EmailDeliveryProvider; now?: string; secureLinkSecret?: string | null; publicBase?: string | null; from?: string | null; replyTo?: string | null; __failpoint?: string };

function failpoint(deps: CommunicationDeps, point: string): void { if (deps.__failpoint === point) throw new Error(`__failpoint:${point}`); }

/** PII-free CloneTrace audit row for a communication transition. */
async function commAudit(db: SqlExecutor, ctx: TenantContext, action: string, detail: Record<string, string | number | null>): Promise<void> {
  await db.query(`insert into pierre_rt_document_access_log (id, company_id, document_id, actor_user_id, action, detail) values ($1,$2,$3,$4,$5,$6)`,
    [newUuid(), ctx.company_id, (detail.document_id as string) ?? null, ctx.user_id, action, JSON.stringify(detail)]);
}

function objectRefForEvent(eventKind: string, payload: Record<string, unknown>): { objectType: string; objectId: string | null } {
  if (eventKind.startsWith("contract.")) return { objectType: "contract", objectId: (payload.contract_id as string) ?? null };
  if (eventKind.startsWith("document.")) return { objectType: "document", objectId: (payload.document_id as string) ?? null };
  if (eventKind === "signature.completed" || eventKind.startsWith("signature.")) return { objectType: "signature_request", objectId: (payload.signature_request_id as string) ?? null };
  if (eventKind.startsWith("template.")) return { objectType: "template", objectId: (payload.template_id as string) ?? null };
  return { objectType: "mission_task", objectId: (payload.task_id as string) ?? null };
}

// ── P8.4.2 — outbox → governed communication intents (+ recipients + deliveries) ─────
export type IntentCreationResult = { scanned: number; created: number; skipped_non_communicable: number; unknown: number; blocked: number; conflicts: number };

/** Deterministic, key-order-stable JSON for the source payload hash (R1.6). */
function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}
/** The real object version carried by the event (R1.6) — distinguishes v1 from a later v2 intent. */
function objectVersionOf(payload: Record<string, unknown>): string | null {
  const v = payload.version ?? payload.object_version ?? payload.new_version ?? payload.document_version ?? null;
  return v === null || v === undefined ? null : String(v);
}

export async function createCommunicationIntents(db: SqlExecutor, ctx: TenantContext, opts: { limit?: number } = {}, deps: CommunicationDeps = {}): Promise<IntentCreationResult> {
  requirePermission(ctx, "document.read");
  const limit = Math.min(opts.limit ?? 100, 500);
  const res: IntentCreationResult = { scanned: 0, created: 0, skipped_non_communicable: 0, unknown: 0, blocked: 0, conflicts: 0 };
  // R1.8 — content is FROZEN here (app role), so the dispatch worker never re-reads a business object.
  const linkSecret = deps.secureLinkSecret ?? secureLinkSecret();
  const base = deps.publicBase ?? publicAppBase();
  const rows = (await db.query<{ id: string; kind: string; payload: Record<string, unknown> }>(
    `select id, kind, payload from pierre_rt_outbox where company_id=$1 and status='pending' and comm_processing_status is null order by created_at asc limit $2`, [ctx.company_id, limit])).rows;
  for (const row of rows) {
    res.scanned += 1;
    const payload = row.payload ?? {};
    const cls = classifyCommunicationEvent(row.kind);
    if (cls.kind === "non_communicable") { await markOutboxProcessed(db, ctx, row.id); res.skipped_non_communicable += 1; continue; }
    const { objectType, objectId } = objectRefForEvent(row.kind, payload);
    // R1.6 — exact idempotency: the source key encodes (kind, object, version); the payload hash
    // detects a replay conflict (same key, different payload) vs a legitimate new version.
    const objectVersion = objectVersionOf(payload);
    const sourceKey = `${row.kind}:${objectType}:${objectId ?? "_"}:${objectVersion ?? "_"}`;
    const payloadHash = sha256(Buffer.from(canonicalJson(payload)));
    const fingerprint = sha256(Buffer.from(`${ctx.company_id}:${sourceKey}`)).slice(0, 48);

    if (cls.kind === "unknown") {
      // R1.7 — a real quarantine state (NOT outbox.status='dispatched'): kept, signalled, inspectable,
      // reprocessable, never delivered, never a permissive default.
      await upsertIntent(db, ctx, { source_outbox_id: row.id, event_kind: row.kind, object_type: objectType, object_id: objectId, template_key: "_unknown", template_version: "0", category: "optional", sensitivity: "normal", priority: "low", status: "unknown_event", dedup_fingerprint: fingerprint, source_event_key: sourceKey, source_payload_hash: payloadHash, object_version: objectVersion });
      await commAudit(db, ctx, "communication.unknown_event_received", { event_kind: row.kind, fingerprint });
      await quarantineOutbox(db, ctx, row.id, "unknown_event");
      res.unknown += 1; continue;
    }

    const policy = cls.policy;
    // R1.6 — look up the prior intent by the EXACT source key.
    const existing = (await db.query<{ id: string; source_payload_hash: string | null }>(`select id, source_payload_hash from pierre_rt_communication_intents where company_id=$1 and source_event_key=$2`, [ctx.company_id, sourceKey])).rows[0];
    if (existing) {
      if (existing.source_payload_hash == null || existing.source_payload_hash === payloadHash) {
        await markOutboxProcessed(db, ctx, row.id); continue; // idempotent replay → the same intent
      }
      // same key, DIFFERENT payload → replay conflict: quarantined (never a second, divergent delivery).
      await commAudit(db, ctx, "communication.replay_conflict", { event_kind: row.kind, fingerprint });
      await quarantineOutbox(db, ctx, row.id, "replay_conflict");
      res.conflicts += 1; continue;
    }

    const requiresEmail = policy.requiredChannels.includes("email");
    const reso = await resolveCommunicationRecipient(db, ctx, { recipientStrategy: policy.recipientStrategy, fallbackStrategy: policy.fallbackStrategy ?? null, objectType, objectId, payload, requiresEmail });
    const intentId = await upsertIntent(db, ctx, { source_outbox_id: row.id, event_kind: row.kind, object_type: objectType, object_id: objectId, template_key: policy.templateKey, template_version: "1", category: policy.category, sensitivity: policy.sensitivity, priority: policy.priority, status: reso.resolved ? "resolved" : "blocked", dedup_fingerprint: fingerprint, source_event_key: sourceKey, source_payload_hash: payloadHash, object_version: objectVersion });
    await commAudit(db, ctx, "communication.intent_created", { intent_id: intentId, event_kind: row.kind, document_id: reso.document_id });

    if (!reso.resolved || !reso.recipient) { await commAudit(db, ctx, "communication.suppressed", { intent_id: intentId, reason: reso.blockers.join(",") || "unresolved" }); await markOutboxProcessed(db, ctx, row.id); res.blocked += 1; continue; }

    const recipientId = newUuid();
    await db.query(
      `insert into pierre_rt_communication_recipients (id, company_id, intent_id, recipient_type, recipient_role, resolved_user_id, resolved_employee_id, resolved_membership_id, resolved_email, resolution_source, resolution_status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'resolved')`,
      [recipientId, ctx.company_id, intentId, reso.recipient.recipient_type, reso.recipient.recipient_role, reso.recipient.resolved_user_id, reso.recipient.resolved_employee_id, reso.recipient.resolved_membership_id, reso.recipient.resolved_email, reso.recipient.resolution_source]);
    await commAudit(db, ctx, "communication.recipient_resolved", { intent_id: intentId, recipient_id: recipientId, source: reso.recipient.resolution_source });

    // create one delivery per feasible allowed channel (in_app always; email only if a real address),
    // FREEZING the rendered content + provider idempotency key into each (R1.8).
    const channels: CommunicationChannel[] = [];
    if (policy.allowedChannels.includes("in_app")) channels.push("in_app");
    if (policy.allowedChannels.includes("email") && reso.recipient.resolved_email) channels.push("email");
    for (const channel of channels) {
      const deliveryId = newUuid();
      const idem = sha256(Buffer.from(`${ctx.company_id}:${intentId}:${recipientId}:${channel}`));
      const actionPath = buildActionPathFor(ctx.company_id, objectType, reso.document_id, linkSecret, reso.recipient.resolved_user_id);
      const variables = { object_label: reso.object_label || "Notification", action_path: actionPath };
      const { rendered, templateVersion } = renderCommunication({ templateKey: policy.templateKey, locale: "fr", variables, publicBase: base });
      const isEmail = channel === "email";
      const frozenSubject = isEmail ? rendered.subject : rendered.in_app_title;
      const frozenPlain = isEmail ? rendered.plain_text : rendered.in_app_body;
      const frozenHtml = isEmail ? rendered.safe_html : null;
      const varsJson = JSON.stringify(variables);
      const provIdem = isEmail ? `communication:${ctx.company_id}:${deliveryId}:${rendered.content_hash.slice(0, 16)}` : null;
      await db.query(
        `insert into pierre_rt_communication_deliveries (id, company_id, intent_id, recipient_id, channel, status, idempotency_key,
           template_key, template_version, locale, canonical_variables, canonical_variables_hash, frozen_subject, frozen_plain_text, frozen_html,
           subject_hash, plain_text_hash, html_hash, content_hash, provider_idempotency_key, rendered_at)
         values ($1,$2,$3,$4,$5,'queued',$6,$7,$8,'fr',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now()) on conflict (company_id, idempotency_key) do nothing`,
        [deliveryId, ctx.company_id, intentId, recipientId, channel, idem,
         policy.templateKey, templateVersion, varsJson, sha256(Buffer.from(varsJson)), frozenSubject, frozenPlain, frozenHtml,
         sha256(Buffer.from(frozenSubject)), sha256(Buffer.from(frozenPlain)), frozenHtml ? sha256(Buffer.from(frozenHtml)) : null, rendered.content_hash, provIdem]);
    }
    await db.query(`update pierre_rt_communication_intents set status='dispatched' where company_id=$1 and id=$2`, [ctx.company_id, intentId]);
    await markOutboxProcessed(db, ctx, row.id);
    res.created += 1;
  }
  return res;
}

async function upsertIntent(db: SqlExecutor, ctx: TenantContext, i: { source_outbox_id: string; event_kind: string; object_type: string; object_id: string | null; template_key: string; template_version: string; category: string; sensitivity: string; priority: string; status: string; dedup_fingerprint: string; source_event_key: string; source_payload_hash: string; object_version: string | null }): Promise<string> {
  const id = newUuid();
  const r = await db.query<{ id: string }>(
    `insert into pierre_rt_communication_intents (id, company_id, source_outbox_id, event_kind, object_type, object_id, template_key, template_version, locale, category, sensitivity, priority, status, dedup_fingerprint, source_event_key, source_payload_hash, object_version, correlation_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'fr',$9,$10,$11,$12,$13,$14,$15,$16,$17) on conflict (company_id, dedup_fingerprint) do nothing returning id`,
    [id, ctx.company_id, i.source_outbox_id, i.event_kind, i.object_type, i.object_id, i.template_key, i.template_version, i.category, i.sensitivity, i.priority, i.status, i.dedup_fingerprint, i.source_event_key, i.source_payload_hash, i.object_version, ctx.correlation_id ?? null]);
  if (r.rows[0]) return r.rows[0].id;
  return (await db.query<{ id: string }>(`select id from pierre_rt_communication_intents where company_id=$1 and dedup_fingerprint=$2`, [ctx.company_id, i.dedup_fingerprint])).rows[0].id;
}
/** R1.7 — the comm pipeline marks its own processing state on the outbox (separate from legacy status). */
async function markOutboxProcessed(db: SqlExecutor, ctx: TenantContext, outboxId: string): Promise<void> {
  await db.query(`update pierre_rt_outbox set status='dispatched', dispatched_at=now(), comm_processing_status='processed', comm_processed_at=now() where company_id=$1 and id=$2 and comm_processing_status is null`, [ctx.company_id, outboxId]);
}
/** R1.7 — quarantine: kept + signalled (NOT dispatched), reprocessable, audited; never delivered. */
async function quarantineOutbox(db: SqlExecutor, ctx: TenantContext, outboxId: string, reason: string): Promise<void> {
  await db.query(`update pierre_rt_outbox set comm_processing_status='quarantined', comm_quarantine_reason=$3, comm_processed_at=now() where company_id=$1 and id=$2 and comm_processing_status is null`, [ctx.company_id, outboxId, reason]);
}

// ── preferences + suppressions ───────────────────────────────────────────────────────
async function isChannelEnabled(db: SqlExecutor, ctx: TenantContext, userId: string | null, category: string, channel: CommunicationChannel): Promise<boolean> {
  if (isMandatoryCategory(category as CommunicationEventPolicy["category"])) return true; // mandatory can never be opted out
  if (!userId) return true;
  // R1.1 — tenant-bound read so it works under the worker role with RLS enforced.
  const r = (await withTenant(db, ctx, (tx) => tx.query<{ enabled: boolean }>(`select enabled from pierre_rt_communication_preferences where company_id=$1 and user_id=$2 and category=$3 and channel=$4`, [ctx.company_id, userId, category, channel]))).rows[0];
  return r ? r.enabled : true;
}
async function isSuppressed(db: SqlExecutor, ctx: TenantContext, email: string | null): Promise<boolean> {
  if (!email) return false;
  const r = (await withTenant(db, ctx, (tx) => tx.query<{ n: number }>(`select count(*)::int n from pierre_rt_communication_suppressions where company_id=$1 and email_lower=lower($2)`, [ctx.company_id, email]))).rows[0];
  return r.n > 0;
}
export async function setCommunicationPreference(db: SqlExecutor, ctx: TenantContext, input: { user_id: string; category: string; channel: CommunicationChannel; enabled: boolean }): Promise<void> {
  requirePermission(ctx, "document.read");
  // R1.14 — a user may set ONLY their own preferences. Setting another member's preferences requires
  // an authorized admin (tenancy.admin) AND that the target is a REAL active member of THIS tenant.
  // A different-tenant user or a user with no membership is refused (also enforced by the
  // (company_id, user_id) → members FK at the DB layer).
  if (input.user_id !== ctx.user_id) {
    requirePermission(ctx, "tenancy.admin");
    const member = (await db.query<{ id: string }>(`select id from pierre_rt_members where company_id=$1 and user_id=$2 and (status is null or status='active') limit 1`, [ctx.company_id, input.user_id])).rows[0];
    if (!member) throw Errors.forbidden("the target is not an active member of this tenant");
  }
  if (isMandatoryCategory(input.category as CommunicationEventPolicy["category"]) && !input.enabled) throw Errors.validation("This category is mandatory and cannot be disabled");
  await db.query(
    `insert into pierre_rt_communication_preferences (company_id, user_id, category, channel, enabled, updated_at) values ($1,$2,$3,$4,$5,now())
     on conflict (company_id, user_id, category, channel) do update set enabled=excluded.enabled, updated_at=now()`,
    [ctx.company_id, input.user_id, input.category, input.channel, input.enabled]);
}

// ── P8.4.14 — dispatch worker (claim/lease/ownership) ───────────────────────────────
export type DispatchResult = { claimed: number; delivered: number; submitted: number; suppressed: number; retried: number; dead_lettered: number; reconcile: number };

export async function dispatchCommunicationDeliveries(db: SqlExecutor, ctx: TenantContext, opts: { limit?: number; worker?: string; lease_seconds?: number } = {}, deps: CommunicationDeps = {}): Promise<DispatchResult> {
  requirePermission(ctx, "document.read");
  const limit = Math.min(opts.limit ?? 50, 200);
  const worker = opts.worker ?? `comm-worker:${newUuid().slice(0, 8)}`;
  const lease = Math.max(opts.lease_seconds ?? 60, 1);
  const res: DispatchResult = { claimed: 0, delivered: 0, submitted: 0, suppressed: 0, retried: 0, dead_lettered: 0, reconcile: 0 };
  const provider = resolveEmailProvider(deps.provider);
  const from = deps.from ?? emailFrom();
  const replyTo = deps.replyTo ?? emailReplyTo();

  // 1. CLAIM due deliveries atomically (tenant-bound), committing the lease.
  const claimed = await db.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]);
    return (await tx.query<DeliveryRow>(`select * from pierre_rt_claim_communication_deliveries($1,$2,$3,$4,now()) limit $5`, [ctx.company_id, limit, worker, lease, limit])).rows;
  });
  res.claimed = claimed.length;

  for (const d of claimed) {
    try {
      const ctxData = await loadDeliveryContext(db, ctx, d.id);
      const channel = d.channel as CommunicationChannel;
      // preferences: a suppressible category the recipient opted out of → suppressed (mandatory never)
      if (!(await isChannelEnabled(db, ctx, ctxData.recipient_user_id, ctxData.category, channel))) {
        await governedFail(db, ctx, d.id, worker, "preference_opt_out", "suppressed", 0, ctxData.maxAttempts);
        await commAudit(db, ctx, "communication.suppressed", { delivery_id: d.id, reason: "preference_opt_out" });
        res.suppressed += 1; continue;
      }
      if (d.channel === "email" && await isSuppressed(db, ctx, ctxData.resolved_email)) {
        if (isMandatoryCategory(ctxData.category as CommunicationEventPolicy["category"])) {
          // mandatory + suppressed address → do NOT claim delivered; escalate to an operator (in-app)
          await governedFail(db, ctx, d.id, worker, "suppressed_mandatory_escalated", "permanent", 0, ctxData.maxAttempts);
          await commAudit(db, ctx, "communication.failed", { delivery_id: d.id, reason: "suppressed_mandatory_escalated" });
          res.suppressed += 1; continue;
        }
        await governedFail(db, ctx, d.id, worker, "address_suppressed", "suppressed", 0, ctxData.maxAttempts);
        res.suppressed += 1; continue;
      }

      // 2. R1.8 — use the FROZEN content (subject/body/html + secure link), already rendered at intent
      // creation. The worker NEVER re-renders nor reads a business object; a retry is byte-identical.
      failpoint(deps, "after_render");

      if (channel === "in_app") {
        // 3a. in-app: create the REAL persisted message + attempt + mark delivered ATOMICALLY (one
        // governed transaction). A failure before completion rolls EVERYTHING back (no orphan
        // message, no false delivered, no duplicate). The create is idempotent on its dedup.
        const dedup = sha256(Buffer.from(`inapp:${ctx.company_id}:${d.id}`)).slice(0, 48);
        const messageId = await withTenant(db, ctx, async (tx) => {
          const mid = (await tx.query<{ id: string }>(`select pierre_rt_create_internal_message($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) as id`, [ctx.company_id, ctxData.recipient_user_id!, d.id, worker, ctxData.event_kind, ctxData.frozen_subject, ctxData.frozen_plain_text, ctxData.action_path, ctxData.object_type, ctxData.object_id, ctxData.priority, dedup])).rows[0].id;
          failpoint(deps, "before_internal_complete");
          await tx.query(`select pierre_rt_record_communication_attempt($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [ctx.company_id, d.id, worker, "in_app", mid, ctxData.content_hash, "delivered", null, null]);
          await tx.query(`select pierre_rt_complete_internal_delivery($1,$2,$3,$4,$5)`, [ctx.company_id, d.id, worker, mid, ctxData.content_hash]);
          return mid;
        });
        await commAudit(db, ctx, "communication.delivered", { delivery_id: d.id, channel: "in_app", message_id: messageId });
        res.delivered += 1; continue;
      }

      // 3b. email: real provider send with the FROZEN provider idempotency key (R1.8/R1.9)
      const idemKey = ctxData.provider_idempotency_key ?? `communication:${ctx.company_id}:${d.id}:${ctxData.content_hash.slice(0, 16)}`;
      let provMsgId: string;
      try {
        failpoint(deps, "before_provider_send");
        const sent = await provider.sendEmail({ idempotencyKey: idemKey, from: from ?? "CloneStore <no-reply@clonestore.pro>", replyTo: replyTo ?? null, to: ctxData.resolved_email!, subject: ctxData.frozen_subject, plainText: ctxData.frozen_plain_text, html: ctxData.frozen_html ?? ctxData.frozen_plain_text, tags: { delivery_id: d.id, company_id: ctx.company_id, event_kind: ctxData.event_kind } });
        provMsgId = sent.providerMessageId;
        failpoint(deps, "before_submit_persist");
      } catch (e) {
        const err = e as EmailProviderError;
        // R1.9 — an ambiguous timeout AFTER the send is NEVER blindly resent. If the provider can be
        // reconciled by the (frozen) idempotency key, do so; otherwise mark submission_unknown and let
        // the webhook / an operator resolve it. The Fake exposes findByIdempotencyKey; Resend cannot
        // search by it → submission_unknown (no auto-resend) until a webhook/provider_message_id lands.
        const recover = (provider as unknown as { findByIdempotencyKey?: (k: string) => Promise<{ providerMessageId: string } | null> }).findByIdempotencyKey;
        if (err.code === "timeout" && recover) {
          const found = await recover.call(provider, idemKey);
          if (found) {
            await governedRecordAttempt(db, ctx, d.id, worker, { provider: provider.providerKey, provider_message_id: found.providerMessageId, request_fingerprint: ctxData.content_hash, result_status: "recovered", http_status: null, error_code_safe: "timeout_recovered" });
            await governedSubmit(db, ctx, d.id, worker, provider.providerKey, found.providerMessageId, ctxData.content_hash);
            await commAudit(db, ctx, "communication.submitted", { delivery_id: d.id, channel: "email", recovered: 1 });
            res.submitted += 1; continue;
          }
          await governedRecordAttempt(db, ctx, d.id, worker, { provider: provider.providerKey, provider_message_id: null, request_fingerprint: ctxData.content_hash, result_status: "submission_unknown", http_status: err.httpStatus ?? null, error_code_safe: err.code });
          await governedFail(db, ctx, d.id, worker, "submission_unknown", "submission_unknown", retryAfter(err), ctxData.maxAttempts);
          await commAudit(db, ctx, "communication.retry_scheduled", { delivery_id: d.id, reason: "submission_unknown" });
          res.reconcile += 1; continue;
        }
        if (err.code === "timeout") {
          // no reconciliation path at all (e.g. Resend) → submission_unknown, never a blind resend.
          await governedRecordAttempt(db, ctx, d.id, worker, { provider: provider.providerKey, provider_message_id: null, request_fingerprint: ctxData.content_hash, result_status: "submission_unknown", http_status: err.httpStatus ?? null, error_code_safe: err.code });
          await governedFail(db, ctx, d.id, worker, "submission_unknown", "submission_unknown", retryAfter(err), ctxData.maxAttempts);
          await commAudit(db, ctx, "communication.retry_scheduled", { delivery_id: d.id, reason: "submission_unknown" });
          res.reconcile += 1; continue;
        }
        // classified failure
        await governedRecordAttempt(db, ctx, d.id, worker, { provider: provider.providerKey, provider_message_id: null, request_fingerprint: ctxData.content_hash, result_status: "error", http_status: err.httpStatus ?? null, error_code_safe: err.code });
        if (!err.retriable) {
          await governedFail(db, ctx, d.id, worker, err.code, "permanent", 0, ctxData.maxAttempts);
          await commAudit(db, ctx, "communication.failed", { delivery_id: d.id, reason: err.code });
        } else {
          await governedFail(db, ctx, d.id, worker, err.code, "retry", retryAfter(err), ctxData.maxAttempts);
          const st = await deliveryStatus(db, ctx, d.id);
          if (st === "dead_letter") { await commAudit(db, ctx, "communication.dead_lettered", { delivery_id: d.id, reason: err.code }); res.dead_lettered += 1; }
          else { await commAudit(db, ctx, "communication.retry_scheduled", { delivery_id: d.id, reason: err.code }); res.retried += 1; }
        }
        continue;
      }
      // success: append attempt then submit (governed; provider id persisted)
      await governedRecordAttempt(db, ctx, d.id, worker, { provider: provider.providerKey, provider_message_id: provMsgId, request_fingerprint: ctxData.content_hash, result_status: "submitted", http_status: 200, error_code_safe: null });
      await governedSubmit(db, ctx, d.id, worker, provider.providerKey, provMsgId, ctxData.content_hash);
      await commAudit(db, ctx, "communication.submitted", { delivery_id: d.id, channel: "email" });
      res.submitted += 1;
    } catch (e) {
      // unexpected error: release via governed retry so the lease never strands the delivery
      try { await governedFail(db, ctx, d.id, worker, (e as Error).message.slice(0, 80), "retry", 60, 5); } catch { /* best-effort */ }
    }
  }
  return res;
}

function retryAfter(err: EmailProviderError): number { return err.code === "rate_limited" ? 120 : 60; }

// ── delivery context + governed call wrappers (tenant-bound) ────────────────────────
type DeliveryRow = { id: string; company_id: string; intent_id: string; recipient_id: string; channel: string; status: string; attempt_count: number; locked_by: string | null };
// R1.1/R1.8 — the dispatch worker reads ONLY communication tables (frozen content), never a
// business object. Subject/body/html + the secure link + the provider idempotency key are all frozen.
type DeliveryContext = {
  event_kind: string; object_type: string; object_id: string | null; category: string; priority: string;
  recipient_user_id: string | null; resolved_email: string | null; maxAttempts: number;
  frozen_subject: string; frozen_plain_text: string; frozen_html: string | null;
  content_hash: string; provider_idempotency_key: string | null; action_path: string; object_label: string;
};

async function loadDeliveryContext(db: SqlExecutor, ctx: TenantContext, deliveryId: string): Promise<DeliveryContext> {
  // R1.1 — tenant-bound read (works under the worker role with RLS); reads ONLY communication tables.
  const r = (await withTenant(db, ctx, (tx) => tx.query<{ event_kind: string; object_type: string; object_id: string | null; category: string; priority: string; recipient_user_id: string | null; resolved_email: string | null; frozen_subject: string | null; frozen_plain_text: string | null; frozen_html: string | null; content_hash: string | null; provider_idempotency_key: string | null; canonical_variables: Record<string, string> | null }>(
    `select i.event_kind, i.object_type, i.object_id, i.category, i.priority, r.resolved_user_id as recipient_user_id, r.resolved_email,
            d.frozen_subject, d.frozen_plain_text, d.frozen_html, d.content_hash, d.provider_idempotency_key, d.canonical_variables
       from pierre_rt_communication_deliveries d join pierre_rt_communication_intents i on i.company_id=d.company_id and i.id=d.intent_id
       join pierre_rt_communication_recipients r on r.company_id=d.company_id and r.id=d.recipient_id
      where d.company_id=$1 and d.id=$2`, [ctx.company_id, deliveryId]))).rows[0];
  const policy = classifyCommunicationEvent(r.event_kind);
  const vars = r.canonical_variables ?? {};
  return {
    event_kind: r.event_kind, object_type: r.object_type, object_id: r.object_id, category: r.category, priority: r.priority,
    recipient_user_id: r.recipient_user_id, resolved_email: r.resolved_email,
    maxAttempts: policy.kind === "communicable" ? policy.policy.maxAttempts : 5,
    frozen_subject: r.frozen_subject ?? "Notification", frozen_plain_text: r.frozen_plain_text ?? "", frozen_html: r.frozen_html,
    content_hash: r.content_hash ?? sha256(Buffer.from(`${ctx.company_id}:${deliveryId}`)), provider_idempotency_key: r.provider_idempotency_key,
    action_path: vars.action_path ?? "/agents/pierre/use", object_label: vars.object_label ?? "Notification",
  };
}

/** R1.10 — a secure, tenant-bound link for document-bearing objects; otherwise a plain cockpit link.
 *  The claim is object-consistent: a document-bearing object always points at the document_id. */
function buildActionPathFor(companyId: string, objectType: string, documentId: string | null, linkSecret: string | null, recipientUserId: string | null): string {
  if (documentId && linkSecret) {
    const claimObjectType = objectType === "template" ? "template" : "document";
    const { path } = createSecureLink({ company_id: companyId, object_type: claimObjectType, object_id: documentId, recipient_user_id: recipientUserId, secret: linkSecret });
    return path;
  }
  return "/agents/pierre/use";
}

async function deliveryStatus(db: SqlExecutor, ctx: TenantContext, id: string): Promise<string> {
  return (await withTenant(db, ctx, (tx) => tx.query<{ status: string }>(`select status from pierre_rt_communication_deliveries where company_id=$1 and id=$2`, [ctx.company_id, id]))).rows[0].status;
}
async function withTenant<T>(db: SqlExecutor, ctx: TenantContext, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => { await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.company_id]); return fn(tx); });
}
async function governedRecordAttempt(db: SqlExecutor, ctx: TenantContext, deliveryId: string, worker: string, a: { provider: string; provider_message_id: string | null; request_fingerprint: string; result_status: string; http_status: number | null; error_code_safe: string | null }): Promise<void> {
  await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_record_communication_attempt($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [ctx.company_id, deliveryId, worker, a.provider, a.provider_message_id, a.request_fingerprint, a.result_status, a.http_status, a.error_code_safe]));
}
async function governedSubmit(db: SqlExecutor, ctx: TenantContext, deliveryId: string, worker: string, provider: string, provMsgId: string, contentHash: string): Promise<void> {
  await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_submit_communication_delivery($1,$2,$3,$4,$5,$6)`, [ctx.company_id, deliveryId, worker, provider, provMsgId, contentHash]));
}
async function governedFail(db: SqlExecutor, ctx: TenantContext, deliveryId: string, worker: string, errorSafe: string, disposition: string, retryAfterSeconds: number, maxAttempts: number): Promise<void> {
  await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_fail_communication_delivery($1,$2,$3,$4,$5,$6,$7)`, [ctx.company_id, deliveryId, worker, errorSafe, disposition, retryAfterSeconds, maxAttempts]));
}

// ── P8.4.20 — read + governed operator actions (no HTML/secret/object-key exposure) ─
export type CommunicationView = { id: string; channel: string; status: string; event_kind: string; priority: string; provider: string | null; attempt_count: number; created_at: string; submitted_at: string | null; delivered_at: string | null; last_error_safe: string | null };
export async function listCommunicationDeliveries(db: SqlExecutor, ctx: TenantContext, opts: { status?: string | null; limit?: number } = {}): Promise<{ items: CommunicationView[] }> {
  requirePermission(ctx, "document.read");
  const limit = Math.min(opts.limit ?? 50, 200);
  const where = opts.status ? `and d.status=$3` : "";
  const params: unknown[] = opts.status ? [ctx.company_id, limit, opts.status] : [ctx.company_id, limit];
  const rows = (await db.query<CommunicationView>(
    `select d.id, d.channel, d.status, i.event_kind, i.priority, d.provider, d.attempt_count, d.created_at, d.submitted_at, d.delivered_at, d.last_error_safe
       from pierre_rt_communication_deliveries d join pierre_rt_communication_intents i on i.company_id=d.company_id and i.id=d.intent_id
      where d.company_id=$1 ${where} order by d.created_at desc limit $2`, params)).rows;
  return { items: rows };
}
export async function listDeadLetterCommunications(db: SqlExecutor, ctx: TenantContext): Promise<{ items: CommunicationView[] }> {
  return listCommunicationDeliveries(db, ctx, { status: "dead_letter" });
}
export async function retryCommunicationDelivery(db: SqlExecutor, ctx: TenantContext, deliveryId: string): Promise<void> {
  requirePermission(ctx, "document.write");
  await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_retry_communication_delivery($1,$2)`, [ctx.company_id, deliveryId]));
  await commAudit(db, ctx, "communication.retry_scheduled", { delivery_id: deliveryId, reason: "manual" });
}
export async function cancelCommunicationDelivery(db: SqlExecutor, ctx: TenantContext, deliveryId: string): Promise<void> {
  requirePermission(ctx, "document.write");
  await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_cancel_communication_delivery($1,$2)`, [ctx.company_id, deliveryId]));
  await commAudit(db, ctx, "communication.cancelled", { delivery_id: deliveryId });
}

// ── P8.4.10 — the recipient's in-app message feed (real persisted messages) ──────────
export type InternalMessageView = { id: string; title: string | null; body_text: string | null; action_path: string | null; priority: string | null; read_at: string | null; created_at: string };
export async function listInternalMessages(db: SqlExecutor, ctx: TenantContext, opts: { include_archived?: boolean; limit?: number } = {}): Promise<{ items: InternalMessageView[]; unread: number }> {
  requirePermission(ctx, "document.read");
  const limit = Math.min(opts.limit ?? 50, 200);
  const archived = opts.include_archived ? "" : "and archived_at is null";
  const items = (await db.query<InternalMessageView>(`select id, title, body_text, action_path, priority, read_at, created_at from pierre_rt_notifications where company_id=$1 and recipient_user_id=$2 ${archived} order by created_at desc limit $3`, [ctx.company_id, ctx.user_id, limit])).rows;
  const unread = (await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_notifications where company_id=$1 and recipient_user_id=$2 and read_at is null and archived_at is null`, [ctx.company_id, ctx.user_id])).rows[0].n;
  return { items, unread };
}
/** Idempotent: marks the RECIPIENT's own message read (only if unread). Never another user's. */
export async function markInternalMessageRead(db: SqlExecutor, ctx: TenantContext, messageId: string): Promise<{ updated: boolean }> {
  requirePermission(ctx, "document.read");
  const r = await db.query<{ id: string }>(`update pierre_rt_notifications set read_at=now() where company_id=$1 and recipient_user_id=$2 and id=$3 and read_at is null returning id`, [ctx.company_id, ctx.user_id, messageId]);
  return { updated: r.rows.length > 0 };
}
/** Non-destructive archive of the recipient's own message. */
export async function archiveInternalMessage(db: SqlExecutor, ctx: TenantContext, messageId: string): Promise<void> {
  requirePermission(ctx, "document.read");
  await db.query(`update pierre_rt_notifications set archived_at=now() where company_id=$1 and recipient_user_id=$2 and id=$3 and archived_at is null`, [ctx.company_id, ctx.user_id, messageId]);
}

// ── P8.4.18 — receive a verified provider webhook → governed idempotent ingest ──────
// `db` MUST be the minimal-privilege webhook executor. The provider verifies the signature/replay;
// the tenant is DERIVED from (provider, provider_message_id) — never from the payload. Application
// of the state machine is a SEPARATE tenant-bound worker pass (applyPendingCommunicationEvents).
export async function receiveCommunicationWebhook(db: SqlExecutor, input: { rawBody: string | Buffer; headers: Record<string, string | null | undefined>; secret: string; providerInstance?: EmailDeliveryProvider; now_seconds?: number }): Promise<{ status: string; company: string | null; delivery: string | null }> {
  const provider = input.providerInstance ?? resolveEmailProvider();
  const raw = Buffer.isBuffer(input.rawBody) ? input.rawBody : Buffer.from(input.rawBody, "utf8");
  const verified = await provider.verifyWebhook({ rawBody: raw, headers: input.headers, secret: input.secret, nowSeconds: input.now_seconds }); // throws on bad signature/replay
  const ingest = (await db.query<{ event_row: string; status: string; company: string | null; delivery: string | null }>(
    `select * from pierre_rt_ingest_communication_provider_event($1,$2,$3,$4,$5,$6,$7,$8)`,
    [verified.provider, verified.event_id, verified.provider_message_id, verified.event_type, verified.payload_hash, raw.length, verified.occurred_at, true])).rows[0];
  return { status: ingest.status, company: ingest.company, delivery: ingest.delivery };
}

// ── P8.4.19 — apply pending provider events to the delivery state machine (tenant worker) ──
export type ApplyEventsResult = { processed: number; applied: number; ignored: number; unknown: number; suppressions: number };
export async function applyPendingCommunicationEvents(db: SqlExecutor, ctx: TenantContext, opts: { limit?: number } = {}): Promise<ApplyEventsResult> {
  requirePermission(ctx, "document.read");
  const limit = Math.min(opts.limit ?? 100, 500);
  const res: ApplyEventsResult = { processed: 0, applied: 0, ignored: 0, unknown: 0, suppressions: 0 };
  const events = (await db.query<{ id: string; delivery_id: string | null; event_type: string }>(
    `select id, delivery_id, event_type from pierre_rt_communication_provider_events where company_id=$1 and application_status='pending' order by received_at asc limit $2`, [ctx.company_id, limit])).rows;
  for (const ev of events) {
    res.processed += 1;
    const outcome = await withTenant(db, ctx, async (tx) => (await tx.query<{ apply: string }>(`select pierre_rt_apply_communication_provider_event($1,$2) as apply`, [ctx.company_id, ev.id])).rows[0].apply);
    if (outcome === "applied") res.applied += 1; else if (outcome === "unknown") res.unknown += 1; else res.ignored += 1;
    // on bounce/complaint → record a suppression for the recipient address (governed)
    if (ev.delivery_id && (ev.event_type === "email.bounced" || ev.event_type === "email.complained")) {
      const addr = (await db.query<{ resolved_email: string | null }>(`select r.resolved_email from pierre_rt_communication_deliveries d join pierre_rt_communication_recipients r on r.company_id=d.company_id and r.id=d.recipient_id where d.company_id=$1 and d.id=$2`, [ctx.company_id, ev.delivery_id])).rows[0];
      if (addr?.resolved_email) { await withTenant(db, ctx, (tx) => tx.query(`select pierre_rt_record_communication_suppression($1,$2,$3,$4)`, [ctx.company_id, addr.resolved_email, ev.event_type === "email.complained" ? "complaint" : "hard_bounce", "resend"])); res.suppressions += 1; }
      await commAudit(db, ctx, ev.event_type === "email.complained" ? "communication.complained" : "communication.bounced", { delivery_id: ev.delivery_id });
    }
    await commAudit(db, ctx, "communication.provider_event_applied", { event_id: ev.id, outcome });
  }
  return res;
}
