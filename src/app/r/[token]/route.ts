// CloneStory — ALIAS COURT du lien partenaire : /r/<code> → /founding-partners/r/<code>.
//
// Le format canonique reste `/founding-partners/r/<code>` (généré par le cockpit, les
// emails et le registre). Cet alias court, plus partageable (oral, carte, DM), redirige
// simplement vers la page canonique. REDIRECTION PURE : jamais de consommation de token,
// aucune logique métier, aucune écriture, aucune donnée. Le code partenaire n'est pas un
// secret à usage unique (identifiant public stable) — la redirection est donc sûre.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const origin = new URL(req.url).origin;
  // 307 (temporaire) : la cible canonique peut évoluer ; aucun cache permanent imposé.
  return NextResponse.redirect(`${origin}/founding-partners/r/${encodeURIComponent(token)}`, { status: 307 });
}
