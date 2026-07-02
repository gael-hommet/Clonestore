// PHASE 8.2-C — erase a single document (GDPR; blocked under legal hold).
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiDeleteEmployeeDocument } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  return withProductAccess(req, "admin", async (db, ctx) => { await apiDeleteEmployeeDocument(db, ctx, id, documentId); return { ok: true }; });
}
