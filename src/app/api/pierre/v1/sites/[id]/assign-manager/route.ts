// PHASE 8.2-C — assign a site manager (must be an active, authorized member).
import { withTenant, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiAssignSiteManager } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ manager_membership_id: string }>(req);
  return withTenant(req, (db, ctx) => apiAssignSiteManager(db, ctx, id, b.manager_membership_id));
}
