// PHASE 8.2-C — archive a site (optionally reassigning active employees).
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiArchiveSite } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ reassign_to_site_id?: string }>(req);
  return withProductAccess(req, "admin", (db, ctx) => apiArchiveSite(db, ctx, id, b.reassign_to_site_id ?? null));
}
