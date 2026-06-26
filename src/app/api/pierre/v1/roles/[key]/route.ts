// PHASE 8.2-C — role detail + patch.
import { withTenant, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiGetRole, apiPatchRole } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return withTenant(req, (db, ctx) => apiGetRole(db, ctx, key));
}
export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const b = await jsonBody<{ label?: string; permissions?: string[]; version: number }>(req);
  return withTenant(req, (db, ctx) => apiPatchRole(db, ctx, key, { label: b.label, permissions: b.permissions }, b.version));
}
