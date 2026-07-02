// PHASE 8.2-C — list / create employee absences.
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiListAbsences, apiCreateAbsence } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "read", (db, ctx) => apiListAbsences(db, ctx, id));
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ type: string; start_date: string; end_date: string; status?: string }>(req);
  return withProductAccess(req, "write_standard", async (db, ctx) => { await apiCreateAbsence(db, ctx, id, b); return { ok: true }; });
}
