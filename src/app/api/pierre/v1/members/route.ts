// PHASE 8.2-C — list members.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiListMembers } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withTenant(req, (db, ctx) => apiListMembers(db, ctx));
}
