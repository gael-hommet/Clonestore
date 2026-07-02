// src/app/api/pierre/v1/missions/[id]/validations/route.ts
// PHASE 8.1 — GET pending/decided validations for a mission.
import { withProductAccess } from "../../../_runtime";
import { apiListValidations } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "read", (db, ctx) => apiListValidations(db, ctx, id));
}
