// PHASE 8.2-C — archive an employee.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiArchiveEmployee } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiArchiveEmployee(db, ctx, id));
}
