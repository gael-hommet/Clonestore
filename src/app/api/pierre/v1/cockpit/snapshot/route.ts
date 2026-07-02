// src/app/api/pierre/v1/cockpit/snapshot/route.ts
// PHASE 8.6 — the governed private cockpit snapshot. READ-gated by withProductAccess (consultation is
// permitted in allowed/grace/onboarding_required/suspended/read_only; denied is refused). The handler
// aggregates ONLY real, server-fetched tenant data; a data error returns a structured error (never a
// silent zero/empty/demo).
import { withProductAccess } from "../../_runtime";
import { buildCockpitSnapshot } from "@/lib/pierre/v1/cockpit-snapshot";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withProductAccess(req, "read", async (db, ctx, access) => {
    const snapshot = await buildCockpitSnapshot(db, ctx, access, new Date().toISOString());
    return { ok: true, snapshot };
  });
}
