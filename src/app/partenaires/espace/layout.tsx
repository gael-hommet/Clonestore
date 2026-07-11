// src/app/partenaires/espace/layout.tsx
// Espace Cabinet Fondateur — segment authentifié. Gate SESSION côté serveur : réutilise le signal
// Supabase EXISTANT (getUser). Non connecté → /login?redirect=/partenaires/espace. Le statut « pas
// encore partenaire » (NOT_A_PARTNER) est géré côté page (l'API /api/partners/me le renvoie en 404) :
// un utilisateur connecté mais non-partenaire voit un message dédié, il n'est pas renvoyé au login.

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { buildLoginRedirect } from "@/lib/auth/redirects";

export const dynamic = "force-dynamic";

export default async function PartnerSpaceLayout({ children }: { children: React.ReactNode }) {
  let connected = false;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    connected = Boolean(data.user?.id);
  } catch {
    connected = false; // fail-closed : en cas d'ambiguïté, on demande une connexion.
  }
  if (!connected) redirect(buildLoginRedirect("/partenaires/espace"));
  return <>{children}</>;
}
