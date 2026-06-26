// PHASE 8.2-C — GDPR company export.
import { withTenant } from "@/app/api/pierre/v1/_runtime";
import { apiExportCompany } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withTenant(req, (db, ctx) => apiExportCompany(db, ctx));
}
