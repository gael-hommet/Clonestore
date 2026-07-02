// src/app/api/pierre/v1/onboarding/route.ts
// PHASE 8.6 — onboarding state for the active tenant (server-authoritative). GET returns the session +
// steps merged with the registry + the ready blockers. Read-only.
import { withProductAccess } from "../_runtime";
import { getOnboardingState } from "@/lib/pierre/v1/onboarding-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withProductAccess(req, "onboarding", async (db, ctx) => {
    return getOnboardingState(db, ctx);
  });
}
