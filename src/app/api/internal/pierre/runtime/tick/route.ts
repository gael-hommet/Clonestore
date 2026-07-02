// src/app/api/internal/pierre/runtime/tick/route.ts
// PHASE 8.5-R1 §R1.10 — SYSTEM-ONLY runtime worker tick. The caller MUST present the DEDICATED runtime
// system secret (constant-time; no CRON_SECRET fallback). The tick never trusts a client-supplied
// company_id: it DISCOVERS the tenants the DB reports as having due work and processes each. Job truth
// runs under the dedicated least-privilege worker role (fail-closed); business handlers use a tenant-
// bound app executor. Never the service role, never a client identity.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { jsonBody } from "../../../../pierre/v1/_runtime";
import { runtimeSystemSecret, verifyRuntimeSystemRequest, resolveRuntimeSystemContext, claimRuntimeTenantLeases, completeRuntimeTenantLease, failRuntimeTenantLease } from "@/lib/pierre/v1/runtime-system-auth";
import { createRuntimeWorkerExecutor, withRuntimeWorkerTransaction, RuntimeWorkerDbError } from "@/lib/pierre/v1/runtime-worker-db";
import { runPierreRuntimeJobs } from "@/lib/pierre/v1/runtime-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const secret = runtimeSystemSecret();
    if (!secret) return NextResponse.json({ error: { code: "system_unconfigured", message: "runtime system secret not configured" } }, { status: 503 });
    if (!verifyRuntimeSystemRequest(req, secret)) return NextResponse.json({ error: { code: "forbidden", message: "runtime tick is a system operation" } }, { status: 403 });
    const body = await jsonBody<{ limit?: number; max_tenants?: number }>(req);

    const appDb = await getRuntimeDb();
    const workerDb = await createRuntimeWorkerExecutor(); // fail-closed (never app/service role)
    // R4.6 — discover + ATOMICALLY LEASE the tenants (fair, exclusive); release each lease when done.
    const leases = await claimRuntimeTenantLeases(workerDb, "worker", body.max_tenants ?? 50);
    const results: Array<{ company_id: string; result: unknown }> = [];
    for (const lease of leases) {
      try {
        const ctx = await resolveRuntimeSystemContext(appDb, lease.company_id);
        // R3.2 — every worker truth-call runs inside withRuntimeWorkerTransaction (SET LOCAL ROLE +
        // verified current_user); business handlers use the app-bound appDb.
        results.push({ company_id: lease.company_id, result: await runPierreRuntimeJobs(workerDb, ctx, { limit: body.limit }, { appDb, runWorkerTx: withRuntimeWorkerTransaction }) });
        await completeRuntimeTenantLease(workerDb, lease);
      } catch (tenantErr) {
        await failRuntimeTenantLease(workerDb, lease, (tenantErr as Error)?.message ?? "tenant tick failed").catch(() => {});
        results.push({ company_id: lease.company_id, result: { error: "tenant_failed" } });
      }
    }
    return NextResponse.json({ ok: true, tenants: leases.length, results });
  } catch (err) {
    if (err instanceof RuntimeWorkerDbError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    return NextResponse.json({ error: { code: "internal", message: "runtime tick failed" } }, { status: 500 });
  }
}
