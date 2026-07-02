// PHASE 8.2-C — reactivate a member.
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiReactivateMember } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "admin", async (db, ctx) => { await apiReactivateMember(db, ctx, id); return { ok: true }; });
}
