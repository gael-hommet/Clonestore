// PHASE 8.2-C — sensitive-access log for an employee (requires audit.read).
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiEmployeeAccessLog } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "read", (db, ctx) => apiEmployeeAccessLog(db, ctx, id));
}
