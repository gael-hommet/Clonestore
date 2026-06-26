// PHASE 8.3-B3.12 — signature route. Thin withTenant wrapper → api → service.
// Tenant resolved server-side; company_id in the body is never authoritative.
import { withTenant, jsonBody } from "../../../../_runtime";
import * as Api from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTenant(req, (db, ctx) => Api.apiCancelContractSignature(db, ctx, id));
}
