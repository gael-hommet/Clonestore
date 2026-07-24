// Liste canonique des préfixes de routes de l'ESPACE CONNECTÉ (sous l'app shell
// unifié, sans le header public). Utilisée par le header public (pour se masquer)
// et par les layouts connectés.

export const CONNECTED_ROUTE_PREFIXES = [
  "/profile",
  "/agents/pierre/use",
  "/agents/pierre/setup",
  "/agents/pierre/employees",
  // P12 — CloneOS app shell (console cockpit + salon + centre de contrôle).
  "/cockpit",
  "/mon-clonestore",
] as const;

export function isConnectedRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return CONNECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Cockpit d'ADMINISTRATION (Founder Command Center) : /founder et l'entrée historique au slug
 * /internal/<slug>/command-center.
 *
 * Séparé de CONNECTED_ROUTE_PREFIXES à dessein : cette liste alimente aussi le registre de
 * navigation client (route-registry), et le cockpit admin n'a rien à y faire — ce n'est pas
 * une surface client.
 *
 * Le header et le footer publics doivent disparaître : le cockpit apporte sa PROPRE coque
 * (barre latérale + barre supérieure). Sans cela, la navigation marketing se superposait
 * littéralement aux cartes du tableau de bord (constaté en navigateur).
 */
const ADMIN_COCKPIT_PREFIXES = ["/founder", "/internal"] as const;

export function isAdminCockpitRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ADMIN_COCKPIT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
