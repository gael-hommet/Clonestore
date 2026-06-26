// Phase E.6 — GET /api/internal/founder-access/dashboard (admin + porte, no-store).
// Snapshot complet du Founder Command Center (overview, revenus, présence, funnel,
// acquisition, emails, alertes, sources). Données réelles uniquement.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { getFounderCommandCenterSnapshot } from "@/lib/founder-access/command-center";
import { getFounderPhase } from "@/lib/founder-access/commercial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);

  const db = await getRuntimeDb();
  const snapshot = await getFounderCommandCenterSnapshot(db);
  return NextResponse.json(
    { ...snapshot, commercial_phase: getFounderPhase() },
    { headers: { "cache-control": "private, no-store" } },
  );
}
