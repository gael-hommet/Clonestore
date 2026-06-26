// PHASE 8.2-C — create an invitation (returns the raw token once).
import { withTenant, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiCreateInvitation } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await jsonBody<{ email: string; roles?: string[]; site_ids?: string[]; expires_in_days?: number }>(req);
  return withTenant(req, (db, ctx) => apiCreateInvitation(db, ctx, b));
}
