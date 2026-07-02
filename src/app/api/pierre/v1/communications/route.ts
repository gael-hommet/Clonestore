// PHASE 8.4.20 — list the tenant's communication deliveries (no HTML / secret / object key / address).
import { withProductAccess } from "../_runtime";
import { listCommunicationDeliveries } from "@/lib/pierre/v1/communications";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  return withProductAccess(req, "read", (db, ctx) => listCommunicationDeliveries(db, ctx, { status }));
}
