// CloneStory — demande de retrait des données (RGPD, POST public).
// Enregistre la demande (traitée par l'administration). Réponse uniforme.

import { NextResponse } from "next/server";
import { getClientIp, rateLimit, readJsonBounded } from "@/lib/founder-access/request-utils";
import { requestWithdrawal } from "@/lib/clonestory/founding-partners/server/store";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`csy-withdraw:${ip ?? "anon"}`, 5, 60_000).ok) return NextResponse.json({ ok: true }, { headers: NO_STORE });
  const body = await readJsonBounded<Record<string, unknown>>(req);
  const email = body && typeof body.email === "string" ? body.email : "";
  await requestWithdrawal(email);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
