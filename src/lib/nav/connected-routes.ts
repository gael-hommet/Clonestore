// Liste canonique des préfixes de routes de l'ESPACE CONNECTÉ (sous l'app shell
// unifié, sans le header public). Utilisée par le header public (pour se masquer)
// et par les layouts connectés.

export const CONNECTED_ROUTE_PREFIXES = [
  "/profile",
  "/agents/pierre/use",
  "/agents/pierre/setup",
  "/agents/pierre/employees",
] as const;

export function isConnectedRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return CONNECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
