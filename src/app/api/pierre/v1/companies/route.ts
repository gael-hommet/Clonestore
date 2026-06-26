// PHASE 8.2-C — list the companies the current user can act in.
import { withUser } from "@/app/api/pierre/v1/_runtime";
import { apiListCompanies } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withUser(req, (db, identity) => apiListCompanies(db, identity.user_id));
}
