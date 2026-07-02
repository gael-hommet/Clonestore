// PHASE 8.3-B3.12 — signature route. Thin withTenant wrapper → api → service.
// Tenant resolved server-side; company_id in the body is never authoritative.
import { withProductAccess, jsonBody } from "../../../_runtime";
import * as Api from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "read", (db, ctx) => Api.apiGetSignatureEvidence(db, ctx, id));
}
