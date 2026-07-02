// CloneStory — pont de session vers le registre privé (GET).
// Un partenaire CONNECTÉ à son compte CloneStore (session Supabase) peut ouvrir son
// registre privé sans refaire la vérification e-mail : on résout son partenaire par
// e-mail AUTHENTIFIÉ et, s'il est vérifié, on émet le cookie membre `csy_member` puis
// on redirige vers le registre. Sécurité : le cookie n'est JAMAIS émis pour un autre
// partenaire (l'identité vient de la session serveur, pas du client), ni pour un
// partenaire suspendu/retiré/non-vérifié. Le lien `/r/<code>` reste, lui, public et
// ne donne jamais accès au registre.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { resolvePartnerSession } from "@/lib/clonestory/founding-partners/server/cockpit";
import { buildMemberCookie } from "@/lib/clonestory/founding-partners/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wantsIntro = url.searchParams.get("intro") === "1";
  const registry = new URL(
    wantsIntro ? "/founding-partners/my-registry#introduire" : "/founding-partners/my-registry",
    url.origin,
  );
  const fallback = new URL("/founding-partners", url.origin);

  let email: string | null = null;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  } catch {
    email = null;
  }
  if (!email) return NextResponse.redirect(fallback);

  let session: { partnerId: string; status: string } | null = null;
  try {
    session = await resolvePartnerSession(email);
  } catch {
    return NextResponse.redirect(fallback);
  }

  // Cookie émis UNIQUEMENT pour un partenaire vérifié dont l'e-mail correspond.
  if (!session || session.status !== "verified") return NextResponse.redirect(fallback);

  const res = NextResponse.redirect(registry);
  res.headers.set("set-cookie", buildMemberCookie(session.partnerId));
  return res;
}
