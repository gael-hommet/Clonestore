// src/app/api/pierre/v1/intelligence/confirm/route.ts
// PHASE 8.14 — POST to EXECUTE a previewed request. Delegates to the existing governed mission service
// (real persisted mission/tasks/validations) — no second runtime. write_costly access gate.
import { withProductAccess } from "../../_runtime";
import { apiIntelligenceConfirm } from "@/lib/pierre/v1/cognitive-runtime/intelligence-api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return withProductAccess(req, "write_costly", (db, ctx) =>
    apiIntelligenceConfirm(db, ctx as never, {
      instruction: String(body.instruction ?? ""),
      employee_id: (body.employee_id as string) ?? null,
      site_id: (body.site_id as string) ?? null,
      autonomy_mode: body.autonomy_mode as never,
      idempotency_key: typeof body.idempotency_key === "string" ? body.idempotency_key : undefined,
    }),
  );
}
