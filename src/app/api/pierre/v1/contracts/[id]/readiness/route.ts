// PHASE 8.3-B2G — contract route. Thin withTenant wrapper → api layer → service.
// Tenant is resolved server-side; a company_id in the body is never authoritative.
import { withProductAccess, jsonBody } from "../../../_runtime";
import * as Api from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ action: "generate" | "submit_review" | "approve" | "finalize" | "prepare_signature"; renderer?: "pdf" | "docx"; field_values?: Record<string, string | null> }>(req);
  return withProductAccess(req, "read", (db, ctx) => Api.apiContractReadiness(db, ctx, id, b.action, b.renderer ?? "pdf", b.field_values ?? {}));
}
