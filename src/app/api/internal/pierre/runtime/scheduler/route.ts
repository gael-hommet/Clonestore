// src/app/api/internal/pierre/runtime/scheduler/route.ts
// PHASE 8.5-R1 §R1.10 — SYSTEM-ONLY scheduler + recovery tick. Dedicated runtime system secret only
// (no CRON_SECRET fallback); it DISCOVERS tenants with due work rather than trusting a free company_id.
// Runs under the least-privilege scheduler role (fail-closed); relance communications use a tenant-
// bound app executor. Reclaims expired leases (bumping the fencing generation), resolves due timer
// waits + ingested events, fires bounded relances — never a business action directly.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { jsonBody } from "../../../../pierre/v1/_runtime";
import { runtimeSystemSecret, verifyRuntimeSystemRequest, resolveRuntimeSystemContext, claimRuntimeTenantLeases, completeRuntimeTenantLease, failRuntimeTenantLease } from "@/lib/pierre/v1/runtime-system-auth";
import { createRuntimeSchedulerExecutor, RuntimeSchedulerDbError } from "@/lib/pierre/v1/runtime-scheduler-db";
import { runPierreRuntimeScheduler } from "@/lib/pierre/v1/runtime-scheduler";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const secret = runtimeSystemSecret();
    if (!secret) return NextResponse.json({ error: { code: "system_unconfigured", message: "runtime system secret not configured" } }, { status: 503 });
    if (!verifyRuntimeSystemRequest(req, secret)) return NextResponse.json({ error: { code: "forbidden", message: "runtime scheduler is a system operation" } }, { status: 403 });
    const body = await jsonBody<{ limit?: number; max_tenants?: number }>(req);

    const appDb = await getRuntimeDb();
    const schedulerDb = await createRuntimeSchedulerExecutor(); // fail-closed (never app/service role)
    const leases = await claimRuntimeTenantLeases(schedulerDb, "scheduler", body.max_tenants ?? 50);
    const results: Array<{ company_id: string; result: unknown }> = [];
    for (const lease of leases) {
      try {
        const ctx = await resolveRuntimeSystemContext(appDb, lease.company_id);
        results.push({ company_id: lease.company_id, result: await runPierreRuntimeScheduler(schedulerDb, ctx, { limit: body.limit }, { appDb }) });
        await completeRuntimeTenantLease(schedulerDb, lease);
      } catch (tenantErr) {
        await failRuntimeTenantLease(schedulerDb, lease, (tenantErr as Error)?.message ?? "scheduler tick failed").catch(() => {});
        results.push({ company_id: lease.company_id, result: { error: "tenant_failed" } });
      }
    }
    return NextResponse.json({ ok: true, tenants: leases.length, results });
  } catch (err) {
    if (err instanceof RuntimeSchedulerDbError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    return NextResponse.json({ error: { code: "internal", message: "runtime scheduler failed" } }, { status: 500 });
  }
}
