// src/app/api/pierre/v1/employees/[id]/completeness/route.ts
// PHASE 8.2 — GET explainable employee completeness.
import { withTenant } from "../../../_runtime";
import { apiGetEmployeeCompleteness } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiGetEmployeeCompleteness(db, ctx, id));
}
