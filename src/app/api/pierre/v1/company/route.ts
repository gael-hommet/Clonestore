// src/app/api/pierre/v1/company/route.ts
// PHASE 8.2 — GET active company + PATCH (optimistic concurrency, governed status).
import { withTenant } from "../_runtime";
import { apiGetCompany, apiPatchCompany } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withTenant(req, (db, ctx) => apiGetCompany(db, ctx));
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { version, ...patch } = body;
  return withTenant(req, (db, ctx) => apiPatchCompany(db, ctx, patch, Number(version ?? 1)));
}
