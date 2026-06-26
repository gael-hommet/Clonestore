// Bypass d'authentification réservé au DÉVELOPPEMENT / TEST, pour pouvoir rendre
// et inspecter les pages connectées (Mon CloneStore, cockpit, messagerie) sans
// session Supabase réelle.
//
// SÉCURITÉ : la garde `NODE_ENV !== "production"` rend ce code MORT dans un build
// de production (la condition est évaluée à `false` à la compilation, le bloc est
// éliminé). Un visiteur ne peut donc jamais l'activer en production, même si la
// variable d'environnement était présente.

export function isAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1"
  );
}
