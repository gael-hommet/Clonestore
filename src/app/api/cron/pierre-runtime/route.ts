// GET|POST /api/cron/pierre-runtime — Pierre autonomous continuity tick.
//
// This is the automatic trigger for Pierre's durable runtime scheduler (lease recovery, DB-native
// timer waits/wakes, idempotent event drain, bounded relances — NEVER a business action directly).
// Vercel cron fires this route (GET) with `Authorization: Bearer $CRON_SECRET`.
//
// FAIL-CLOSED by design (see cron-gate.ts): does nothing unless the owner set
// PIERRE_CONTINUITY_CRON_ENABLED="true" AND a valid cron/runtime secret is presented. This means
// deploying the code does NOT by itself start autonomous operation — that is an explicit owner
// decision, kept reversible by a single env flag.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import {
  claimRuntimeTenantLeases,
  completeRuntimeTenantLease,
  failRuntimeTenantLease,
  resolveRuntimeSystemContext,
} from "@/lib/pierre/v1/runtime-system-auth";
import { createRuntimeSchedulerExecutor } from "@/lib/pierre/v1/runtime-scheduler-db";
import { runPierreRuntimeScheduler } from "@/lib/pierre/v1/runtime-scheduler";
import { decideContinuityCron } from "@/lib/pierre/continuity/cron-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const decision = decideContinuityCron(req.headers);

  if (decision.action === "disabled") {
    // Not an error — the cron is wired but intentionally off. 200 keeps Vercel cron green.
    return NextResponse.json({ ok: true, skipped: "continuity_cron_disabled", reason: decision.reason });
  }
  if (decision.action === "unconfigured") {
    return NextResponse.json({ ok: false, error: "cron_not_configured", reason: decision.reason }, { status: 503 });
  }
  if (decision.action === "unauthorized") {
    return NextResponse.json({ ok: false, error: "unauthorized", reason: decision.reason }, { status: 401 });
  }

  // action === "run": execute the SAME durable scheduler the system POST route uses, in-process.
  const appDb = await getRuntimeDb();
  const schedulerDb = await createRuntimeSchedulerExecutor(); // fail-closed least-privilege role
  const leases = await claimRuntimeTenantLeases(schedulerDb, "scheduler", 50);
  const results: Array<{ company_id: string; ok: boolean }> = [];

  for (const lease of leases) {
    try {
      const ctx = await resolveRuntimeSystemContext(appDb, lease.company_id);
      await runPierreRuntimeScheduler(schedulerDb, ctx, {}, { appDb });
      await completeRuntimeTenantLease(schedulerDb, lease);
      results.push({ company_id: lease.company_id, ok: true });
    } catch (tenantErr) {
      await failRuntimeTenantLease(
        schedulerDb,
        lease,
        (tenantErr as Error)?.message ?? "continuity tick failed",
      ).catch(() => {});
      results.push({ company_id: lease.company_id, ok: false });
    }
  }

  return NextResponse.json({ ok: true, ran: true, tenants: leases.length, results });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
