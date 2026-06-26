// CloneStory — capture du clic de lien partenaire (POST, déclenché par le beacon /r).
// Pose le cookie d'attribution first-touch signé + crée l'attribution anonyme. Gated
// par JS (les scanners sans JS ne déclenchent pas → pas d'attribution forte par bot ;
// la visite reste journalisée par la page /r via recordLinkUsage). Rate-limité.

import { NextResponse } from "next/server";
import { getClientIp, hashIp, rateLimit, readJsonBounded } from "@/lib/founder-access/request-utils";
import { findPartnerByCode, findPartnerByLinkToken } from "@/lib/clonestory/founding-partners/server/store";
import { capturePartnerVisit } from "@/lib/clonestory/founding-partners/server/attribution";
import {
  buildAttributionCookie,
  newVisitorId,
  readAttributionCookie,
} from "@/lib/clonestory/founding-partners/server/attribution-cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const NO_STORE = { "cache-control": "private, no-store" };
const ok = () => NextResponse.json({ ok: true }, { headers: NO_STORE });

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`csy-visit:${ip ?? "anon"}`, 30, 60_000).ok) return ok(); // neutre

  const body = await readJsonBounded<{ code?: unknown }>(req);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) return ok();

  // Lien stable par code, repli legacy `fp_…`. findPartnerByCode filtre déjà les révoqués.
  const partner = (await findPartnerByCode(code)) ?? (await findPartnerByLinkToken(code));
  if (!partner) return ok(); // neutre, aucun cookie

  const existingVisitorId = readAttributionCookie(req.headers.get("cookie"));
  const visitorId = existingVisitorId ?? newVisitorId();

  try {
    await capturePartnerVisit({
      partnerId: partner.id,
      visitorId,
      existingVisitorId,
      hashedIp: hashIp(ip),
    });
  } catch {
    /* best-effort : ne jamais bloquer l'expérience publique */
  }

  const res = ok();
  // First-touch : ne (re)pose le cookie que s'il n'existait pas déjà (préserve l'origine).
  if (!existingVisitorId) res.headers.set("set-cookie", buildAttributionCookie(visitorId));
  return res;
}
