// src/app/api/pierre/v1/missions/[id]/validations/route.ts
// PHASE 8.1 — GET pending/decided validations for a mission.
import { withTenant } from "../../../_runtime";
import { apiListValidations } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiListValidations(db, ctx, id));
}
