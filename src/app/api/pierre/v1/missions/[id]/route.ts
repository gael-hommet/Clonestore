// src/app/api/pierre/v1/missions/[id]/route.ts
// PHASE 8.1 — GET a single mission (tenant-scoped).
import { withProductAccess } from "../../_runtime";
import { apiGetMission } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "read", (db, ctx) => apiGetMission(db, ctx, id));
}
