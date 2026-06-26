// CloneStory — CONSOMMATION de la vérification email (POST uniquement, CS-FINAL 4).
// Le GET (page intermédiaire) ne consomme JAMAIS le token : seul ce POST, déclenché par
// une action humaine same-origin, vérifie l'email, ouvre la session membre et redirige.
// Immunise contre les scanners/prefetch GET des fournisseurs email.

import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/clonestory/founding-partners/server/store";
import { buildMemberCookie } from "@/lib/clonestory/founding-partners/server/session";
import { recordObservabilityEvent } from "@/lib/clonestory/founding-partners/server/observability";

export const dynamic = "force-dynamic";

function sameOrigin(req: Request): boolean {
  const o = req.headers.get("origin");
  if (!o) return false; // un POST de formulaire envoie toujours Origin
  try { return new URL(o).host === (req.headers.get("host") ?? ""); } catch { return false; }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const fail = `${url.origin}/founding-partners/join?acces=invalide`;
  if (!sameOrigin(req)) return NextResponse.redirect(fail, { status: 303 });

  let token = "";
  try {
    const form = await req.formData();
    token = String(form.get("token") ?? "");
  } catch { /* corps absent */ }

  const result = await verifyEmailToken(token);
  if (!result.ok) {
    await recordObservabilityEvent("verification_failed", { refType: "partner", level: "warn" });
    return NextResponse.redirect(fail, { status: 303 });
  }
  await recordObservabilityEvent("verification_succeeded", { refType: "partner", refId: result.partner.id, evidence: { first: result.firstVerification } });
  const res = NextResponse.redirect(`${url.origin}/founding-partners/my-registry?bienvenue=${result.firstVerification ? 1 : 0}`, { status: 303 });
  res.headers.append("set-cookie", buildMemberCookie(result.partner.id));
  return res;
}
