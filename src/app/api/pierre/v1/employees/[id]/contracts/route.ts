// PHASE 8.2-C — list / create employee contracts.
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiListContracts, apiCreateContract } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProductAccess(req, "read", (db, ctx) => apiListContracts(db, ctx, id));
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await jsonBody<{ contract_type: string }>(req);
  return withProductAccess(req, "write_standard", async (db, ctx) => ({ contract_id: await apiCreateContract(db, ctx, id, b.contract_type) }));
}
