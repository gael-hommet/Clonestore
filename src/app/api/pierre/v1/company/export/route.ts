// PHASE 8.2-C — GDPR company export.
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiExportCompany } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withProductAccess(req, "read", (db, ctx) => apiExportCompany(db, ctx));
}
