// PHASE 8.2-C — assign a role (system or custom) to a member.
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiAssignRole } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ role_key: string }>(req);
  return withProductAccess(req, "admin", async (db, ctx) => { await apiAssignRole(db, ctx, id, b.role_key); return { ok: true }; });
}
