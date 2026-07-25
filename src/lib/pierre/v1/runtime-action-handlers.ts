// src/lib/pierre/v1/runtime-action-handlers.ts
// PHASE 8.5 §22 — typed SAFE-APPLY handlers. A handler PERFORMS the action by calling a GOVERNED
// service (never direct I/O) and returns a canonical outcome; the worker loop then records the result
// under the job's fencing token. NO handler sends email (→ emit outbox + P8.4 createCommunicationIntents
// /dispatchCommunicationDeliveries), calls a signature provider (→ P8.3 prepareContractSignature/
// submitContractToSignatureProvider), or runs a free instruction. The tenant comes from the bound
// context, never from the payload. Business reads/services use the app-role `appDb`; the job lifecycle
// (claim/complete/fail) is the worker loop's concern under the worker-role executor.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import { sha256 } from "./renderers";
import type { TenantContext } from "./tenant-context";
import type { CommunicationDeps } from "./communications";
import { createCommunicationIntents, dispatchCommunicationDeliveries } from "./communications";
import { buildScheduleRule, nextScheduleRunAt } from "./runtime-schedule-rules";
import { prepareContractSignature } from "./contracts";
import { submitContractToSignatureProvider, type SignatureDeps } from "./signatures";
import { createDocument, createVersion } from "./documents";
import { createAbsence, appendEmployeeTimelineEvent } from "./employees";
import { createWorkforcePlan } from "./workforce-planning";
import { ingestCandidate, createRequisition, createApplication, prepareInterview, recordFeedback, prepareOffer } from "./recruitment";
import { createHrRequest } from "./hr-requests";
import { bindCountryPack } from "./country-config";
import {
  createEmployeeOnboardingCase, createDefaultOnboardingPlan, fulfillOnboardingRequirement,
  refreshOnboardingReadiness, computeOnboardingProgress, completeOnboardingStep, type OnboardingMode,
} from "./employee-onboarding";
import {
  openPayrollPeriod, collectVariablesFromAbsences, createPayrollVariable, attachPayrollEvidence,
  validatePayrollVariable, detectPayrollAnomalies, computePayrollReadiness, generatePayrollExport,
  reconcilePayrollProviderReturn, buildPayrollBrief, type PayrollMode,
} from "./pre-payroll";
import {
  createPerformanceCampaign, buildCampaignPopulation, createPerformanceInterview, recordPerformanceResponse,
  buildPerformanceSummary, submitPerformanceSummaryForValidation, applyPerformanceSummaryValidation,
  completePerformanceInterview, createPerformanceActionPlan, validatePerformanceActionPlan,
  createPerformanceActionItem, createPerformanceObjective, detectOverduePerformanceItems,
  addPerformanceTemplateSection, addPerformanceTemplateQuestion, generatePerformanceReport, sendPerformanceReminders,
  validateInterviewResponseCompleteness, type PerfMode,
} from "./performance";
import {
  createTrainingRequirement, validateTrainingRequirementSource, createTrainingSession, createTrainingEnrollment,
  recordTrainingAttendance, attachTrainingProof, verifyTrainingProof, issueTrainingCertification,
  detectExpiringCertifications, completeTrainingEnrollment, createTrainingPlan, addTrainingPlanItem,
  completeTrainingPlan, generateTrainingReport, sendTrainingInvitations, type TrainingMode,
} from "./training";

export type RuntimeDeps = {
  /** app-role, tenant-bound executor for governed business services (defaults to the job executor). */
  appDb?: SqlExecutor;
  /** R3.2 — the production route injects withRuntimeWorkerTransaction so every worker truth-call runs
   *  in a transaction bound to (SET LOCAL ROLE pierre_rt_runtime_worker + verified current_user). */
  runWorkerTx?: <T>(binding: { company_id: string }, fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>;
  comm?: CommunicationDeps;
  signature?: SignatureDeps;
  /** R4.11 — injectable timer for the long-action lease keep-alive (defaults to setInterval). */
  leaseScheduler?: import("./runtime-lease-controller").LeaseScheduler;
  __handlerFailpoint?: string;
};

export type RuntimeWaitRequest = {
  wait_kind: "timer" | "approval" | "external_event";
  event_kind?: string | null;
  object_type?: string | null;
  object_id?: string | null;
  expected_fingerprint?: string | null;
  validation_id?: string | null;
  wake_at?: string | null;
  expires_at?: string | null;
};
export type RuntimeActionResult = {
  status: "succeeded" | "waiting" | "blocked" | "submission_unknown";
  output?: Record<string, unknown>;
  outputHash?: string | null;
  wait?: RuntimeWaitRequest;
  blockerCode?: string;
  externalReference?: string | null;
};

export type RuntimeActionContext = {
  appDb: SqlExecutor;
  tenant: TenantContext;
  companyId: string;
  missionId: string;
  missionRunId: string;
  stepRunId: string;
  jobId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  deps: RuntimeDeps;
  /** R1.5 — re-assert ownership + fencing + lease (a heartbeat) right before an external effect. Throws
   *  (42501) if this worker lost the lease / a newer generation reclaimed it → the effect is aborted. */
  assertLease: () => Promise<void>;
  /** R1.5 — persist a checkpoint (before/after an external submission) under the current fencing token. */
  checkpoint: (kind: string, externalReference?: string | null) => Promise<void>;
};

export type RuntimeActionHandler = (ctx: RuntimeActionContext) => Promise<RuntimeActionResult>;

function ok(output?: Record<string, unknown>): RuntimeActionResult {
  return { status: "succeeded", output, outputHash: sha256(Buffer.from(JSON.stringify(output ?? {}))) };
}

// ── structural / state ───────────────────────────────────────────────────────────────
const noop: RuntimeActionHandler = async () => ok({ noop: true });
const complete: RuntimeActionHandler = async () => ok({ completed: true });
const block: RuntimeActionHandler = async (ctx) => ({ status: "blocked", blockerCode: String(ctx.payload.blocker_code ?? "blocked") });

// ── reads (governed, app-role; block if the object is absent in the tenant) ───────────
const readObject = (table: string, idField: string): RuntimeActionHandler => async (ctx) => {
  const id = String(ctx.payload[idField] ?? "");
  const r = await ctx.appDb.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
    return tx.query<{ id: string }>(`select id from ${table} where company_id=$1 and id=$2`, [ctx.companyId, id]);
  });
  return r.rows[0] ? ok({ exists: true, [idField]: id }) : { status: "blocked", blockerCode: "object_missing" };
};

// ── durable waits ─────────────────────────────────────────────────────────────────────
const waitUntilTime: RuntimeActionHandler = async (ctx) => ({
  status: "waiting",
  wait: { wait_kind: "timer", wake_at: String(ctx.payload.wake_at), expires_at: (ctx.payload.expires_at as string) ?? null },
});
const waitForEvent: RuntimeActionHandler = async (ctx) => ({
  status: "waiting",
  wait: {
    wait_kind: "external_event",
    event_kind: String(ctx.payload.event_kind),
    object_type: (ctx.payload.object_type as string) ?? null,
    object_id: (ctx.payload.object_id as string) ?? null,
    expected_fingerprint: (ctx.payload.expected_fingerprint as string) ?? null,
    expires_at: (ctx.payload.expires_at as string) ?? null,
  },
});

// ── human approval — creates a real pierre_rt_validations row, then WAITS on its decision ─
const approvalRequest: RuntimeActionHandler = async (ctx) => {
  const vId = newUuid();
  // P8.5-FINAL §3 — the content fingerprint the validator is approving is pinned on the validation, so
  // the REAL decision service can emit it on the durable event; a content change re-fingerprints and the
  // approval no longer resolves the wait (stale consent never auto-passes).
  const contentFingerprint = (ctx.payload.fingerprint as string) ?? null;
  await ctx.appDb.query(
    `insert into pierre_rt_validations (id, company_id, mission_id, validator_role, required_count, status, reason, risk_context)
     values ($1,$2,$3,$4,1,'pending',$5,$6)`,
    [vId, ctx.companyId, ctx.missionId, String(ctx.payload.validator_role ?? "hr_manager"), String(ctx.payload.reason), JSON.stringify({ step_run_id: ctx.stepRunId, content_fingerprint: contentFingerprint })]);
  return {
    status: "waiting",
    wait: {
      wait_kind: "approval",
      event_kind: "approval.decided",
      object_type: "validation",
      object_id: vId,
      validation_id: vId,
      // the wait is pinned to the prepared content; a content change re-fingerprints and won't resolve.
      expected_fingerprint: (ctx.payload.fingerprint as string) ?? null,
    },
  };
};

// ── communication — NEVER sends email; emits a governed outbox event + runs the P8.4 pipeline ─
const communicationCreateIntent: RuntimeActionHandler = async (ctx) => {
  const eventKind = String(ctx.payload.event_kind);
  const objectId = String(ctx.payload.object_id);
  const occurrence = Number(ctx.payload.occurrence ?? 1);
  // a distinct logical event per occurrence → a distinct source_event_key (a legitimate relance is
  // a new intention, never a merge of two relances). The outbox emission + intent creation are
  // tenant-bound (app.current_company) so they work under the application role with RLS enforced.
  await ctx.appDb.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
    await tx.query(
      `insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key) values ($1,$2,$3,$4,$5) on conflict (company_id, dedup_key) do nothing`,
      [newUuid(), ctx.companyId, eventKind, JSON.stringify({ document_id: objectId, version: occurrence }), `rt:${ctx.stepRunId}:${occurrence}`]);
    await createCommunicationIntents(tx, ctx.tenant, {}, ctx.deps.comm ?? {});
  });
  // R1.5 — re-assert the lease + checkpoint BEFORE the external send; a lost/stale lease aborts the send.
  await ctx.assertLease();
  await ctx.checkpoint("before_external_effect");
  const dispatched = await dispatchCommunicationDeliveries(ctx.appDb, ctx.tenant, { worker: `rt:${ctx.jobId.slice(0, 8)}` }, ctx.deps.comm ?? {});
  await ctx.checkpoint("after_external_submission", `comm:${ctx.stepRunId}:${occurrence}`);
  return ok({ event_kind: eventKind, delivered: dispatched.delivered, submitted: dispatched.submitted });
};

// ── follow-up / relance — creates a durable, bounded schedule (fired by the scheduler) ─
const followUpSchedule: RuntimeActionHandler = async (ctx) => {
  // R1.9 — the FIRST due instant is computed from the typed schedule rule (never a hardcoded delay).
  const rule = buildScheduleRule(ctx.payload);
  const firstRunAt = nextScheduleRunAt(rule, new Date(), 0);
  if (!firstRunAt) return { status: "blocked", blockerCode: "invalid_schedule_rule" };
  // R1.2/R1.4 — governed schedule creation (the app role has no direct DML on runtime_schedules).
  await ctx.appDb.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
    await tx.query(`select pierre_rt_create_runtime_schedule($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
      ctx.companyId, ctx.missionId, ctx.missionRunId, ctx.stepRunId, rule.kind === "once" ? "once" : "recurring",
      (rule as { timezone?: string }).timezone ?? "UTC", firstRunAt.toISOString(), JSON.stringify(rule), ctx.payload.max_occurrences ?? 3, String(ctx.payload.reason),
      JSON.stringify(ctx.payload.communication ?? {}), JSON.stringify(ctx.payload.stop_condition ?? null), `relance:${ctx.stepRunId}`]);
  });
  return ok({ scheduled: true, reason: String(ctx.payload.reason), next_run_at: firstRunAt.toISOString() });
};

// ── signature — REAL P8.3 integration: prepare (governed) → assert-lease → submit (governed) → WAIT on
//    the signature_request_id. The runtime NEVER imports a provider adapter; the provider call happens
//    inside submitContractToSignatureProvider (a Fake P8.3 provider is injected in tests). ──
const signaturePrepare: RuntimeActionHandler = async (ctx) => {
  const contractId = String(ctx.payload.contract_id);
  const idem = `rt-sig:${ctx.stepRunId}`;
  let prep: { signature_request_id: string };
  try {
    prep = await ctx.appDb.transaction(async (tx) => {
      await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
      return prepareContractSignature(tx, ctx.tenant, contractId, { idempotency_key: idem });
    });
  } catch {
    return { status: "blocked", blockerCode: "signature_not_ready" }; // not ready → operator, never a fake send
  }
  // R1.5 — re-assert the lease BEFORE the external provider submission; a lost lease aborts the send.
  await ctx.assertLease();
  await ctx.checkpoint("before_external_effect");
  try {
    await ctx.appDb.transaction(async (tx) => {
      await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
      return submitContractToSignatureProvider(tx, ctx.tenant, contractId, { idempotency_key: idem }, ctx.deps.signature ?? {});
    });
  } catch {
    return { status: "submission_unknown", externalReference: prep.signature_request_id };
  }
  await ctx.checkpoint("after_external_submission", `sig:${prep.signature_request_id}`);
  // R1.6/R1.8 — the wait is bound to the REAL signature_request_id (never just the contract_id)
  return {
    status: "waiting",
    externalReference: prep.signature_request_id,
    wait: { wait_kind: "external_event", event_kind: "signature.completed", object_type: "signature_request", object_id: prep.signature_request_id },
  };
};

// P8.14 §4 — REAL domain computation over tenant-scoped persisted state. Computes a whitelisted HR metric
// from the real pierre_rt_ tables (RLS-scoped), persists the result as a durable artifact, and returns it
// as the step output (server-re-readable). Never fabricates a value; a non-computable metric is a governed
// blocker. 0 is a real computed value, not a stub.
const analyticsCompute: RuntimeActionHandler = async (ctx) => {
  const metric = String(ctx.payload.metric ?? "");
  const result = await ctx.appDb.transaction(async (tx): Promise<Record<string, unknown> | null> => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
    const n = async (sql: string): Promise<number> => Number((await tx.query<{ n: number }>(sql, [ctx.companyId])).rows[0]?.n ?? 0);
    const rows = async (sql: string) => (await tx.query<Record<string, unknown>>(sql, [ctx.companyId])).rows;
    switch (metric) {
      case "headcount": return { active: await n(`select count(*)::int n from pierre_rt_employees where company_id=$1 and status='active'`), total: await n(`select count(*)::int n from pierre_rt_employees where company_id=$1`) };
      case "turnover": { const archived = await n(`select count(*)::int n from pierre_rt_employees where company_id=$1 and status='archived'`); const total = await n(`select count(*)::int n from pierre_rt_employees where company_id=$1`); return { archived, total, rate: total ? Number((archived / total).toFixed(3)) : 0 }; }
      case "absenteeism": case "payroll_absence_recap": return { absences: await n(`select count(*)::int n from pierre_rt_employee_absences where company_id=$1`) };
      case "recruitment_funnel": return { recruitment_missions: await n(`select count(*)::int n from pierre_rt_missions where company_id=$1`) };
      case "completeness_deadlines": return { total: await n(`select count(*)::int n from pierre_rt_employees where company_id=$1`), missing_email: await n(`select count(*)::int n from pierre_rt_employees where company_id=$1 and (email is null or email='')`) };
      case "payroll_anomalies": case "anomaly_surfacing": return { overdue_approvals: await n(`select count(*)::int n from pierre_rt_validations where company_id=$1 and status='pending' and created_at < now() - interval '7 days'`) };
      case "payroll_variables": return { active_employees: await n(`select count(*)::int n from pierre_rt_employees where company_id=$1 and status='active'`) };
      case "payroll_validation": return { pending_validations: await n(`select count(*)::int n from pierre_rt_validations where company_id=$1 and status='pending'`) };
      case "workforce_planning": case "position_budget": case "succession_planning": return { headcount_by_site: await rows(`select coalesce(site_id::text,'none') site, count(*)::int n from pierre_rt_employees where company_id=$1 and status='active' group by site_id`) };
      case "pay_equity": case "compensation_equity": return { headcount_by_role: await rows(`select coalesce(role_title,'unspecified') role, count(*)::int n from pierre_rt_employees where company_id=$1 and status='active' group by role_title`), note: "structural distribution only; no discrimination inference; committee decision required" };
      case "performance_calibration": return { active_employees: await n(`select count(*)::int n from pierre_rt_employees where company_id=$1 and status='active'`) };
      case "executive_report": return { headcount: await n(`select count(*)::int n from pierre_rt_employees where company_id=$1 and status='active'`), open_missions: await n(`select count(*)::int n from pierre_rt_missions where company_id=$1`), pending_approvals: await n(`select count(*)::int n from pierre_rt_validations where company_id=$1 and status='pending'`) };
      default: return null;
    }
  });
  if (result === null) return { status: "blocked", blockerCode: "metric_not_computable" };
  const artifactId = newUuid();
  await ctx.appDb.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
    await tx.query(`insert into pierre_rt_analytics_artifacts (id, company_id, mission_id, metric, result) values ($1,$2,$3,$4,$5::jsonb)`,
      [artifactId, ctx.companyId, ctx.missionId, metric, JSON.stringify(result)]);
  });
  return ok({ metric, artifact_id: artifactId, result, kind: "fact" });
};

// ── document.generate — produces a governed, versioned DRAFT document artifact ─────────
// Reuses the P8.3 DocumentService (createDocument + createVersion) so the authoritative runtime —
// not just the legacy submit path — can genuinely persist a document tied to the mission (+ employee).
// The rendered text is returned as the step output (server-re-readable) and pinned by a content hash
// on the version; a real PDF/DOCX file requires FileTech/storage and is left to a later step (never
// faked here). A draft is safe to produce autonomously; send/sign remain separately gated.
const uuidLike = (v: unknown): v is string => typeof v === "string" && /^[0-9a-fA-F-]{36}$/.test(v);

/** Deterministic professional draft body. Uses caller-provided `content_text` when present (the brain /
 *  DocumentTech renderer produces the rich content upstream); otherwise builds a neutral, non-empty
 *  scaffold from the typed variables so the artifact is never blank. No invented facts. */
export function buildRuntimeDocumentBody(input: {
  document_type: string;
  title: string;
  content_text?: unknown;
  variables?: Record<string, unknown> | null;
}): string {
  if (typeof input.content_text === "string" && input.content_text.trim().length > 0) {
    return input.content_text.trim();
  }
  const vars = input.variables && typeof input.variables === "object" ? input.variables : {};
  const lines: string[] = [];
  lines.push(input.title.trim());
  lines.push("");
  lines.push(`Type de document : ${input.document_type}`);
  for (const [k, v] of Object.entries(vars)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "object") continue;
    lines.push(`${k} : ${String(v)}`);
  }
  lines.push("");
  lines.push("Document préparé par Pierre (brouillon) — à compléter/valider avant tout envoi ou signature.");
  return lines.join("\n");
}

const documentGenerate: RuntimeActionHandler = async (ctx) => {
  const documentType = String(ctx.payload.document_type ?? "generic_hr_document");
  const title = String(ctx.payload.title ?? "Document RH");
  const employeeId = uuidLike(ctx.payload.employee_id) ? String(ctx.payload.employee_id) : null;
  const variables =
    ctx.payload.variables && typeof ctx.payload.variables === "object"
      ? (ctx.payload.variables as Record<string, unknown>)
      : null;

  const bodyText = buildRuntimeDocumentBody({ document_type: documentType, title, content_text: ctx.payload.content_text, variables });
  const contentHash = sha256(Buffer.from(bodyText, "utf8"));
  const contextHash = sha256(Buffer.from(JSON.stringify({ document_type: documentType, employee_id: employeeId, variables: variables ?? {} })));

  try {
    const persisted = await ctx.appDb.transaction(async (tx) => {
      await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
      const doc = await createDocument(tx, ctx.tenant, {
        document_type: documentType,
        title,
        employee_id: employeeId,
        mission_id: ctx.missionId,
      });
      const ver = await createVersion(tx, ctx.tenant, doc.id, {
        content_hash: contentHash,
        generation_context_hash: contextHash,
        change_summary: "Généré par le runtime Pierre (brouillon)",
      });
      return { documentId: doc.id, versionId: ver.id };
    });
    return ok({
      kind: "document",
      document_id: persisted.documentId,
      version_id: persisted.versionId,
      document_type: documentType,
      content_hash: contentHash,
      content_text: bodyText,
      status: "draft",
    });
  } catch (e) {
    // Governance/type refusal (unknown type, missing permission/role) → a governed blocker, never a fake success.
    return { status: "blocked", blockerCode: "document_generation_refused", output: { reason: (e as Error)?.message ?? "refused" } };
  }
};

// ── hr.record.append — persist ONE structured HR record/observation as a canonical event ───────────
// Reusable primitive behind intake/validate/track/classify/detect/reconcile skeleton + domain steps.
// Writes a real pierre_rt_events row (tenant-scoped, mission-linked, traced). Never invents data — it
// records exactly the typed fields the plan supplied. SUCCESS ⇒ a row exists (no success-without-effect).
const hrRecordAppend: RuntimeActionHandler = async (ctx) => {
  const recordType = String(ctx.payload.record_type ?? "hr.record");
  const eventId = newUuid();
  const metadata: Record<string, unknown> = {
    step_run_id: ctx.stepRunId,
    record_type: recordType,
    ...(ctx.payload.data && typeof ctx.payload.data === "object" ? { data: ctx.payload.data } : {}),
    ...(ctx.payload.subject_id ? { subject_id: ctx.payload.subject_id } : {}),
    ...(ctx.payload.note ? { note: String(ctx.payload.note) } : {}),
  };
  await ctx.appDb.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
    await tx.query(
      `insert into pierre_rt_events (id, company_id, mission_id, type, actor_type, actor_id, new_state, metadata)
       values ($1,$2,$3,$4,'runtime',$5,'recorded',$6::jsonb)`,
      [eventId, ctx.companyId, ctx.missionId, `hr.record.${recordType}`, ctx.tenant.user_id, JSON.stringify(metadata)]);
  });
  return ok({ kind: "record", record_id: eventId, record_type: recordType });
};

// ── hr.data.collect — collect declared-required fields; NEEDS_INFORMATION when a required one is absent ─
// input.required_fields: string[]  input.provided: Record<string, unknown>. Empty required => nothing
// missing. On missing => a governed blocker (needs_information) with the exact missing list — never a fake
// success, never invented data. On complete => persists a collection record and succeeds.
const hrDataCollect: RuntimeActionHandler = async (ctx) => {
  const required = Array.isArray(ctx.payload.required_fields)
    ? ctx.payload.required_fields.filter((f): f is string => typeof f === "string")
    : [];
  const provided = ctx.payload.provided && typeof ctx.payload.provided === "object"
    ? (ctx.payload.provided as Record<string, unknown>)
    : {};
  const missing = required.filter((f) => provided[f] === undefined || provided[f] === null || provided[f] === "");
  if (missing.length > 0) {
    return { status: "blocked", blockerCode: "needs_information", output: { missing_fields: missing } };
  }
  const eventId = newUuid();
  await ctx.appDb.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
    await tx.query(
      `insert into pierre_rt_events (id, company_id, mission_id, type, actor_type, actor_id, new_state, metadata)
       values ($1,$2,$3,'hr.data.collected','runtime',$4,'recorded',$5::jsonb)`,
      [eventId, ctx.companyId, ctx.missionId, ctx.tenant.user_id, JSON.stringify({ step_run_id: ctx.stepRunId, required, collected: Object.keys(provided) })]);
  });
  return ok({ kind: "collection", record_id: eventId, collected_fields: Object.keys(provided), required });
};

// ── absence.record.create — a REAL domain BUSINESS-EFFECT (creates an absence row, not a trace) ──────
// Calls the governed P8.3 absence service (createAbsence → pierre_rt_employee_absences + event), so the
// authoritative runtime genuinely persists the business object FK-linked to the employee. A refusal
// (missing employee / permission / bad dates) is a governed blocker, never a fake success.
const absenceRecordCreate: RuntimeActionHandler = async (ctx) => {
  const employeeId = String(ctx.payload.employee_id);
  const type = String(ctx.payload.absence_type);
  const startDate = String(ctx.payload.start_date);
  const endDate = String(ctx.payload.end_date);
  const status = typeof ctx.payload.status === "string" && ctx.payload.status ? String(ctx.payload.status) : "requested";
  try {
    await ctx.appDb.transaction(async (tx) => {
      await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
      await createAbsence(tx, ctx.tenant, employeeId, { type, start_date: startDate, end_date: endDate, status });
    });
  } catch (e) {
    return { status: "blocked", blockerCode: "absence_create_refused", output: { reason: (e as Error)?.message ?? "refused" } };
  }
  return ok({ kind: "absence", employee_id: employeeId, absence_type: type, start_date: startDate, end_date: endDate, status });
};

// ── employee.timeline.append — a REAL Employee-360 business object (typed timeline entry) ────────────
const employeeTimelineAppend: RuntimeActionHandler = async (ctx) => {
  const employeeId = String(ctx.payload.employee_id);
  const entryType = String(ctx.payload.entry_type);
  const metadata = ctx.payload.data && typeof ctx.payload.data === "object" ? (ctx.payload.data as Record<string, unknown>) : {};
  try {
    await ctx.appDb.transaction(async (tx) => {
      await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
      await appendEmployeeTimelineEvent(tx, ctx.tenant, employeeId, { type: `hr.${entryType}`, metadata: { ...metadata, step_run_id: ctx.stepRunId } });
    });
  } catch (e) {
    return { status: "blocked", blockerCode: "employee_timeline_refused", output: { reason: (e as Error)?.message ?? "refused" } };
  }
  return ok({ kind: "employee_timeline_entry", employee_id: employeeId, entry_type: entryType });
};

// ── hr.reconcile.apply — apply an external return, or await it (never fake a reconciliation) ─────────
const hrReconcileApply: RuntimeActionHandler = async (ctx) => {
  const reconcileKind = String(ctx.payload.reconcile_kind);
  const externalReturn = ctx.payload.external_return;
  if (externalReturn === undefined || externalReturn === null) {
    // Inherently external-dependent: without a provider return there is nothing to reconcile yet.
    return {
      status: "waiting",
      wait: { wait_kind: "external_event", event_kind: `reconcile.${reconcileKind}`, object_type: "reconcile", object_id: (ctx.payload.object_id as string) ?? null },
    };
  }
  const eventId = newUuid();
  await ctx.appDb.transaction(async (tx) => {
    await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
    await tx.query(
      `insert into pierre_rt_events (id, company_id, mission_id, type, actor_type, actor_id, new_state, metadata)
       values ($1,$2,$3,$4,'runtime',$5,'reconciled',$6::jsonb)`,
      [eventId, ctx.companyId, ctx.missionId, `hr.reconcile.${reconcileKind}`, ctx.tenant.user_id, JSON.stringify({ step_run_id: ctx.stepRunId, external_return: externalReturn })]);
  });
  return ok({ kind: "reconciliation", record_id: eventId, reconcile_kind: reconcileKind, applied: true });
};

// ── P22 miracle-grade domain business-effect handlers (call governed services, persist real objects) ─
function domainAction(
  run: (tx: SqlExecutor, ctx: RuntimeActionContext) => Promise<Record<string, unknown>>,
  blockerCode: string,
): RuntimeActionHandler {
  return async (ctx) => {
    try {
      const out = await ctx.appDb.transaction(async (tx) => {
        await tx.query(`select set_config('app.current_company', $1, true)`, [ctx.companyId]);
        return run(tx, ctx);
      });
      return ok(out);
    } catch (e) {
      return { status: "blocked", blockerCode, output: { reason: (e as Error)?.message ?? "refused" } };
    }
  };
}

const workforcePlanCreate = domainAction(async (tx, ctx) => {
  const plan = await createWorkforcePlan(tx, ctx.tenant, {
    period: String(ctx.payload.period ?? ""), mission_id: ctx.missionId,
    site_id: (ctx.payload.site_id as string) ?? null,
    current_headcount: Number(ctx.payload.current_headcount ?? 0),
    target_headcount: Number(ctx.payload.target_headcount ?? 0),
    proposed_positions: Array.isArray(ctx.payload.proposed_positions) ? ctx.payload.proposed_positions : [],
    assumptions: (ctx.payload.assumptions as Record<string, unknown>) ?? {},
    estimated_budget: typeof ctx.payload.estimated_budget === "number" ? ctx.payload.estimated_budget : null,
  });
  return { kind: "workforce_plan", plan_id: plan.id, status: plan.status, period: plan.period };
}, "workforce_plan_refused");

const recruitmentCandidateIngest = domainAction(async (tx, ctx) => {
  const cand = await ingestCandidate(tx, ctx.tenant, {
    full_name: String(ctx.payload.full_name ?? ""),
    requisition_id: (ctx.payload.requisition_id as string) ?? null, mission_id: ctx.missionId,
    source: (ctx.payload.source as string) ?? null,
    metadata: (ctx.payload.metadata as Record<string, unknown>) ?? {},
  });
  return { kind: "recruitment_candidate", candidate_id: cand.id, pipeline_stage: cand.pipeline_stage };
}, "recruitment_candidate_refused");

const recruitmentRequisitionCreate = domainAction(async (tx, ctx) => {
  const req = await createRequisition(tx, ctx.tenant, {
    role_title: String(ctx.payload.role_title ?? ""), headcount: Number(ctx.payload.headcount ?? 1),
    mission_id: ctx.missionId, site_id: (ctx.payload.site_id as string) ?? null, contract_type: (ctx.payload.contract_type as string) ?? null,
  });
  return { kind: "recruitment_requisition", requisition_id: req.id, status: req.status };
}, "recruitment_requisition_refused");

const recruitmentApplicationCreate = domainAction(async (tx, ctx) => {
  const app = await createApplication(tx, ctx.tenant, {
    candidate_id: String(ctx.payload.candidate_id ?? ""), requisition_id: (ctx.payload.requisition_id as string) ?? null,
    mission_id: ctx.missionId, source: (ctx.payload.source as string) ?? null, consent: ctx.payload.consent === true,
  });
  return { kind: "recruitment_application", application_id: app.id, status: app.status };
}, "recruitment_application_refused");

const recruitmentInterviewPrepare = domainAction(async (tx, ctx) => {
  const iv = await prepareInterview(tx, ctx.tenant, {
    candidate_id: String(ctx.payload.candidate_id ?? ""), requisition_id: (ctx.payload.requisition_id as string) ?? null,
    mission_id: ctx.missionId, interview_type: (ctx.payload.interview_type as string) ?? "phone",
    scheduled_at: (ctx.payload.scheduled_at as string) ?? null,
    participants: Array.isArray(ctx.payload.participants) ? ctx.payload.participants : [],
    guide_ref: (ctx.payload.guide_ref as string) ?? null,
  });
  return { kind: "recruitment_interview", interview_id: iv.id, status: iv.status };
}, "recruitment_interview_refused");

const recruitmentFeedbackRecord = domainAction(async (tx, ctx) => {
  const fb = await recordFeedback(tx, ctx.tenant, {
    interview_id: String(ctx.payload.interview_id ?? ""), candidate_id: String(ctx.payload.candidate_id ?? ""),
    recommendation: (ctx.payload.recommendation as string) ?? "no_decision",
    criteria: (ctx.payload.criteria as Record<string, unknown>) ?? {}, reservations: (ctx.payload.reservations as string) ?? null,
  });
  return { kind: "recruitment_feedback", feedback_id: fb.id, recommendation: fb.recommendation };
}, "recruitment_feedback_refused");

const recruitmentOfferPrepare = domainAction(async (tx, ctx) => {
  const offer = await prepareOffer(tx, ctx.tenant, {
    candidate_id: String(ctx.payload.candidate_id ?? ""), role_title: String(ctx.payload.role_title ?? ""),
    requisition_id: (ctx.payload.requisition_id as string) ?? null, mission_id: ctx.missionId,
    proposed_comp: (ctx.payload.proposed_comp as Record<string, unknown>) ?? {}, contract_type: (ctx.payload.contract_type as string) ?? null,
    document_id: (ctx.payload.document_id as string) ?? null,
  });
  // status stays 'draft' — the offer is NEVER auto-sent; a human validation gates the send.
  return { kind: "recruitment_offer", offer_id: offer.id, status: offer.status };
}, "recruitment_offer_refused");

const hrRequestCreate = domainAction(async (tx, ctx) => {
  const req = await createHrRequest(tx, ctx.tenant, {
    subject: String(ctx.payload.subject ?? ""), body: (ctx.payload.body as string) ?? null,
    category: (ctx.payload.category as string) ?? "general", priority: (ctx.payload.priority as string) ?? "normal",
    employee_id: (ctx.payload.employee_id as string) ?? null, mission_id: ctx.missionId,
    sla_due_at: (ctx.payload.sla_due_at as string) ?? null,
  });
  return { kind: "hr_request", request_id: req.id, status: req.status, category: req.category };
}, "hr_request_refused");

const countryPackBind = domainAction(async (tx, ctx) => {
  const cfg = await bindCountryPack(tx, ctx.tenant, {
    country_code: String(ctx.payload.country_code ?? ""), pack_key: String(ctx.payload.pack_key ?? ""),
    config: (ctx.payload.config as Record<string, unknown>) ?? {}, status: (ctx.payload.status as string) ?? "active",
  });
  return { kind: "country_config", config_id: cfg.id, country_code: cfg.country_code, pack_key: cfg.pack_key, version: cfg.version };
}, "country_pack_refused");

export const RUNTIME_ACTION_HANDLERS: Record<string, RuntimeActionHandler> = {
  "mission.noop": noop,
  "analytics.compute": analyticsCompute,
  "document.generate": documentGenerate,
  "hr.record.append": hrRecordAppend,
  "hr.data.collect": hrDataCollect,
  "absence.record.create": absenceRecordCreate,
  "employee.timeline.append": employeeTimelineAppend,
  "hr.reconcile.apply": hrReconcileApply,
  "workforce.plan.create": workforcePlanCreate,
  "recruitment.candidate.ingest": recruitmentCandidateIngest,
  "recruitment.requisition.create": recruitmentRequisitionCreate,
  "recruitment.application.create": recruitmentApplicationCreate,
  "recruitment.interview.prepare": recruitmentInterviewPrepare,
  "recruitment.feedback.record": recruitmentFeedbackRecord,
  "recruitment.offer.prepare": recruitmentOfferPrepare,
  "hr.request.create": hrRequestCreate,
  "country.pack.bind": countryPackBind,
  "employee.onboarding.case.create": domainAction(async (tx, ctx) => {
    const c = await createEmployeeOnboardingCase(tx, ctx.tenant, {
      mission_id: ctx.missionId, employee_id: (ctx.payload.employee_id as string) ?? null,
      site_id: (ctx.payload.site_id as string) ?? null, manager_employee_id: (ctx.payload.manager_employee_id as string) ?? null,
      job_title: (ctx.payload.job_title as string) ?? null, start_date: (ctx.payload.start_date as string) ?? null,
      mode: (ctx.payload.mode as OnboardingMode) ?? "copilote", idempotency_key: (ctx.payload.idempotency_key as string) ?? null,
    });
    return { kind: "employee_onboarding_case", case_id: c.id, status: c.status, mode: c.mode };
  }, "onboarding_case_refused"),
  "employee.onboarding.plan.create": domainAction(async (tx, ctx) => {
    const counts = await createDefaultOnboardingPlan(tx, ctx.tenant, String(ctx.payload.case_id ?? ""));
    return { kind: "employee_onboarding_plan", case_id: ctx.payload.case_id, ...counts };
  }, "onboarding_plan_refused"),
  "employee.onboarding.requirement.fulfill": domainAction(async (tx, ctx) => {
    const caseId = String(ctx.payload.case_id ?? "");
    await fulfillOnboardingRequirement(tx, ctx.tenant, caseId, String(ctx.payload.requirement_type ?? ""), (ctx.payload.file_id as string) ?? null);
    const c = await refreshOnboardingReadiness(tx, ctx.tenant, caseId);
    return { kind: "employee_onboarding_requirement", case_id: caseId, case_status: c.status };
  }, "onboarding_requirement_refused"),
  "employee.onboarding.progress.compute": domainAction(async (tx, ctx) => {
    const pct = await computeOnboardingProgress(tx, ctx.tenant, String(ctx.payload.case_id ?? ""));
    return { kind: "employee_onboarding_progress", case_id: ctx.payload.case_id, progress_percent: pct };
  }, "onboarding_progress_refused"),
  "employee.onboarding.step.complete": domainAction(async (tx, ctx) => {
    await completeOnboardingStep(tx, ctx.tenant, String(ctx.payload.case_id ?? ""), String(ctx.payload.step_key ?? ""));
    return { kind: "employee_onboarding_step", case_id: ctx.payload.case_id, step_key: ctx.payload.step_key };
  }, "onboarding_step_refused"),

  // ── PRE-PAYROLL handlers ────────────────────────────────────────────────────────────
  "payroll.period.open": domainAction(async (tx, ctx) => {
    const p = await openPayrollPeriod(tx, ctx.tenant, {
      period_key: String(ctx.payload.period_key ?? ""), starts_on: String(ctx.payload.starts_on ?? ""), ends_on: String(ctx.payload.ends_on ?? ""),
      mission_id: ctx.missionId, mode: (ctx.payload.mode as PayrollMode) ?? "copilote", idempotency_key: (ctx.payload.idempotency_key as string) ?? null,
    });
    return { kind: "payroll_period", period_id: p.id, status: p.status, population: p.population_count };
  }, "payroll_period_refused"),
  "payroll.population.collect": domainAction(async (tx, ctx) => {
    const r = await collectVariablesFromAbsences(tx, ctx.tenant, String(ctx.payload.period_id ?? ""));
    return { kind: "payroll_collection", period_id: ctx.payload.period_id, variables_created: r.created };
  }, "payroll_collect_refused"),
  "payroll.variable.create": domainAction(async (tx, ctx) => {
    const v = await createPayrollVariable(tx, ctx.tenant, String(ctx.payload.period_id ?? ""), {
      employee_id: String(ctx.payload.employee_id ?? ""), variable_type: String(ctx.payload.variable_type ?? ""),
      quantity: typeof ctx.payload.quantity === "number" ? ctx.payload.quantity : null, amount: typeof ctx.payload.amount === "number" ? ctx.payload.amount : null,
      starts_on: (ctx.payload.starts_on as string) ?? null, ends_on: (ctx.payload.ends_on as string) ?? null,
      validation_required: ctx.payload.validation_required === true,
    });
    return { kind: "payroll_variable", variable_id: v.id, status: v.status };
  }, "payroll_variable_refused"),
  "payroll.variable.evidence.attach": domainAction(async (tx, ctx) => {
    await attachPayrollEvidence(tx, ctx.tenant, String(ctx.payload.variable_id ?? ""), (ctx.payload.file_id as string) ?? null);
    return { kind: "payroll_evidence", variable_id: ctx.payload.variable_id };
  }, "payroll_evidence_refused"),
  "payroll.variable.validate": domainAction(async (tx, ctx) => {
    await validatePayrollVariable(tx, ctx.tenant, String(ctx.payload.variable_id ?? ""));
    return { kind: "payroll_variable_validated", variable_id: ctx.payload.variable_id };
  }, "payroll_variable_validate_refused"),
  "payroll.anomaly.detect": domainAction(async (tx, ctx) => {
    const r = await detectPayrollAnomalies(tx, ctx.tenant, String(ctx.payload.period_id ?? ""));
    return { kind: "payroll_anomalies", period_id: ctx.payload.period_id, anomalies_created: r.created };
  }, "payroll_anomaly_refused"),
  "payroll.readiness.compute": domainAction(async (tx, ctx) => {
    const p = await computePayrollReadiness(tx, ctx.tenant, String(ctx.payload.period_id ?? ""));
    return { kind: "payroll_readiness", period_id: p.id, status: p.status };
  }, "payroll_readiness_refused"),
  "payroll.export.generate": domainAction(async (tx, ctx) => {
    const e = await generatePayrollExport(tx, ctx.tenant, String(ctx.payload.period_id ?? ""), (ctx.payload.format as "csv" | "xlsx" | "canonical_json") ?? "csv");
    return { kind: "payroll_export", export_id: e.export_id, row_count: e.row_count, hash: e.hash, status: e.status };
  }, "payroll_export_refused"),
  "payroll.provider_return.reconcile": domainAction(async (tx, ctx) => {
    const r = await reconcilePayrollProviderReturn(tx, ctx.tenant, String(ctx.payload.period_id ?? ""), {
      export_id: (ctx.payload.export_id as string) ?? null, provider: String(ctx.payload.provider ?? "test_provider"),
      provider_event_id: String(ctx.payload.provider_event_id ?? ""), result_status: (ctx.payload.result_status as "accepted" | "partially_rejected" | "rejected") ?? "accepted",
      accepted_rows: Number(ctx.payload.accepted_rows ?? 0), rejected_rows: Number(ctx.payload.rejected_rows ?? 0), errors: Array.isArray(ctx.payload.errors) ? ctx.payload.errors : [],
    });
    return { kind: "payroll_reconciliation", reconciliation_id: r.reconciliation_id, applied: r.applied, deduped: r.deduped };
  }, "payroll_reconcile_refused"),
  "payroll.brief.generate": domainAction(async (tx, ctx) => {
    const brief = await buildPayrollBrief(tx, ctx.tenant, String(ctx.payload.period_id ?? ""));
    return { kind: "payroll_brief", period_id: ctx.payload.period_id, brief };
  }, "payroll_brief_refused"),

  // ── PERFORMANCE handlers ────────────────────────────────────────────────────────────
  "performance.campaign.create": domainAction(async (tx, ctx) => {
    const c = await createPerformanceCampaign(tx, ctx.tenant, {
      campaign_key: String(ctx.payload.campaign_key ?? ""), title: String(ctx.payload.title ?? ""), campaign_type: (ctx.payload.campaign_type as string) ?? "annual_review",
      starts_on: (ctx.payload.starts_on as string) ?? null, ends_on: (ctx.payload.ends_on as string) ?? null, mode: (ctx.payload.mode as PerfMode) ?? "copilote", mission_id: ctx.missionId, idempotency_key: (ctx.payload.idempotency_key as string) ?? null,
    });
    return { kind: "performance_campaign", campaign_id: c.id, status: c.status, mode: c.mode };
  }, "performance_campaign_refused"),
  "performance.campaign.population.build": domainAction(async (tx, ctx) => {
    const r = await buildCampaignPopulation(tx, ctx.tenant, String(ctx.payload.campaign_id ?? ""));
    return { kind: "performance_population", campaign_id: ctx.payload.campaign_id, added: r.added, population: r.population };
  }, "performance_population_refused"),
  "performance.interview.create": domainAction(async (tx, ctx) => {
    const iv = await createPerformanceInterview(tx, ctx.tenant, String(ctx.payload.campaign_id ?? ""), String(ctx.payload.participant_id ?? ""));
    return { kind: "performance_interview", interview_id: iv.id, status: iv.status };
  }, "performance_interview_refused"),
  "performance.response.record": domainAction(async (tx, ctx) => {
    await recordPerformanceResponse(tx, ctx.tenant, String(ctx.payload.interview_id ?? ""), {
      respondent_type: (ctx.payload.respondent_type as "employee" | "manager" | "hr") ?? "manager", question_key: String(ctx.payload.question_key ?? ""), response: String(ctx.payload.response ?? ""), visibility: (ctx.payload.visibility as "restricted" | "shared") ?? "restricted",
    });
    return { kind: "performance_response", interview_id: ctx.payload.interview_id };
  }, "performance_response_refused"),
  "performance.summary.generate": domainAction(async (tx, ctx) => {
    const s = await buildPerformanceSummary(tx, ctx.tenant, String(ctx.payload.interview_id ?? ""));
    return { kind: "performance_summary", summary_id: s.id, status: s.status };
  }, "performance_summary_refused"),
  "performance.summary.submit_for_validation": domainAction(async (tx, ctx) => {
    const r = await submitPerformanceSummaryForValidation(tx, ctx.tenant, String(ctx.payload.interview_id ?? ""), ctx.missionId);
    return { kind: "performance_summary_submitted", interview_id: ctx.payload.interview_id, validation_id: r.validation_id };
  }, "performance_summary_submit_refused"),
  "performance.summary.apply_validation": domainAction(async (tx, ctx) => {
    const r = await applyPerformanceSummaryValidation(tx, ctx.tenant, String(ctx.payload.interview_id ?? ""));
    return { kind: "performance_summary_applied", interview_id: ctx.payload.interview_id, status: r.status };
  }, "performance_summary_apply_refused"),
  "performance.interview.complete": domainAction(async (tx, ctx) => {
    const r = await completePerformanceInterview(tx, ctx.tenant, String(ctx.payload.interview_id ?? ""));
    return { kind: "performance_interview_completed", interview_id: ctx.payload.interview_id, completed: r.completed };
  }, "performance_interview_complete_refused"),
  "performance.action_plan.create": domainAction(async (tx, ctx) => {
    const p = await createPerformanceActionPlan(tx, ctx.tenant, {
      title: String(ctx.payload.title ?? ""), employee_id: (ctx.payload.employee_id as string) ?? null, interview_id: (ctx.payload.interview_id as string) ?? null,
      campaign_id: (ctx.payload.campaign_id as string) ?? null, owner: (ctx.payload.owner as string) ?? null,
    });
    return { kind: "performance_action_plan", plan_id: p.id, status: p.status };
  }, "performance_action_plan_refused"),
  "performance.action_plan.validate": domainAction(async (tx, ctx) => {
    const r = await validatePerformanceActionPlan(tx, ctx.tenant, String(ctx.payload.plan_id ?? ""));
    return { kind: "performance_action_plan_validated", plan_id: ctx.payload.plan_id, status: r.status };
  }, "performance_action_plan_validate_refused"),
  "performance.action_item.create": domainAction(async (tx, ctx) => {
    const a = await createPerformanceActionItem(tx, ctx.tenant, {
      action: String(ctx.payload.action ?? ""), employee_id: (ctx.payload.employee_id as string) ?? null, interview_id: (ctx.payload.interview_id as string) ?? null,
      campaign_id: (ctx.payload.campaign_id as string) ?? null, owner: (ctx.payload.owner as string) ?? null, due_on: (ctx.payload.due_on as string) ?? null,
      plan_id: (ctx.payload.plan_id as string) ?? null, plan_key: (ctx.payload.plan_key as string) ?? null,
    });
    return { kind: "performance_action_item", action_item_id: a.id };
  }, "performance_action_item_refused"),
  "performance.objective.create": domainAction(async (tx, ctx) => {
    const o = await createPerformanceObjective(tx, ctx.tenant, {
      employee_id: String(ctx.payload.employee_id ?? ""), title: String(ctx.payload.title ?? ""), interview_id: (ctx.payload.interview_id as string) ?? null,
      campaign_id: (ctx.payload.campaign_id as string) ?? null, success_criteria: (ctx.payload.success_criteria as string) ?? null, due_on: (ctx.payload.due_on as string) ?? null,
    });
    return { kind: "performance_objective", objective_id: o.id };
  }, "performance_objective_refused"),
  "performance.overdue.detect": domainAction(async (tx, ctx) => {
    const r = await detectOverduePerformanceItems(tx, ctx.tenant, String(ctx.payload.as_of ?? ""));
    return { kind: "performance_overdue", overdue: r.overdue };
  }, "performance_overdue_refused"),
  "performance.template.section.add": domainAction(async (tx, ctx) => {
    const s = await addPerformanceTemplateSection(tx, ctx.tenant, {
      template_id: String(ctx.payload.template_id ?? ""), section_key: String(ctx.payload.section_key ?? ""), title: String(ctx.payload.title ?? ""),
      ordinal: typeof ctx.payload.ordinal === "number" ? ctx.payload.ordinal : 0, audience: (ctx.payload.audience as string) ?? "both", required: ctx.payload.required !== false,
    });
    return { kind: "performance_template_section", section_id: s.id };
  }, "performance_template_section_refused"),
  "performance.template.question.add": domainAction(async (tx, ctx) => {
    const q = await addPerformanceTemplateQuestion(tx, ctx.tenant, {
      section_id: String(ctx.payload.section_id ?? ""), question_key: String(ctx.payload.question_key ?? ""), label: String(ctx.payload.label ?? ""),
      response_type: (ctx.payload.response_type as string) ?? "text", required: ctx.payload.required !== false, visibility: (ctx.payload.visibility as string) ?? "restricted",
      ordinal: typeof ctx.payload.ordinal === "number" ? ctx.payload.ordinal : 0,
    });
    return { kind: "performance_template_question", question_id: q.id };
  }, "performance_template_question_refused"),
  "performance.response.completeness.validate": domainAction(async (tx, ctx) => {
    const r = await validateInterviewResponseCompleteness(tx, ctx.tenant, String(ctx.payload.interview_id ?? ""));
    return { kind: "performance_response_completeness", interview_id: ctx.payload.interview_id, complete: r.complete, missing: r.missing, total_required: r.total_required };
  }, "performance_response_completeness_refused"),
  "performance.report.generate": domainAction(async (tx, ctx) => {
    const r = await generatePerformanceReport(tx, ctx.tenant, String(ctx.payload.campaign_id ?? ""));
    return { kind: "performance_report", ...r };
  }, "performance_report_refused"),
  "performance.reminders.send": domainAction(async (tx, ctx) => {
    const r = await sendPerformanceReminders(tx, ctx.tenant, String(ctx.payload.campaign_id ?? ""));
    return { kind: "performance_reminders", recipients: r.recipients, delivered: r.delivered, status: r.status };
  }, "performance_reminders_refused"),

  // ── TRAINING handlers ───────────────────────────────────────────────────────────────
  "training.requirement.create": domainAction(async (tx, ctx) => {
    const r = await createTrainingRequirement(tx, ctx.tenant, {
      requirement_key: String(ctx.payload.requirement_key ?? ""), title: String(ctx.payload.title ?? ""), source_type: (ctx.payload.source_type as string) ?? "unsourced",
      source_ref: (ctx.payload.source_ref as string) ?? null, mandatory: ctx.payload.mandatory === true, recurrence_rule: (ctx.payload.recurrence_rule as string) ?? null,
      validity_months: typeof ctx.payload.validity_months === "number" ? ctx.payload.validity_months : null, applies_to: (ctx.payload.applies_to as string) ?? "all", mission_id: ctx.missionId,
      proof_required: ctx.payload.proof_required === true,
    });
    return { kind: "training_requirement", requirement_id: r.id, status: r.status };
  }, "training_requirement_refused"),
  "training.session.create": domainAction(async (tx, ctx) => {
    const s = await createTrainingSession(tx, ctx.tenant, {
      title: String(ctx.payload.title ?? ""), requirement_id: (ctx.payload.requirement_id as string) ?? null, provider: (ctx.payload.provider as string) ?? null,
      delivery_mode: (ctx.payload.delivery_mode as string) ?? "onsite", starts_at: (ctx.payload.starts_at as string) ?? null, ends_at: (ctx.payload.ends_at as string) ?? null, capacity: typeof ctx.payload.capacity === "number" ? ctx.payload.capacity : null,
    });
    return { kind: "training_session", session_id: s.id, status: s.status };
  }, "training_session_refused"),
  "training.enrollment.create": domainAction(async (tx, ctx) => {
    const e = await createTrainingEnrollment(tx, ctx.tenant, {
      session_id: String(ctx.payload.session_id ?? ""), employee_id: String(ctx.payload.employee_id ?? ""), requirement_id: (ctx.payload.requirement_id as string) ?? null, mode: (ctx.payload.mode as TrainingMode) ?? "copilote",
    });
    return { kind: "training_enrollment", enrollment_id: e.id, status: e.status, deduped: e.deduped };
  }, "training_enrollment_refused"),
  "training.attendance.record": domainAction(async (tx, ctx) => {
    await recordTrainingAttendance(tx, ctx.tenant, String(ctx.payload.enrollment_id ?? ""), (ctx.payload.attendance_status as "present" | "absent" | "partial" | "excused") ?? "present");
    return { kind: "training_attendance", enrollment_id: ctx.payload.enrollment_id };
  }, "training_attendance_refused"),
  "training.proof.attach": domainAction(async (tx, ctx) => {
    const p = await attachTrainingProof(tx, ctx.tenant, String(ctx.payload.enrollment_id ?? ""), { proof_type: (ctx.payload.proof_type as string) ?? "attestation", file_id: (ctx.payload.file_id as string) ?? null, issued_on: (ctx.payload.issued_on as string) ?? null });
    return { kind: "training_proof", proof_id: p.id };
  }, "training_proof_refused"),
  "training.proof.verify": domainAction(async (tx, ctx) => {
    const r = await verifyTrainingProof(tx, ctx.tenant, String(ctx.payload.proof_id ?? ""), String(ctx.payload.verified_on ?? ""));
    return { kind: "training_proof_verified", proof_id: ctx.payload.proof_id, status: r.status };
  }, "training_proof_verify_refused"),
  "training.requirement.validate_source": domainAction(async (tx, ctx) => {
    const r = await validateTrainingRequirementSource(tx, ctx.tenant, String(ctx.payload.requirement_key ?? ""));
    return { kind: "training_requirement_source", requirement_key: ctx.payload.requirement_key, status: r.status, reason: r.reason };
  }, "training_requirement_source_refused"),
  "training.certification.issue": domainAction(async (tx, ctx) => {
    const c = await issueTrainingCertification(tx, ctx.tenant, {
      employee_id: String(ctx.payload.employee_id ?? ""), certification_key: String(ctx.payload.certification_key ?? ""), proof_id: String(ctx.payload.proof_id ?? ""),
      requirement_id: (ctx.payload.requirement_id as string) ?? null, issued_on: String(ctx.payload.issued_on ?? ""), validity_months: typeof ctx.payload.validity_months === "number" ? ctx.payload.validity_months : null,
    });
    return { kind: "training_certification", certification_id: c.id, status: c.status, expires_on: c.expires_on };
  }, "training_certification_refused"),
  "training.expiry.detect": domainAction(async (tx, ctx) => {
    const r = await detectExpiringCertifications(tx, ctx.tenant, String(ctx.payload.as_of ?? ""), typeof ctx.payload.expiring_within_days === "number" ? ctx.payload.expiring_within_days : 60);
    return { kind: "training_expiry", expiring: r.expiring, expired: r.expired, renewals: r.renewals };
  }, "training_expiry_refused"),
  "training.enrollment.complete": domainAction(async (tx, ctx) => {
    const r = await completeTrainingEnrollment(tx, ctx.tenant, String(ctx.payload.enrollment_id ?? ""));
    // An honest, non-completing outcome (proof required/unverified) is a governed BLOCK, not a fake success.
    if (!r.completed) throw Errors.conflict(r.blocker ?? "Enrollment not completable");
    return { kind: "training_enrollment_completed", enrollment_id: ctx.payload.enrollment_id, completed: true };
  }, "training_enrollment_complete_refused"),
  "training.plan.create": domainAction(async (tx, ctx) => {
    const p = await createTrainingPlan(tx, ctx.tenant, {
      plan_key: String(ctx.payload.plan_key ?? ""), title: String(ctx.payload.title ?? ""), mode: (ctx.payload.mode as TrainingMode) ?? "copilote",
      mission_id: ctx.missionId, idempotency_key: (ctx.payload.idempotency_key as string) ?? null,
    });
    return { kind: "training_plan", plan_id: p.id, status: p.status };
  }, "training_plan_refused"),
  "training.plan.item.add": domainAction(async (tx, ctx) => {
    const it = await addTrainingPlanItem(tx, ctx.tenant, String(ctx.payload.plan_id ?? ""), {
      requirement_id: (ctx.payload.requirement_id as string) ?? null, source_type: (ctx.payload.source_type as string) ?? "company_policy",
      source_ref: (ctx.payload.source_ref as string) ?? null, priority: (ctx.payload.priority as string) ?? "normal", session_id: (ctx.payload.session_id as string) ?? null,
    });
    return { kind: "training_plan_item", plan_item_id: it.id };
  }, "training_plan_item_refused"),
  "training.plan.complete": domainAction(async (tx, ctx) => {
    const r = await completeTrainingPlan(tx, ctx.tenant, String(ctx.payload.plan_id ?? ""));
    return { kind: "training_plan_completed", plan_id: ctx.payload.plan_id, completed: r.completed, open_items: r.open_items };
  }, "training_plan_complete_refused"),
  "training.report.generate": domainAction(async (tx, ctx) => {
    const r = await generateTrainingReport(tx, ctx.tenant);
    return { kind: "training_report", ...r };
  }, "training_report_refused"),
  "training.invitations.send": domainAction(async (tx, ctx) => {
    const r = await sendTrainingInvitations(tx, ctx.tenant, String(ctx.payload.session_id ?? ""));
    return { kind: "training_invitations", recipients: r.recipients, delivered: r.delivered, status: r.status };
  }, "training_invitations_refused"),
  "mission.complete": complete,
  "mission.block": block,
  "employee.read": readObject("pierre_rt_employees", "employee_id"),
  "contract.read": readObject("pierre_rt_employee_contracts", "contract_id"),
  "document.read": readObject("pierre_rt_documents", "document_id"),
  "wait.until_time": waitUntilTime,
  "wait.for_event": waitForEvent,
  "approval.request": approvalRequest,
  "communication.create_intent": communicationCreateIntent,
  "follow_up.schedule": followUpSchedule,
  "signature.prepare": signaturePrepare,
};

export function getRuntimeActionHandler(actionKey: string): RuntimeActionHandler | null {
  return RUNTIME_ACTION_HANDLERS[actionKey] ?? null;
}
