// src/app/api/pierre/v1/intelligence/status/route.ts
// PHASE 8.14 — GET the real, server-re-read status of a cognitive operation's mission. Deep-link target.
import { withProductAccess } from "../../_runtime";
import { apiIntelligenceStatus } from "@/lib/pierre/v1/cognitive-runtime/intelligence-api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const missionId = new URL(req.url).searchParams.get("mission_id") ?? "";
  return withProductAccess(req, "read", (db, ctx) => apiIntelligenceStatus(db, ctx as never, missionId));
}
