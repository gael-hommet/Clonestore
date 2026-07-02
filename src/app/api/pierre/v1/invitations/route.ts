// src/app/api/pierre/v1/invitations/route.ts
// PHASE 8.2-C create invitation. PHASE 8.6: the raw token is NEVER returned to the client — creating the
// invitation emits a `member.invited` business event (pierre_rt_outbox), and the REAL P8.4 communication
// pipeline (intent → delivery → worker → provider) delivers the accept link. The client response carries
// only invitation_id / status / expires_at. The route NEVER touches the mailbox and NEVER enqueues a
// delivery directly.
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiCreateInvitation } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await jsonBody<{ email: string; roles?: string[]; site_ids?: string[]; expires_in_days?: number }>(req);
  // PHASE 8.6 — inviting a member is WRITE_COSTLY (refused under grace/suspended/onboarding_required/denied).
  return withProductAccess(req, "write_costly", async (db, ctx) => {
    const created = await apiCreateInvitation(db, ctx, b) as { id: string; status: string; expires_at: string };
    // The token traveled into the governed outbox event only — return a token-free receipt.
    return { invitation_id: created.id, status: created.status, expires_at: created.expires_at };
  });
}
