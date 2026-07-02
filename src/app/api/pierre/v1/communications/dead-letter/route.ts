// PHASE 8.4.20 — list dead-lettered communications for operator review (no raw update).
import { withProductAccess } from "../../_runtime";
import { listDeadLetterCommunications } from "@/lib/pierre/v1/communications";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withProductAccess(req, "read", (db, ctx) => listDeadLetterCommunications(db, ctx));
}
