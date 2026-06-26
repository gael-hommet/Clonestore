// PHASE 8.2-C — roles: list + create custom role.
import { withTenant, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiListRoles, apiCreateRole } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withTenant(req, (db, ctx) => apiListRoles(db, ctx));
}
export async function POST(req: Request) {
  const b = await jsonBody<{ label: string; permissions?: string[]; key?: string }>(req);
  return withTenant(req, (db, ctx) => apiCreateRole(db, ctx, b));
}
