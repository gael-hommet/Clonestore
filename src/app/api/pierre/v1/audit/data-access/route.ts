// PHASE 8.2-C — data-access / GDPR audit trail.
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiDataAccessAudit } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? "100");
  return withProductAccess(req, "read", (db, ctx) => apiDataAccessAudit(db, ctx, Number.isFinite(limit) ? limit : 100));
}
