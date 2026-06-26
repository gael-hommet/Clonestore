// src/app/api/pierre/v1/missions/[id]/cancel/route.ts
// PHASE 8.1 — POST cancel a mission (governed; cancels tasks + jobs).
import { withTenant } from "../../../_runtime";
import { apiCancelMission } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiCancelMission(db, ctx, id));
}
