// POST /api/partners/introductions — le cabinet propose une entreprise (mise en relation).
// GET — liste ses introductions. Auth cabinet ; écriture en mode service, isolation par partner.

import { NextResponse } from "next/server";
import { readJsonBounded } from "@/lib/founder-access/request-utils";
import { getPartnerDb, withService, withPartner } from "@/lib/partner-program/server/runtime";
import { resolvePartnerFromSession } from "@/lib/partner-program/server/partner-auth";
import { submitIntroduction, listIntroductions } from "@/lib/partner-program/server/introductions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function GET() {
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });
  const list = await withPartner(db, auth.partner.id, (tx) => listIntroductions(tx, auth.partner.id));
  return NextResponse.json({ ok: true, introductions: list }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const db = await getPartnerDb();
  const auth = await resolvePartnerFromSession(db, withService);
  if (!auth.ok) return NextResponse.json({ ok: false, code: auth.code }, { status: auth.status, headers: NO_STORE });

  const body = await readJsonBounded<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_STORE });
  const companyName = str(body.companyName);
  if (!companyName) return NextResponse.json({ ok: false, error: "company_required" }, { status: 422, headers: NO_STORE });

  const res = await withService(db, (tx) =>
    submitIntroduction(tx, auth.partner.id, { companyName, contactName: str(body.contactName), contactEmail: str(body.contactEmail), note: str(body.note) }),
  );
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.error === "company_already_protected" ? 409 : 422, headers: NO_STORE });
  return NextResponse.json({ ok: true, introductionId: res.introductionId, duplicate: res.duplicate }, { headers: NO_STORE });
}
