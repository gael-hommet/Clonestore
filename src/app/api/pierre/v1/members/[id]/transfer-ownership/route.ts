// PHASE 8.2-C — transfer company ownership to this member.
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiTransferOwnership } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ demote_self?: boolean }>(req);
  return withProductAccess(req, "admin", async (db, ctx) => { await apiTransferOwnership(db, ctx, id, b.demote_self ?? false); return { ok: true }; });
}
