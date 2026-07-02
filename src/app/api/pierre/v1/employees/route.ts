// src/app/api/pierre/v1/employees/route.ts
// PHASE 8.2 — GET employees (RBAC + site-scoped, paginated) + POST create.
import { withProductAccess } from "../_runtime";
import { apiCreateEmployee, apiListEmployees, apiSearchEmployees } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  if (q) return withProductAccess(req, "read", (db, ctx) => apiSearchEmployees(db, ctx, q, Number(url.searchParams.get("limit") ?? 20)));
  return withProductAccess(req, "read", (db, ctx) => apiListEmployees(db, ctx, {
    limit: Number(url.searchParams.get("limit") ?? 20),
    cursor: url.searchParams.get("cursor"),
    status: url.searchParams.get("status"),
  }));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return withProductAccess(req, "write_standard", (db, ctx) => apiCreateEmployee(db, ctx, {
    first_name: String(body.first_name ?? ""),
    last_name: String(body.last_name ?? ""),
    site_id: (body.site_id as string) ?? null,
    email: (body.email as string) ?? null,
    role_title: (body.role_title as string) ?? null,
    contract_type: typeof body.contract_type === "string" ? body.contract_type : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    external_ref: (body.external_ref as string) ?? null,
  }));
}
