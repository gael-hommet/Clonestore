// PHASE 8.2-C — current user leaves the active company.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiLeaveCompany } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withTenant(req, async (db, ctx) => { await apiLeaveCompany(db, ctx); return { ok: true }; });
}
