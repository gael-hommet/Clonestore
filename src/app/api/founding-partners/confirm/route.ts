// CloneStory — CONSOMMATION de la confirmation d'introduction (POST uniquement, CS-FINAL 4).
// Le GET (page intermédiaire) ne confirme JAMAIS : seul ce POST same-origin consomme le
// token stateless, de façon idempotente (double-clic sûr). Anti-scanner/prefetch GET.

import { NextResponse } from "next/server";
import { confirmIntroduction } from "@/lib/clonestory/founding-partners/server/store";
import { recordObservabilityEvent } from "@/lib/clonestory/founding-partners/server/observability";

export const dynamic = "force-dynamic";

function sameOrigin(req: Request): boolean {
  const o = req.headers.get("origin");
  if (!o) return false;
  try { return new URL(o).host === (req.headers.get("host") ?? ""); } catch { return false; }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!sameOrigin(req)) return NextResponse.redirect(`${url.origin}/founding-partners/merci?c=invalide`, { status: 303 });

  let token = "";
  try {
    const form = await req.formData();
    token = String(form.get("token") ?? "");
  } catch { /* corps absent */ }

  const result = await confirmIntroduction(token);
  const status = !result.ok ? "invalide" : result.disputed ? "revue" : "ok";
  await recordObservabilityEvent(result.ok ? "introduction_confirmed" : "introduction_confirm_failed", {
    refType: "introduction", refId: result.ok ? result.introductionId : null, level: result.ok ? "info" : "warn",
    evidence: result.ok ? { disputed: result.disputed, already: result.already ?? false } : {},
  });
  return NextResponse.redirect(`${url.origin}/founding-partners/merci?c=${status}`, { status: 303 });
}
