// PHASE 8.2-C — resend (rotate token of) a pending invitation.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiResendInvitation } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiResendInvitation(db, ctx, id));
}
