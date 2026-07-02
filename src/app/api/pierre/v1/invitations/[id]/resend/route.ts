// PHASE 8.2-C — resend (rotate token of) a pending invitation.
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiResendInvitation } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "write_costly", (db, ctx) => apiResendInvitation(db, ctx, id));
}
