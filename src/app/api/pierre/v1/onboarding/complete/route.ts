// src/app/api/pierre/v1/onboarding/complete/route.ts
// PHASE 8.6 — complete the onboarding session (the READY gate). Returns 'completed' only when every
// required step is complete AND there is an active entitlement AND an active owner; otherwise a blocker.
import { withProductAccess, jsonBody } from "../../_runtime";
import { withTenantTransaction } from "@/lib/pierre/v1/tenant-tx";
import { completeOnboardingSession } from "@/lib/pierre/v1/onboarding-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return withProductAccess(req, "onboarding", async (db, ctx) => {
    const body = await jsonBody<{ session_id?: string }>(req);
    if (!body.session_id) return { ok: false, error: "session_id required" };
    const result = await withTenantTransaction(db, { company_id: ctx.company_id, user_id: ctx.user_id }, (tx) =>
      completeOnboardingSession(tx, ctx, body.session_id!));
    return { ok: result === "completed", result };
  });
}
