// src/app/api/pierre/v1/worker/tick/route.ts
// PHASE 8.1 — POST worker tick. Server-side worker pass + stale-lease recovery.
// Secured by a shared worker token (never trust a client). Lets long work run
// without a browser open (cron / scheduled invocation drives this).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { runWorkerOnce, type WorkerResult } from "@/lib/pierre/v1/worker";
import { recoverStaleLeases } from "@/lib/pierre/v1/queue";
import { newUuid } from "@/lib/pierre/v1/sql";
import { toRuntimeError, errorBody } from "@/lib/pierre/v1/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("x-worker-token");
    if (!process.env.PIERRE_WORKER_TOKEN || token !== process.env.PIERRE_WORKER_TOKEN) {
      return NextResponse.json({ error: { code: "forbidden", message: "Invalid worker token" } }, { status: 403 });
    }
    const db = await getRuntimeDb();
    const recovered = await recoverStaleLeases(db);
    const result: WorkerResult = await runWorkerOnce(db, { worker_id: `http-${newUuid().slice(0, 8)}`, lease_ms: 30000, batch: 10, tenant_concurrency_cap: 25 });
    return NextResponse.json({ recovered_stale: recovered, ...result });
  } catch (err) {
    const re = toRuntimeError(err);
    return NextResponse.json(errorBody(re), { status: re.status });
  }
}
