// PHASE 8.2-C — roles: list + create custom role.
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiListRoles, apiCreateRole } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withProductAccess(req, "read", (db, ctx) => apiListRoles(db, ctx));
}
export async function POST(req: Request) {
  const b = await jsonBody<{ label: string; permissions?: string[]; key?: string }>(req);
  return withProductAccess(req, "admin", (db, ctx) => apiCreateRole(db, ctx, b));
}
