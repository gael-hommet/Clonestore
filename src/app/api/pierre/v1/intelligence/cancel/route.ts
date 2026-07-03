// src/app/api/pierre/v1/intelligence/cancel/route.ts
// PHASE 8.14 — POST to cancel a cognitive operation's mission (governed cancellation via the existing
// service). write_costly access gate.
import { withProductAccess } from "../../_runtime";
import { apiIntelligenceCancel } from "@/lib/pierre/v1/cognitive-runtime/intelligence-api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return withProductAccess(req, "write_costly", (db, ctx) => apiIntelligenceCancel(db, ctx as never, String(body.mission_id ?? "")));
}
