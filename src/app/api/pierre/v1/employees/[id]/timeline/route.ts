// PHASE 8.2-C — employee timeline (events + status history).
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiEmployeeTimeline } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "read", (db, ctx) => apiEmployeeTimeline(db, ctx, id));
}
