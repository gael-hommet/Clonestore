// PHASE 8.3-B3.12 — signature route. Thin withTenant wrapper → api → service.
// Tenant resolved server-side; company_id in the body is never authoritative.
import { withTenant, jsonBody } from "../../_runtime";
import * as Api from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await jsonBody<{ limit?: number }>(req);
  return withTenant(req, (db, ctx) => Api.apiReconcileSignatures(db, ctx, { limit: b.limit }));
}
