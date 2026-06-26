// PHASE 8.2-C — switch the active company (persists user preference).
import { withUser, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiSwitchCompany } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await jsonBody<{ company_id: string }>(req);
  return withUser(req, (db, identity) => apiSwitchCompany(db, identity.user_id, b.company_id));
}
