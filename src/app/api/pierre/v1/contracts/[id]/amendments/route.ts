// PHASE 8.3-B2G — contract route. Thin withTenant wrapper → api layer → service.
// Tenant is resolved server-side; a company_id in the body is never authoritative.
import { withProductAccess, jsonBody } from "../../../_runtime";
import * as Api from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ reason: string; effective_from: string; effective_to?: string | null; idempotency_key?: string }>(req);
  return withProductAccess(req, "write_standard", (db, ctx) => Api.apiCreateContractAmendment(db, ctx, id, { reason: b.reason, effective_from: b.effective_from, effective_to: b.effective_to ?? null, idempotency_key: b.idempotency_key }));
}
