// GET  /api/partners/introductions — liste PAGINÉE (aucun plafond métier).
// POST /api/partners/introductions — le cabinet enregistre une entreprise, même si elle
//      n'a jamais cliqué sur son lien. Aucun quota : 1, 5, 20, 100 ou davantage.

import { NextResponse } from "next/server";
import { readJsonBounded } from "@/lib/founder-access/request-utils";
import { getPartnerDb, withService, withPartner } from "@/lib/partner-program/server/runtime";
import { resolvePartnerFromSession } from "@/lib/partner-program/server/partner-auth";
import { submitIntroduction, listIntroductionsPaged, clampPaging } from "@/lib/partner-program/server/introductions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const ERRORS: Record<string, { status: number; message: string }> = {
  company_required: { status: 422, message: "Le nom de l’entreprise est requis." },
  partner_not_found: { status: 404, message: "Cabinet introuvable." },
  partner_inactive: { status: 409, message: "Votre cabinet n’est pas encore actif : terminez l’onboarding pour enregistrer des entreprises." },
  company_already_protected: { status: 409, message: "Cette entreprise est déjà protégée par un autre cabinet." },
  self_referral: { status: 409, message: "Vous ne pouvez pas présenter votre propre cabinet." },
};

export async function GET(req: Request) {
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });

  const url = new URL(req.url);
  const { limit, offset } = clampPaging(Number(url.searchParams.get("limit") ?? 25), Number(url.searchParams.get("offset") ?? 0));
  const status = url.searchParams.get("status");

  const page = await withPartner(db, auth.partner.id, (tx) =>
    listIntroductionsPaged(tx, auth.partner.id, { limit, offset, status }),
  );
  return NextResponse.json({ ok: true, ...page }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_STORE });
  const companyName = str(body.companyName);
  if (!companyName) return NextResponse.json({ ok: false, error: "company_required", message: ERRORS.company_required.message }, { status: 422, headers: NO_STORE });

  const res = await withService(db, (tx) =>
    submitIntroduction(tx, auth.partner.id, {
      companyName,
      companyDomain: str(body.companyDomain) ?? str(body.website),
      contactName: str(body.contactName),
      contactEmail: str(body.contactEmail),
      contactPhone: str(body.contactPhone),
      note: str(body.note),
    }),
  );

  if (!res.ok) {
    const e = ERRORS[res.error] ?? { status: 422, message: "Enregistrement impossible." };
    return NextResponse.json({ ok: false, error: res.error, message: e.message }, { status: e.status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, introductionId: res.introductionId, duplicate: res.duplicate }, { headers: NO_STORE });
}
