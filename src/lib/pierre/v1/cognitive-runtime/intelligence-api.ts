// src/lib/pierre/v1/cognitive-runtime/intelligence-api.ts
// PHASE 8.14 — the db/ctx-bound API layer the 5 intelligence routes call via withProductAccess. Interpret
// + preview are new cognitive capability; execution/status/cancel DELEGATE to the existing governed
// mission service (already cognitive) — no second runtime, no duplicated persistence.

import { apiCreateMission, apiGetMission, apiCancelMission } from "../api";
import { runPierreRuntimeJobs } from "../runtime-service";
import { runIntelligenceRequest } from "./intelligence-service";
import { continueCognitiveOperation } from "./continuation";
import { runProactiveDetectionTick } from "./proactive-detection";
import type { IntelligenceResponse } from "./p9-contract";

type Db = Parameters<typeof apiGetMission>[0];
type Ctx = Parameters<typeof apiGetMission>[1] & { company_id: string; user_id: string; request_id?: string; correlation_id?: string };

const nowIso = (): string => new Date().toISOString();
function reqId(ctx: Ctx): string { return ctx.request_id ?? ctx.correlation_id ?? `req-${ctx.company_id}-${ctx.user_id}`; }

/** POST /intelligence/request — interpret + clarify + (plan preview | analytics). No writes. */
export async function apiIntelligenceRequest(db: Db, ctx: Ctx, body: { instruction: string }): Promise<IntelligenceResponse> {
  return runIntelligenceRequest({
    requestId: reqId(ctx), companyId: ctx.company_id, actorId: ctx.user_id,
    instruction: String(body.instruction ?? ""), nowIso: nowIso(),
  }, { db }); // db → OPTIMIZATION/MONITORING dispatch to the real analytics engines
}

/** POST /intelligence/confirm — execute through the existing governed mission service (real persistence). */
export async function apiIntelligenceConfirm(db: Db, ctx: Ctx, body: { instruction: string; employee_id?: string | null; site_id?: string | null; autonomy_mode?: string; idempotency_key?: string }) {
  const mission = await apiCreateMission(db, ctx, {
    instruction: String(body.instruction ?? ""), source: "intelligence",
    employee_id: body.employee_id ?? null, site_id: body.site_id ?? null,
    autonomy_mode: body.autonomy_mode as never, idempotency_key: body.idempotency_key,
  });
  return { ok: true, mission };
}

/** GET /intelligence/status — the real, server-re-read mission state (deep-link target for P9). */
export async function apiIntelligenceStatus(db: Db, ctx: Ctx, missionId: string) {
  return apiGetMission(db, ctx, missionId);
}

/** POST /intelligence/continue — the AUTHORITATIVE continuation loop: reload the durable cognitive op,
 *  drive the real worker to resume, persist the advanced terminal state. */
export async function apiIntelligenceContinue(db: Db, ctx: Ctx, operationId: string) {
  return continueCognitiveOperation(db as never, ctx as never, operationId, {
    runWorker: async () => { for (let i = 0; i < 5; i++) await runPierreRuntimeJobs(db as never, ctx as never, { worker: "intelligence" }); },
    nowIso: nowIso(),
  });
}

/** POST /intelligence/proactive-tick — run one proactive detection tick for this tenant (cron/operator
 *  entry): detect → dedup → prioritize → open governed missions. */
export async function apiIntelligenceProactiveTick(db: Db, ctx: Ctx) {
  return runProactiveDetectionTick(db as never, ctx as never, nowIso());
}

/** POST /intelligence/cancel — governed cancellation via the existing service. */
export async function apiIntelligenceCancel(db: Db, ctx: Ctx, missionId: string) {
  return apiCancelMission(db, ctx, missionId);
}
