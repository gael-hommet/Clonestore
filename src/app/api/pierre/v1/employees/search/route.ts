// PHASE 8.2-C — typo-tolerant employee search.
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiSearchEmployees } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? "20");
  return withProductAccess(req, "read", (db, ctx) => apiSearchEmployees(db, ctx, q, Number.isFinite(limit) ? limit : 20));
}
