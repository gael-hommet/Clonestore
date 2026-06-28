// PHASE 8.4-R1.2 — SYSTEM-ONLY dispatch trigger (cron / internal queue). An ordinary authenticated
// `document.read` user can NOT trigger a dispatch: the caller MUST present the system secret. Intents
// are created with the application role; the dispatch worker runs under the DEDICATED, least-privilege
// communication worker role (R1.1) — never the app role, never the service role (fail-closed).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { withTenantTransaction } from "@/lib/pierre/v1/tenant-tx";
import { jsonBody } from "../../_runtime";
import { communicationSystemSecret, verifyCommunicationSystemRequest, resolveSystemTenantContext } from "@/lib/pierre/v1/communication-system-auth";
import { createCommunicationWorkerExecutor, CommunicationWorkerDbError } from "@/lib/pierre/v1/communication-worker-db";
import { dispatchCommunicationDeliveries, createCommunicationIntents } from "@/lib/pierre/v1/communications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const secret = communicationSystemSecret();
    if (!secret) return NextResponse.json({ error: { code: "system_unconfigured", message: "dispatch system secret not configured" } }, { status: 503 });
    // R1.2 — refuse any caller that does not present the system secret (an ordinary user has none).
    if (!verifyCommunicationSystemRequest(req, secret)) return NextResponse.json({ error: { code: "forbidden", message: "dispatch is a system operation" } }, { status: 403 });

    const body = await jsonBody<{ company_id?: string; limit?: number }>(req);
    if (!body.company_id) return NextResponse.json({ error: { code: "validation", message: "company_id is required" } }, { status: 400 });

    const appDb = await getRuntimeDb();
    const ctx = await resolveSystemTenantContext(appDb, body.company_id);
    // 1. create intents (+ freeze content) tenant-bound under the application role
    const intents = await withTenantTransaction(appDb, { company_id: ctx.company_id, user_id: ctx.user_id }, (tx) => createCommunicationIntents(tx, ctx, { limit: body.limit }));
    // 2. dispatch under the dedicated worker role (fail-closed; never the app/service role)
    const workerDb = await createCommunicationWorkerExecutor();
    const dispatched = await dispatchCommunicationDeliveries(workerDb, ctx, { limit: body.limit });
    return NextResponse.json({ intents, dispatched });
  } catch (err) {
    if (err instanceof CommunicationWorkerDbError) return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    return NextResponse.json({ error: { code: "internal", message: "dispatch failed" } }, { status: 500 });
  }
}
