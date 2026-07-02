// src/app/api/pierre/v1/product-access/route.ts
// PHASE 8.6 — the product-access surface. GET returns the governed resolveProductAccess() decision for
// the active tenant (the SAME authority every private route must gate on). Read-only; no binding needed.
import { withTenant } from "../_runtime";
import { resolveProductAccess } from "@/lib/pierre/v1/entitlements";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withTenant(req, async (db, ctx) => {
    const access = await resolveProductAccess(db, ctx);
    return { access };
  });
}
