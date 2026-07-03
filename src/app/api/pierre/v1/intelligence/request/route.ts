// src/app/api/pierre/v1/intelligence/request/route.ts
// PHASE 8.14 — POST a natural-language HR request → Pierre interprets, clarifies, and previews a compiled
// plan (no writes). Server resolves company/actor/permission via withProductAccess; the browser never
// supplies authoritative tenant/role. This is the authoritative cognitive entry point P9 calls.
import { withProductAccess } from "../../_runtime";
import { apiIntelligenceRequest } from "@/lib/pierre/v1/cognitive-runtime/intelligence-api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return withProductAccess(req, "read", (db, ctx) =>
    apiIntelligenceRequest(db, ctx as never, { instruction: String(body.instruction ?? "") }),
  );
}
