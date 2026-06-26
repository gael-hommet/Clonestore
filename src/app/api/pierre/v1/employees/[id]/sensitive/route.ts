// PHASE 8.2-C — sensitive data: list categories / read one (audited) / write.
import { withTenant, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiListSensitiveCategories, apiReadSensitive, apiWriteSensitive } from "@/lib/pierre/v1/api";
import type { SensitiveCategory } from "@/lib/pierre/v1/employee-sensitive";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = new URL(req.url).searchParams.get("category") as SensitiveCategory | null;
  return withTenant(req, (db, ctx) => category ? apiReadSensitive(db, ctx, id, category) : apiListSensitiveCategories(db, ctx, id));
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ category: SensitiveCategory; value_encrypted: string }>(req);
  return withTenant(req, async (db, ctx) => { await apiWriteSensitive(db, ctx, id, b.category, b.value_encrypted); return { ok: true }; });
}
