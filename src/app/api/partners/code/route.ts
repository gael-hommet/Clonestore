// GET  /api/partners/code — récupère le code de recommandation (re-partageable).
// POST /api/partners/code — le fait tourner (révoque l'ancien, en émet un nouveau).
//
// Le code n'est JAMAIS stocké en clair : il est chiffré (AES-256-GCM, clé hors base) et
// déchiffré à la demande, pour le partenaire propriétaire uniquement. Si le chiffrement
// n'est pas configuré, seul l'indice est renvoyé et la rotation reste possible.

import { NextResponse } from "next/server";
import { readJsonBounded } from "@/lib/founder-access/request-utils";
import { getPartnerDb, withService, withPartner } from "@/lib/partner-program/server/runtime";
import { resolvePartnerFromSession } from "@/lib/partner-program/server/partner-auth";
import { getShareableCode, rotateReferralCode } from "@/lib/partner-program/server/partners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function GET() {
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });

  const c = await withPartner(db, auth.partner.id, (tx) => getShareableCode(tx, auth.partner.id));
  if (!c) return NextResponse.json({ ok: false, code: "NO_CODE" }, { status: 404, headers: NO_STORE });

  return NextResponse.json(
    { ok: true, code: c.code, hint: c.hint, generation: c.generation, retrievable: c.code !== null },
    { headers: NO_STORE },
  );
}

export async function POST(req: Request) {
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });

  const body = await readJsonBounded<Record<string, unknown>>(req);
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "rotation demandée par le cabinet";

  const res = await withService(db, (tx) => rotateReferralCode(tx, auth.partner.id, `partner:${auth.partner.id}`, reason));
  return NextResponse.json({ ok: true, code: res.code }, { headers: NO_STORE });
}
