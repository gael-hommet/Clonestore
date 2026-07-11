// Programme « Cabinets Fondateurs CloneStore » — feature flags fail-closed.
// Convention repo : default-OFF (readEnvFlag renvoie false si la variable est absente).
// Les DEUX flags sont indépendants : activer le programme n'active JAMAIS les payouts.

import { readEnvFlag } from "@/lib/features/product-availability";

/**
 * Programme partenaires ouvert ? (candidatures, landing form, espace partenaire,
 * capture d'attribution, pont webhook commissions). OFF par défaut.
 * Activation : PARTNER_PROGRAM_ENABLED=true.
 */
export function isPartnerProgramEnabled(): boolean {
  return readEnvFlag("PARTNER_PROGRAM_ENABLED");
}

/**
 * Job de versement Stripe Connect actif ? OFF par défaut, indépendant du programme.
 * Même actif, le job reste soumis au plancher production (jamais de transfert avec
 * une clé live tant que la production n'est pas autorisée) et au dry-run.
 * Activation : PARTNER_PAYOUTS_ENABLED=true.
 */
export function isPartnerPayoutsEnabled(): boolean {
  return readEnvFlag("PARTNER_PAYOUTS_ENABLED");
}

/**
 * Le job de payout écrit-il réellement chez Stripe ? Par défaut NON : tant que
 * PARTNER_PAYOUT_DRY_RUN n'est pas EXPLICITEMENT "false", le job calcule les lots,
 * journalise le rapport, mais ne crée AUCUN transfert Stripe (shadow mode).
 */
export function isPartnerPayoutDryRun(): boolean {
  const raw = (process.env.PARTNER_PAYOUT_DRY_RUN ?? "").trim().toLowerCase();
  return !(raw === "false" || raw === "0" || raw === "off");
}
