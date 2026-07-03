// src/lib/pierre/v1/cognitive-runtime/execution-controller.ts
// PHASE 8.14 — executes a cognitive plan through the REAL P8 run engine (stack C). Thin orchestration:
// it hands a compiled RuntimePlanInput to the existing createMissionRunFromPlan (which re-compiles with
// compileMissionPlan as the authority) + drives the durable worker via runPierreRuntimeJobs. NO 2nd
// runtime. Nothing is fabricated: the caller re-reads server state to confirm effects (see evidence.ts).

import { createMissionRunFromPlan, runPierreRuntimeJobs } from "../runtime-service";
import type { GeneratedPlan } from "./plan-generator";
import { CognitiveError } from "./errors";

type CreateDb = Parameters<typeof createMissionRunFromPlan>[0];
type Ctx = Parameters<typeof createMissionRunFromPlan>[1];
type CreateDeps = Parameters<typeof createMissionRunFromPlan>[3];

export type ExecutionStart = { ok: boolean; missionRunId: string | null; planVersionId: string | null; blockers: readonly string[] };

/**
 * Create a REAL mission run in the P8 run engine from a cognitively-generated, COMPILED plan. The
 * fingerprinted plan is passed straight into createMissionRunFromPlan (it is NOT discarded). Fail-closed:
 * an uncompiled plan is refused; an invented-action plan throws. `deps` lets integration tests inject the
 * planner runner; production uses the default DB planner.
 */
export async function startCognitiveExecution(
  db: CreateDb, ctx: Ctx,
  input: { missionId: string; plan: GeneratedPlan; autonomy?: string; createdBy?: string | null },
  deps?: CreateDeps,
): Promise<ExecutionStart> {
  if (!input.plan.compiled.ok) {
    // never hand an uncompiled/invalid plan to the engine
    return { ok: false, missionRunId: null, planVersionId: null, blockers: input.plan.blockers };
  }
  if (input.plan.inventedActions > 0) throw new CognitiveError("INVENTED_ACTION", `${input.plan.inventedActions} step(s) dropped`);

  const res = await createMissionRunFromPlan(db, ctx, {
    mission_id: input.missionId,
    plan: input.plan.planInput,
    autonomy: input.autonomy ?? "normal",
    created_by: input.createdBy ?? null,
  }, deps ?? {});
  if (!res.ok) return { ok: false, missionRunId: null, planVersionId: null, blockers: res.blockers };
  return { ok: true, missionRunId: res.mission_run_id ?? null, planVersionId: res.plan_version_id ?? null, blockers: [] };
}

/** Drive the durable worker loop (real fencing/lease). Returns whatever the engine reports. */
export async function driveCognitiveWorker(...args: Parameters<typeof runPierreRuntimeJobs>): ReturnType<typeof runPierreRuntimeJobs> {
  return runPierreRuntimeJobs(...args);
}
