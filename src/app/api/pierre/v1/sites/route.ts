// src/app/api/pierre/v1/sites/route.ts
// PHASE 8.2 — GET sites (RBAC + site-scoped) + POST create site.
import { withTenant } from "../_runtime";
import { apiCreateSite, apiListSites } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withTenant(req, (db, ctx) => apiListSites(db, ctx));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return withTenant(req, (db, ctx) => apiCreateSite(db, ctx, {
    name: String(body.name ?? ""),
    code: (body.code as string) ?? null,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
  }));
}
