// PHASE 8.4-R1.11 — non-destructive archive of the RECIPIENT's own in-app message.
import { withProductAccess } from "../../../_runtime";
import { archiveInternalMessage } from "@/lib/pierre/v1/communications";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "write_standard", async (db, ctx) => { await archiveInternalMessage(db, ctx, id); return { ok: true }; });
}
