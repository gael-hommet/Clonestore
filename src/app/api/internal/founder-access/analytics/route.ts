// Phase E.5/E.6 + E-R2 — GET /api/internal/founder-access/analytics (admin + porte, no-store).
// Funnel (événementiel + cohorté temporel), acquisition multi-dimensions, présence.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { funnelSnapshot, cohortFunnelSnapshot, acquisitionByDimension, presenceSnapshot, type AcquisitionDimension } from "@/lib/founder-access/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIMS = new Set<AcquisitionDimension>(["source", "source_medium", "campaign", "referrer"]);

export async function GET(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);

  const dimParam = new URL(req.url).searchParams.get("dimension");
  const dimension: AcquisitionDimension = dimParam && DIMS.has(dimParam as AcquisitionDimension) ? (dimParam as AcquisitionDimension) : "source";

  const db = await getRuntimeDb();
  const [funnel, cohort, acquisition, presence] = await Promise.all([
    funnelSnapshot(db), cohortFunnelSnapshot(db), acquisitionByDimension(db, dimension), presenceSnapshot(db),
  ]);
  return NextResponse.json(
    { funnel, cohort_funnel: cohort, acquisition, dimension, presence, source: "first-party", generated_at: new Date().toISOString() },
    { headers: { "cache-control": "private, no-store" } },
  );
}
