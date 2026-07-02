// PHASE 8.2-C — patch a member's status (suspend/reactivate).
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiSuspendMember, apiReactivateMember } from "@/lib/pierre/v1/api";
import { Errors } from "@/lib/pierre/v1/errors";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ status?: string }>(req);
  return withProductAccess(req, "admin", async (db, ctx) => {
    if (b.status === "suspended") { await apiSuspendMember(db, ctx, id); return { ok: true, status: "suspended" }; }
    if (b.status === "active") { await apiReactivateMember(db, ctx, id); return { ok: true, status: "active" }; }
    throw Errors.validation("status must be 'active' or 'suspended'");
  });
}
