// PHASE 8.2 / 8.2-C — GET Employee 360 view + PATCH (optimistic concurrency).
import { withTenant, jsonBody } from "../../_runtime";
import { apiGetEmployee360, apiPatchEmployee } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => apiGetEmployee360(db, ctx, id));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ version: number } & Record<string, unknown>>(req);
  const { version, ...patch } = b;
  return withTenant(req, (db, ctx) => apiPatchEmployee(db, ctx, id, patch, version));
}
