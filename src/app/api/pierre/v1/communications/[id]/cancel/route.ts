// PHASE 8.4.20 — governed cancel of a not-yet-sent delivery (a sent/delivered one cannot be cancelled).
import { withTenant } from "../../../_runtime";
import { cancelCommunicationDelivery } from "@/lib/pierre/v1/communications";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, async (db, ctx) => { await cancelCommunicationDelivery(db, ctx, id); return { ok: true }; });
}
