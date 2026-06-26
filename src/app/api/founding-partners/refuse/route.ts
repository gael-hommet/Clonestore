// CloneStory — CONSOMMATION du refus d'introduction (POST uniquement, CS-FINAL 4).
// Le GET (page intermédiaire) ne refuse JAMAIS : seul ce POST same-origin annule
// l'introduction + purge la PII (CNIL), de façon idempotente. Anti-scanner/prefetch GET.

import { NextResponse } from "next/server";
import { refuseIntroduction } from "@/lib/clonestory/founding-partners/server/store";
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

  const result = await refuseIntroduction(token);
  await recordObservabilityEvent("introduction_refused", { refType: "introduction", level: "info", evidence: { ok: result.ok } });
  return NextResponse.redirect(`${url.origin}/founding-partners/merci?c=${result.ok ? "refus" : "invalide"}`, { status: 303 });
}
