// PHASE 8.2-C — archive a custom role.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiArchiveRole } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return withTenant(req, async (db, ctx) => { await apiArchiveRole(db, ctx, key); return { ok: true }; });
}
