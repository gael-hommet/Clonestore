// POST /api/partners/contract/accept — le cabinet accepte électroniquement les conditions.
// Déclenche immédiatement une TENTATIVE d'activation automatique : si Stripe Connect est
// déjà complet, le partenaire devient ACTIF ici même, sans aucune intervention admin.

import { NextResponse } from "next/server";
import { getPartnerDb, withService } from "@/lib/partner-program/server/runtime";
import { resolvePartnerFromSession } from "@/lib/partner-program/server/partner-auth";
import { acceptContract } from "@/lib/partner-program/server/partners";
import { CONTRACT_VERSION } from "@/lib/partner-program/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function POST() {
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });

  const result = await withService(db, (tx) => acceptContract(tx, auth.partner.id, CONTRACT_VERSION));

  return NextResponse.json(
    {
      ok: true,
      contractVersion: CONTRACT_VERSION,
      activated: result.activated,
      // Étapes restantes explicites (jamais un message vague).
      remaining: result.activated ? [] : result.remaining,
      reason: result.activated ? null : result.reason,
    },
    { headers: NO_STORE },
  );
}
