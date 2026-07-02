// PHASE 8.3-B2G — contract route. Thin withTenant wrapper → api layer → service.
// Tenant is resolved server-side; a company_id in the body is never authoritative.
import { withProductAccess, jsonBody } from "../_runtime";
import * as Api from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // R1.1 — `parent_contract_id` is intentionally NOT read here: the normal creation path can
  // never set a parent; amendments go through POST /contracts/:id/amendments only.
  const b = await jsonBody<{ employee_id: string; contract_type: string; effective_from: string; effective_to?: string | null }>(req);
  return withProductAccess(req, "write_standard", (db, ctx) => Api.apiCreateGovernedContract(db, ctx, { employee_id: b.employee_id, contract_type: b.contract_type, effective_from: b.effective_from, effective_to: b.effective_to ?? null }));
}
