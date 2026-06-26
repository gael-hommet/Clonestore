// PHASE 8.2-C — remove a role from a member.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiRemoveRole } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; role: string }> }) {
  const { id, role } = await params;
  return withTenant(req, async (db, ctx) => { await apiRemoveRole(db, ctx, id, role); return { ok: true }; });
}
