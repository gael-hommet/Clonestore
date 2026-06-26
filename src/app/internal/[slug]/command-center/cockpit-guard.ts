// Garde d'accès du Founder Command Center, extraite du rendu pour être réutilisée par
// DEUX entrées : l'URL historique au slug (/internal/[slug]/command-center) et l'URL
// officielle sans slug (/founder). MÊME ordre fail-closed, MÊMES protections :
//   porte propriétaire (mot de passe + cookie signé) → session Supabase → allowlist email.
// Aucune protection n'est retirée ; seul le slug (obscurité) est optionnel selon l'entrée.

import { resolveFounderAdmin, resolveOwnerGateState } from "@/lib/founder-access/admin-guard";

export type CockpitAccess =
  | { kind: "notfound" }
  | { kind: "locked" }
  | { kind: "redirect"; to: string }
  | { kind: "ok"; email: string };

/**
 * Garde commune (sans slug) : porte → session → allowlist. `loginReturnPath` est l'URL
 * vers laquelle revenir après connexion Supabase (ex. "/founder" ou le chemin au slug).
 */
export async function resolveFounderCockpitAccess(
  { cookieHeader, loginReturnPath }: { cookieHeader: string | null; loginReturnPath: string },
): Promise<CockpitAccess> {
  const diag = process.env.CLONESTORE_OWNER_GATE_DIAG === "1";
  const gate = resolveOwnerGateState(cookieHeader);
  if (gate === "misconfigured") {
    if (diag) console.warn("[owner-gate-diag]", JSON.stringify({ owner_gate_state: gate, return_path: loginReturnPath }));
    return { kind: "notfound" };
  }
  if (gate === "locked") {
    if (diag) console.warn("[owner-gate-diag]", JSON.stringify({ owner_gate_state: gate, return_path: loginReturnPath }));
    return { kind: "locked" };
  }

  const auth = await resolveFounderAdmin();
  if (diag) console.warn("[owner-gate-diag]", JSON.stringify({
    owner_gate_state: gate,
    auth_reason: auth.ok ? "authenticated" : auth.reason,
    return_path: loginReturnPath,
  }));
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") return { kind: "redirect", to: `/login?next=${loginReturnPath}` };
    return { kind: "notfound" };
  }
  return { kind: "ok", email: auth.email };
}

/**
 * Entrée HISTORIQUE au slug : exige un slug exact (sinon notfound) PUIS délègue à la garde
 * commune. La 404 d'un mauvais slug est aussi émise au bord par le middleware (vrai statut).
 */
export async function resolveCockpitAccess(slug: string, cookieHeader: string | null): Promise<CockpitAccess> {
  const expected = process.env.CLONESTORE_OWNER_COCKPIT_SLUG;
  if (!expected || slug !== expected) return { kind: "notfound" };
  return resolveFounderCockpitAccess({ cookieHeader, loginReturnPath: `/internal/${slug}/command-center` });
}
