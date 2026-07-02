// PHASE 8.2-C — list members.
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiListMembers } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withProductAccess(req, "read", (db, ctx) => apiListMembers(db, ctx));
}
