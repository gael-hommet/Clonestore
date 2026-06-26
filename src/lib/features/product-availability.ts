// Registre central de disponibilité produit (feature flags serveur).
//
// Source de vérité unique pour savoir si une expérience produit est réellement
// ouverte en production. Le blocage doit être RÉEL (serveur + API), jamais un
// simple masquage de bouton ou un overlay contournable.
//
// CloneChat : produit non terminé. Sa PAGE de présentation reste intacte
// (visuellement parfaite), mais le produit est désactivé par défaut. Pour le
// réactiver plus tard, il suffit d'une seule variable d'environnement —
// `CLONECHAT_ENABLED=true` — sans toucher au code.
//
// Fonctions pures, sûres en SSR. Aucune dépendance node:* (les flags sont lus
// depuis process.env, disponible côté serveur Next).

/** Lit un flag booléen d'environnement. Désactivé par défaut. */
function readEnvFlag(name: string): boolean {
  const raw = process.env[name];
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "on" || v === "enabled";
}

export type ProductKey = "clonechat";

/**
 * CloneChat est-il ouvert ?
 * Désactivé par défaut. Activable via `CLONECHAT_ENABLED=true`.
 */
export function isCloneChatEnabled(): boolean {
  return readEnvFlag("CLONECHAT_ENABLED");
}

export function isProductEnabled(product: ProductKey): boolean {
  switch (product) {
    case "clonechat":
      return isCloneChatEnabled();
    default:
      return false;
  }
}
