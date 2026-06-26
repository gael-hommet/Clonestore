// PHASE 8.2-C — reactivate an archived site.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiReactivateSite } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiReactivateSite(db, ctx, id));
}
