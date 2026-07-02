// src/app/api/pierre/v1/missions/first/route.ts
// PHASE 8.6 — "Lancer la première mission de Pierre". Authenticated, tenant resolved server-side, gated
// WRITE_COSTLY (product access + permissions). It creates a REAL mission and a governed P8.5 run from a
// canonical plan (approval gate → completion) via createMissionRunFromPlan under the planner role. It
// NEVER marks the mission completed — that happens only through the real worker/scheduler after a real
// validation decision.
import { withProductAccess, jsonBody } from "../../_runtime";
import { withTenantTransaction } from "@/lib/pierre/v1/tenant-tx";
import { createMissionRunFromPlan } from "@/lib/pierre/v1/runtime-service";
import { withRuntimePlannerTransaction } from "@/lib/pierre/v1/runtime-planner-db";
import { newUuid, newCorrelationId, newRequestId } from "@/lib/pierre/v1/sql";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withProductAccess(req, "write_costly", async (db, ctx) => {
    await jsonBody(req); // body is ignored — the plan is canonical, never client-supplied
    const missionId = newUuid();
    // the real mission row (planned) — the run/steps/validation are produced by the governed planner.
    await withTenantTransaction(db, { company_id: ctx.company_id, user_id: ctx.user_id }, (tx) =>
      tx.query(
        `insert into pierre_rt_missions (id, company_id, requester_user_id, instruction, status, correlation_id, request_id, idempotency_key)
         values ($1,$2,$3,$4,'planned',$5,$6,$7)`,
        [missionId, ctx.company_id, ctx.user_id, "Préparer l'arrivée d'un salarié", newCorrelationId(), newRequestId(), `first-mission:${missionId}`]));
    const created = await createMissionRunFromPlan(db, ctx, {
      mission_id: missionId,
      created_by: ctx.user_id,
      plan: { steps: [
        { step_key: "approve", action_key: "approval.request", input: { reason: "Valider la première mission de Pierre", fingerprint: "FIRST_MISSION_V1" } },
        { step_key: "done", action_key: "mission.complete", depends_on: ["approve"] },
      ] },
    }, { runPlanner: withRuntimePlannerTransaction });
    if (!created.ok) return { ok: false, blockers: created.blockers };
    return { ok: true, mission_id: missionId, run_id: created.mission_run_id, status: "running", next_action: "await_validation" };
  });
}
