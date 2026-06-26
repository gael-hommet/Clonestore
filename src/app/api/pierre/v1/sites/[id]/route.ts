// PHASE 8.2-C — site detail + patch (optimistic concurrency).
import { withTenant, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiGetSite, apiPatchSite } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiGetSite(db, ctx, id));
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ version: number } & Record<string, unknown>>(req);
  const { version, ...patch } = b;
  return withTenant(req, (db, ctx) => apiPatchSite(db, ctx, id, patch, version));
}
