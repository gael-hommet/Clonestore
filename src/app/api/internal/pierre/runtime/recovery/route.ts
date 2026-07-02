// src/app/api/internal/pierre/runtime/recovery/route.ts
// PHASE 8.5-R1 §R1.10 — SYSTEM-ONLY recovery sweep. Dedicated runtime system secret only; discovers
// tenants with stranded work and reclaims expired leases (bumping the fencing generation + recording
// the superseded one). Runs under the least-privilege scheduler role (fail-closed).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { jsonBody } from "../../../../pierre/v1/_runtime";
import { runtimeSystemSecret, verifyRuntimeSystemRequest, resolveRuntimeSystemContext, claimRuntimeTenantLeases, completeRuntimeTenantLease, failRuntimeTenantLease } from "@/lib/pierre/v1/runtime-system-auth";
import { createRuntimeSchedulerExecutor, RuntimeSchedulerDbError } from "@/lib/pierre/v1/runtime-scheduler-db";
import { runPierreRuntimeRecovery } from "@/lib/pierre/v1/runtime-scheduler";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const secret = runtimeSystemSecret();
    if (!secret) return NextResponse.json({ error: { code: "system_unconfigured", message: "runtime system secret not configured" } }, { status: 503 });
    if (!verifyRuntimeSystemRequest(req, secret)) return NextResponse.json({ error: { code: "forbidden", message: "runtime recovery is a system operation" } }, { status: 403 });
    const body = await jsonBody<{ limit?: number; max_tenants?: number }>(req);

    const appDb = await getRuntimeDb();
    const schedulerDb = await createRuntimeSchedulerExecutor();
    const leases = await claimRuntimeTenantLeases(schedulerDb, "recovery", body.max_tenants ?? 50);
    const results: Array<{ company_id: string; recovered: number }> = [];
    for (const lease of leases) {
      try {
        const ctx = await resolveRuntimeSystemContext(appDb, lease.company_id);
        results.push({ company_id: lease.company_id, recovered: (await runPierreRuntimeRecovery(schedulerDb, ctx, { limit: body.limit })).recovered });
        await completeRuntimeTenantLease(schedulerDb, lease);
      } catch (tenantErr) {
        await failRuntimeTenantLease(schedulerDb, lease, (tenantErr as Error)?.message ?? "recovery tick failed").catch(() => {});
        results.push({ company_id: lease.company_id, recovered: 0 });
      }
    }
    return NextResponse.json({ ok: true, tenants: leases.length, results });
  } catch (err) {
    if (err instanceof RuntimeSchedulerDbError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    return NextResponse.json({ error: { code: "internal", message: "runtime recovery failed" } }, { status: 500 });
  }
}
