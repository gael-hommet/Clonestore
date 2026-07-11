// GET /partenaires/r/<public_slug> — URL PUBLIQUE PROPRE du lien de recommandation.
// Redirige vers la route technique de clic, qui enregistre le referral touch CÔTÉ SERVEUR
// et pose le cookie signé. L'attribution n'est jamais dérivée d'un paramètre navigateur.

import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const target = new URL("/api/partners/click", getBaseUrl());
  target.searchParams.set("partner", slug);
  return NextResponse.redirect(target);
}
