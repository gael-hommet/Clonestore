// PHASE 8.2-C — tasks linked to an employee.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiEmployeeTasks } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiEmployeeTasks(db, ctx, id));
}
