// src/app/api/pierre/v1/missions/[id]/runtime/route.ts
// PHASE 8.5 §42 — authenticated mission runtime surface. GET returns the latest run's durable state
// (run + steps + jobs + waits, no secret/PII); POST applies a governed operator control
// (pause/resume/cancel). A client can NEVER complete a job, resolve a wait, or fabricate a status —
// those are worker/scheduler-only governed functions, absent from this surface.
import { NextResponse } from "next/server";
import { withProductAccess, jsonBody } from "../../../_runtime";
import { pauseMissionRun, resumeMissionRun, requestCancelMissionRun } from "@/lib/pierre/v1/runtime-service";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import type { TenantContext } from "@/lib/pierre/v1/tenant-context";

export const runtime = "nodejs";

async function latestRunId(db: SqlExecutor, ctx: TenantContext, missionId: string): Promise<string | null> {
  const r = await db.query<{ id: string }>(`select id from pierre_rt_mission_runs where company_id=$1 and mission_id=$2 order by run_number desc limit 1`, [ctx.company_id, missionId]);
  return r.rows[0]?.id ?? null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "read", async (db, ctx) => {
    const runId = await latestRunId(db, ctx, id);
    if (!runId) return { run: null, steps: [], jobs: [], waits: [] };
    const run = (await db.query(`select id, mission_id, plan_version_id, run_number, status, autonomy_level, current_blocker_code, started_at, completed_at from pierre_rt_mission_runs where company_id=$1 and id=$2`, [ctx.company_id, runId])).rows[0];
    const steps = (await db.query(`select step_key, action_key, status, step_ordinal, waiting_reason, blocker_code from pierre_rt_step_runs where company_id=$1 and mission_run_id=$2 order by step_ordinal asc`, [ctx.company_id, runId])).rows;
    const jobs = (await db.query(`select id, action_key, status, attempt_count, fencing_token, next_retry_at from pierre_rt_runtime_jobs where company_id=$1 and mission_run_id=$2`, [ctx.company_id, runId])).rows;
    const waits = (await db.query(`select wait_kind, event_kind, status, wake_at from pierre_rt_runtime_waits where company_id=$1 and mission_run_id=$2`, [ctx.company_id, runId])).rows;
    return { run, steps, jobs, waits };
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "write_standard", async (db, ctx) => {
    const body = await jsonBody<{ action?: string }>(req);
    const runId = await latestRunId(db, ctx, id);
    if (!runId) return { ok: false, error: "no_run" };
    if (body.action === "pause") await pauseMissionRun(db, ctx, runId);
    else if (body.action === "resume") await resumeMissionRun(db, ctx, runId);
    else if (body.action === "cancel") await requestCancelMissionRun(db, ctx, runId);
    else return { ok: false, error: "unknown_action" };
    return { ok: true, action: body.action, mission_run_id: runId };
  });
}
