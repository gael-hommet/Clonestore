// PHASE 8.2-C — roll back a committed import batch.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiImportRollback } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  return withTenant(req, (db, ctx) => apiImportRollback(db, ctx, batchId));
}
