// PHASE 8.2-C — CSV import preview.
import { withProductAccess, jsonBody } from "@/app/api/pierre/v1/_runtime";
import { apiImportPreview } from "@/lib/pierre/v1/api";
import type { PreviewInput } from "@/lib/pierre/v1/employee-import";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await jsonBody<PreviewInput>(req);
  return withProductAccess(req, "write_standard", (db, ctx) => apiImportPreview(db, ctx, b));
}
