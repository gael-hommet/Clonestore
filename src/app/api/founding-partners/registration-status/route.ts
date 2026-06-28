// CloneStory — STATUT d'inscription pour la page d'attente (polling). POST avec le jeton
// de consultation SIGNÉ (sessionStorage côté client). Renvoie UNIQUEMENT l'état
// (pending | verified | linked | expired) + un e-mail MASQUÉ. Aucune PII complète, aucun
// token CloneStory, aucune donnée d'un autre utilisateur. Rate-limité.

import { NextResponse } from "next/server";
import { rateLimit, readJsonBounded, getClientIp } from "@/lib/founder-access/request-utils";
import { readStatusToken } from "@/lib/clonestory/founding-partners/server/session";
import { getRegistrationStatus } from "@/lib/clonestory/founding-partners/server/store";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`csy-regstatus:${ip ?? ""}`, 60, 60_000).ok) {
    return NextResponse.json({ status: "expired" }, { status: 429, headers: NO_STORE });
  }
  const body = await readJsonBounded<{ token?: unknown }>(req);
  const token = typeof body?.token === "string" ? body.token : null;
  const partnerId = readStatusToken(token);
  if (!partnerId) return NextResponse.json({ status: "expired" }, { headers: NO_STORE });

  try {
    const r = await getRegistrationStatus(partnerId);
    if (!r) return NextResponse.json({ status: "expired" }, { headers: NO_STORE });
    return NextResponse.json({ status: r.status, emailMasked: r.emailMasked }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ status: "failed" }, { status: 503, headers: NO_STORE });
  }
}
