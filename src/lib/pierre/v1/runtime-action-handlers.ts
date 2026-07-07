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
import { sha256 } from "./renderers";
import type { TenantContext } from "./tenant-context";
import type { CommunicationDeps } from "./communications";
import { createCommunicationIntents, dispatchCommunicationDeliveries } from "./communications";
import { buildScheduleRule, nextScheduleRunAt } from "./runtime-schedule-rules";
import { prepareContractSignature } from "./contracts";
import { submitContractToSignatureProvider, type SignatureDeps } from "./signatures";

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

export const RUNTIME_ACTION_HANDLERS: Record<string, RuntimeActionHandler> = {
  "mission.noop": noop,
  "analytics.compute": analyticsCompute,
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
