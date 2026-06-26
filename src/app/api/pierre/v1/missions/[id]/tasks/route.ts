// src/app/api/pierre/v1/missions/[id]/tasks/route.ts
// PHASE 8.1 — GET tasks for a mission (tenant-scoped).
import { withTenant } from "../../../_runtime";
import { apiGetMissionTasks } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiGetMissionTasks(db, ctx, id));
}
