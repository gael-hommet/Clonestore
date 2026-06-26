// PHASE 8.2-C — accept an invitation by raw token (identity transition).
import { withUser, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiAcceptInvitation } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await jsonBody<{ token: string }>(req);
  return withUser(req, (db, identity) => apiAcceptInvitation(db, {
    user_id: identity.user_id, email: identity.email, email_confirmed_at: identity.email_confirmed_at, token: b.token,
  }));
}
