// PHASE 8.2-C — revoke a pending invitation.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiRevokeInvitation } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, async (db, ctx) => { await apiRevokeInvitation(db, ctx, id); return { ok: true }; });
}
