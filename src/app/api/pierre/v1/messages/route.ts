// PHASE 8.4-R1.11 — the authenticated recipient's REAL in-app message feed (pierre_rt_notifications).
// Recipient-only, active-tenant-only, real unread count. No fictitious legacy data, no global data.
import { withTenant } from "../_runtime";
import { listInternalMessages } from "@/lib/pierre/v1/communications";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const include_archived = url.searchParams.get("include_archived") === "true";
  const rawLimit = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
  return withTenant(req, (db, ctx) => listInternalMessages(db, ctx, { include_archived, limit }));
}
