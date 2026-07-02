// src/app/api/pierre/v1/validations/[id]/[action]/route.ts
// PHASE 8.1 — POST approve | reject | request-changes a validation.
// Version-checked + idempotent; unlocks tasks on approval.
import { withProductAccess } from "../../../_runtime";
import { apiDecideValidation } from "@/lib/pierre/v1/api";
import { Errors } from "@/lib/pierre/v1/errors";

export const runtime = "nodejs";

const ACTIONS = { approve: "approve", reject: "reject", "request-changes": "request_changes" } as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mapped = ACTIONS[action as keyof typeof ACTIONS];
  return withProductAccess(req, "write_standard", (db, ctx) => {
    if (!mapped) throw Errors.validation(`Unknown validation action: ${action}`);
    return apiDecideValidation(db, ctx, id, mapped, Number(body.version ?? 1));
  });
}
