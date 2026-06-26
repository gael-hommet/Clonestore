// CloneStory — état de l'espace partenaire pour le cockpit « Mon espace » (GET).
// Authentifie l'utilisateur CloneStore SERVEUR (session Supabase), résout son statut
// CloneStory de façon RLS-safe, et renvoie un résumé SÛR (aucun token brut, aucun
// secret, aucune donnée d'un autre partenaire). Jamais falsifiable côté navigateur :
// l'identité provient de la session serveur, pas d'un paramètre client.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { resolvePartnerCockpit, type CockpitState } from "@/lib/clonestory/founding-partners/server/cockpit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const NO_STORE = { "cache-control": "private, no-store" };

const NON_MEMBER: CockpitState = { authenticated: false, member: false, status: "non_member" };

export async function GET() {
  let user: { id: string; email: string | null } | null = null;
  try {
    const supabase = supabaseServer();
    const { data } = await supabase.auth.getUser();
    if (data.user) user = { id: data.user.id, email: data.user.email ?? null };
  } catch {
    user = null;
  }

  if (!user) return NextResponse.json(NON_MEMBER, { headers: NO_STORE });

  try {
    const state = await resolvePartnerCockpit({ userId: user.id, email: user.email });
    return NextResponse.json(state, { headers: NO_STORE });
  } catch {
    // Échec d'infra (DB indisponible…) → état neutre, jamais d'exposition interne.
    return NextResponse.json(
      { authenticated: true, member: false, status: "error" } satisfies CockpitState,
      { headers: NO_STORE },
    );
  }
}
