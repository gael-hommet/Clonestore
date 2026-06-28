// PHASE 8.4-R1.11 — mark the RECIPIENT's own in-app message as read (idempotent; never another user's).
import { withTenant } from "../../../_runtime";
import { markInternalMessageRead } from "@/lib/pierre/v1/communications";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => markInternalMessageRead(db, ctx, id));
}
