// PHASE 8.2-C — set / release legal hold.
import { withTenant, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiSetLegalHold } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ on?: boolean }>(req);
  return withTenant(req, async (db, ctx) => { await apiSetLegalHold(db, ctx, id, b.on !== false); return { ok: true, legal_hold: b.on !== false }; });
}
