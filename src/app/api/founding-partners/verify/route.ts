// CloneStory — CONFIRMATION SEAMLESS (POST uniquement, onboarding final).
// UN email → ce POST same-origin (clic humain) : vérifie l'email CloneStory, établit la
// session CloneStore (créée/restaurée, AUCUN second email), lie le compte au partenaire,
// pose le cookie membre, puis redirige DIRECTEMENT vers le registre. Le GET (page
// intermédiaire) ne consomme jamais le token → immunité scanners/prefetch.
//
// Dégradation gracieuse : même si l'auth Supabase échoue, le cookie membre (csy_member)
// donne accès au registre. Jamais de liaison automatique si une AUTRE adresse est connectée.

import { NextResponse } from "next/server";
import { buildMemberCookie } from "@/lib/clonestory/founding-partners/server/session";
import { recordObservabilityEvent } from "@/lib/clonestory/founding-partners/server/observability";
import { runSeamlessConfirm } from "@/lib/clonestory/founding-partners/server/auth-onboarding";
import { realSeamlessDeps } from "@/lib/clonestory/founding-partners/server/auth-onboarding-supabase";

export const runtime = "nodejs";
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

  // Réponse 303 vierge : les cookies d'auth Supabase + le cookie membre s'y attachent,
  // la destination est fixée à la fin selon le résultat.
  const res = new NextResponse(null, { status: 303 });
  const deps = realSeamlessDeps(req.headers.get("cookie"), res);
  const outcome = await runSeamlessConfirm(token, deps);

  if (outcome.state === "invalid") {
    await recordObservabilityEvent("verification_failed", { refType: "partner", level: "warn" });
    return NextResponse.redirect(fail, { status: 303 });
  }

  // Suffixe informatif pour la page de bienvenue (compte lié / à reconnecter / conflit).
  const account =
    outcome.state === "conflict" ? "&account=switch" :
    outcome.state === "account_taken" ? "&account=taken" :
    outcome.state === "auth_failed" ? "&account=retry" : "";
  await recordObservabilityEvent("verification_succeeded", {
    refType: "partner", refId: outcome.partnerId, evidence: { state: outcome.state, first: outcome.firstVerification },
  });

  res.headers.set("location", `${url.origin}/founding-partners/my-registry?welcome=${outcome.firstVerification ? 1 : 0}${account}`);
  res.headers.append("set-cookie", buildMemberCookie(outcome.partnerId));
  return res;
}
