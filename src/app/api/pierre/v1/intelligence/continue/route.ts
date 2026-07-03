// src/app/api/pierre/v1/intelligence/continue/route.ts
// PHASE 8.14 — POST to resume a long-running operation. The durable worker/scheduler drives execution
// server-side (fencing/lease/waits already handle restart/timeout); this returns the current real state.
import { withProductAccess } from "../../_runtime";
import { apiIntelligenceContinue } from "@/lib/pierre/v1/cognitive-runtime/intelligence-api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return withProductAccess(req, "write_costly", (db, ctx) => apiIntelligenceContinue(db, ctx as never, String(body.operation_id ?? "")));
}
