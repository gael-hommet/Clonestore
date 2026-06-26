// src/app/api/pierre/v1/missions/[id]/timeline/route.ts
// PHASE 8.1 — GET the persisted CloneTrace timeline for a mission.
import { withTenant } from "../../../_runtime";
import { apiGetMissionTimeline } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiGetMissionTimeline(db, ctx, id));
}
