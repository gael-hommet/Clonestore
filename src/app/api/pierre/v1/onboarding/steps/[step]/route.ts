// src/app/api/pierre/v1/onboarding/steps/[step]/route.ts
// PHASE 8.6 — complete an onboarding step (server decides completeness). The client cannot set a
// percentage; it may only request that a step be marked complete, which the governed function validates
// and then recomputes progress server-side. Bound to the app role + tenant via withTenantTransaction.
import { withProductAccess, jsonBody } from "../../../_runtime";
import { withTenantTransaction } from "@/lib/pierre/v1/tenant-tx";
import { completeOnboardingStep } from "@/lib/pierre/v1/onboarding-service";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return withProductAccess(req, "onboarding", async (db, ctx) => {
    const body = await jsonBody<{ session_id?: string; data?: Record<string, unknown>; expected_version?: number }>(req);
    if (!body.session_id) return { ok: false, error: "session_id required" };
    // the client may submit step data, but never completed/progress/evidence_hash — the server decides.
    const result = await withTenantTransaction(db, { company_id: ctx.company_id, user_id: ctx.user_id }, (tx) =>
      completeOnboardingStep(tx, ctx, { session_id: body.session_id!, step_key: step, data: body.data, expected_version: body.expected_version ?? null }));
    return { ok: result === "completed" || result === "already_completed", result };
  });
}
