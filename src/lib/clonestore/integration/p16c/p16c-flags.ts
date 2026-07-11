// src/lib/clonestore/integration/p16c/p16c-flags.ts
// P16C — drapeau d'intégration. L'enrichissement de gouvernance P16C dans CloneChat est ADDITIF et
// EN LECTURE SEULE (il n'active AUCUN effet, n'exécute RIEN) : il est actif par défaut, avec un kill
// switch d'urgence explicite `P16C_INTEGRATION_ENABLED=false`. Ne touche JAMAIS production/paiement/live.

const OFF_VALUES = new Set(["false", "0", "off", "disabled", "no"]);

/** Enrichissement de gouvernance P16C actif ? Défaut ON ; kill switch explicite uniquement. Pur. */
export function isP16CIntegrationEnabled(): boolean {
  const raw = process.env.P16C_INTEGRATION_ENABLED;
  if (typeof raw !== "string" || raw.trim() === "") return true; // additif read-only : actif par défaut
  return !OFF_VALUES.has(raw.trim().toLowerCase());
}
