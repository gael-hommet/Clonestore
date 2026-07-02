// PHASE 8.2-C — add a new contract version.
import { withProductAccess } from "@/app/api/pierre/v1/_runtime";
import { apiAddContractVersion } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; contractId: string }> }) {
  const { id, contractId } = await params;
  return withProductAccess(req, "write_standard", async (db, ctx) => ({ version: await apiAddContractVersion(db, ctx, id, contractId) }));
}
