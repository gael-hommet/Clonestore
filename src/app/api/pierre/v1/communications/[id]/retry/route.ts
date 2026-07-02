// PHASE 8.4.20 — governed manual retry of a failed/dead-lettered delivery (no raw update).
import { withProductAccess } from "../../../_runtime";
import { retryCommunicationDelivery } from "@/lib/pierre/v1/communications";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "write_standard", async (db, ctx) => { await retryCommunicationDelivery(db, ctx, id); return { ok: true }; });
}
