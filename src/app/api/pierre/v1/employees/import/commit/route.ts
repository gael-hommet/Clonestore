// PHASE 8.2-C — CSV import commit.
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiImportCommit } from "@/lib/pierre/v1/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await jsonBody<{ batch_id: string }>(req);
  return withProductAccess(req, "write_standard", (db, ctx) => apiImportCommit(db, ctx, b.batch_id));
}
