// PHASE 8.2-C — revoke a pending invitation.
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiRevokeInvitation } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "admin", async (db, ctx) => { await apiRevokeInvitation(db, ctx, id); return { ok: true }; });
}
