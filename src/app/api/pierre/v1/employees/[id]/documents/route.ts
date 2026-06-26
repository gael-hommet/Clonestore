// PHASE 8.2-C — list employee documents (metadata only).
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiListDocuments } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiListDocuments(db, ctx, id));
}
