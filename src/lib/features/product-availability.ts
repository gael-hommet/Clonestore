// Registre central de disponibilité produit (feature flags serveur).
//
// Source de vérité unique pour savoir si une expérience produit est réellement
// ouverte. Le blocage doit être RÉEL (serveur + API), jamais un simple masquage
// de bouton ou un overlay contournable.
//
// CloneChat : RÉVÉLÉ (C1.2). La surface authentifiée réelle (/assistant) est
// montée par DÉFAUT. Le drapeau ne sert plus qu'à un ARRÊT D'URGENCE explicite :
// `CLONECHAT_ENABLED=false` coupe la page ET l'API (fail-closed) et affiche un
// état « temporairement indisponible » honnête — jamais l'ancien placeholder de lancement.
// Une variable NON DÉFINIE n'a plus le pouvoir de cacher le produit.
//
// Cette règle est CANONIQUE : la page (layout serveur) et l'API
// (/api/assistant/chat) l'utilisent toutes les deux — jamais deux règles divergentes.
//
// Fonctions pures, sûres en SSR. Aucune dépendance node:* (les flags sont lus
// depuis process.env, disponible côté serveur Next).

/** Lit un flag booléen d'environnement. Désactivé par défaut. Exporté pour réutilisation
 *  (mêmes sémantiques partout : true/1/on/enabled, insensible à la casse). */
export function readEnvFlag(name: string): boolean {
  const raw = process.env[name];
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "on" || v === "enabled";
}

/** Valeurs d'arrêt d'urgence explicite (kill switch). */
const EMERGENCY_OFF_VALUES = new Set(["false", "0", "off", "disabled", "no"]);

export type ProductKey = "clonechat";

/**
 * CloneChat est-il actif ?
 *
 * C1.2 — ACTIF PAR DÉFAUT pour l'usage produit authentifié. La seule façon de le
 * couper est un arrêt d'urgence EXPLICITE : `CLONECHAT_ENABLED=false|0|off|disabled|no`.
 * Une variable absente ou vide → ACTIF (le produit n'est plus caché par défaut).
 *
 * Note : « actif » ne signifie PAS « accès public anonyme » — l'API exige toujours
 * une authentification Supabase et une entreprise résolue côté serveur.
 */
export function isCloneChatEnabled(): boolean {
  const raw = process.env.CLONECHAT_ENABLED;
  if (typeof raw !== "string" || raw.trim() === "") return true; // révélé : actif par défaut
  return !EMERGENCY_OFF_VALUES.has(raw.trim().toLowerCase());
}

/** Arrêt d'urgence explicite détecté (kill switch armé) — inverse de l'activation. */
export function isCloneChatEmergencyDisabled(): boolean {
  return !isCloneChatEnabled();
}

export function isProductEnabled(product: ProductKey): boolean {
  switch (product) {
    case "clonechat":
      return isCloneChatEnabled();
    default:
      return false;
  }
}
