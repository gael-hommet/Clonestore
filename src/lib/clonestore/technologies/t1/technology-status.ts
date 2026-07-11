// src/lib/clonestore/technologies/t1/technology-status.ts
// T1 — Résolution de mode/statut, DÉRIVÉE du gate de production RÉEL (P10, plancher dur :
// PRODUCTION_AUTHORIZED = false, jamais levé par le code). En T1 : aucun provider live
// vérifié → l'exécution live est IMPOSSIBLE ; les technos à dépendance live sont
// `live_disabled` (elles préparent, l'humain complète).

import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import type { LiveDependency, TechnologyMode, TechnologyStatus } from "./technology-types";

/** Aucun provider live vérifié en T1 (Yousign bloqué P8.7.4, email/SIRH/push/voix externes). */
const LIVE_PROVIDERS_VERIFIED = false as const;

/** La production est-elle autorisée ? Dérivé du plancher dur P10 (const false). */
export function technologyProductionAllowed(): boolean {
  return PRODUCTION_AUTHORIZED;
}

/** L'exécution LIVE est-elle permise ? Exige production autorisée ET providers vérifiés → false en T1. */
export function isLiveExecutionAllowed(): boolean {
  return PRODUCTION_AUTHORIZED && LIVE_PROVIDERS_VERIFIED;
}

export interface TechnologyModeMeta {
  readonly status: TechnologyStatus;
  readonly liveDependency: LiveDependency;
}

/**
 * Résout le mode d'exécution d'une technologie. FAIL-CLOSED :
 *  - techno désactivée → `blocked` ;
 *  - aucune dépendance live → `local_safe` (préparation locale sûre) ;
 *  - dépendance live (provider/external/owner_attestation) → `live_disabled` tant que
 *    l'exécution live n'est pas permise (donc toujours en T1) — jamais `live_ready`.
 */
export function resolveTechnologyMode(meta: TechnologyModeMeta): TechnologyMode {
  if (meta.status === "disabled") return "blocked";
  if (meta.liveDependency === "none") return "local_safe";
  return isLiveExecutionAllowed() ? "live_ready" : "live_disabled";
}
