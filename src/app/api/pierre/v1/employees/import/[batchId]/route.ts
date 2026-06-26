// PHASE 8.2-C — CSV import batch status + per-row outcomes.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiGetImportBatch } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return withTenant(req, (db, ctx) => apiGetImportBatch(db, ctx, batchId));
}
