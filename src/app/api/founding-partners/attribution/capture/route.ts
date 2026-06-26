// CloneStory — capture d'attribution à la création/première session de compte (POST).
// AUTHENTIFIÉ : l'e-mail vient de la session Supabase serveur (preuve), jamais du body.
// Idempotent : relier à un compte déjà attribué ne crée aucun doublon. Lie aussi
// l'entreprise via le signal authentifié `user_metadata.company_name` (dédup empreinte).
// Réponse NEUTRE (aucune donnée partenaire/preuve interne exposée au navigateur).

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { captureAccountAttribution } from "@/lib/clonestory/founding-partners/server/attribution";
import { readAttributionCookie } from "@/lib/clonestory/founding-partners/server/attribution-cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(req: Request) {
  let user: { id: string; email: string | null; companyName: string | null } | null = null;
  try {
    const supabase = supabaseServer();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const companyName = typeof meta.company_name === "string" ? meta.company_name : null;
      user = { id: data.user.id, email: data.user.email ?? null, companyName };
    }
  } catch {
    user = null;
  }
  if (!user) return NextResponse.json({ ok: false, attributed: false }, { status: 401, headers: NO_STORE });

  const visitorId = readAttributionCookie(req.headers.get("cookie"));
  try {
    const decision = await captureAccountAttribution({
      accountUserId: user.id,
      email: user.email,
      companyName: user.companyName,
      visitorId,
    });
    // Réponse neutre : on ne révèle ni le partenaire, ni les preuves internes.
    return NextResponse.json({ ok: decision.ok, attributed: decision.attributed }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, attributed: false }, { status: 503, headers: NO_STORE });
  }
}
