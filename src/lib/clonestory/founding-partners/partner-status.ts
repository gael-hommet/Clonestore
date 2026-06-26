// CloneStory — Le Cercle des Partenaires Fondateurs
// partner-status.ts — Machine d'état STRICTE du statut partenaire.
//
// Invariant fondateur : tout le monde peut s'inscrire (registered), mais un
// inscrit n'est PAS automatiquement Partenaire Fondateur public. Le titre
// (founding_partner) + le numéro de registre ne sont accordés QU'APRÈS une
// contribution réelle et vérifiée — modélisé par la transition vers
// `founding_partner`, qui exige `verifiedContributions >= 1`.

import type { PartnerStatus } from "./types";
import { PUBLIC_TITLE_STATUSES } from "./types";

/** Erreur typée pour toute transition de statut interdite. */
export class PartnerTransitionError extends Error {
  constructor(
    public readonly from: PartnerStatus,
    public readonly to: PartnerStatus,
    public readonly reason: string,
  ) {
    super(`Transition partenaire interdite : ${from} → ${to} (${reason})`);
    this.name = "PartnerTransitionError";
  }
}

/**
 * Transitions autorisées. Une transition absente de cette table est interdite.
 * - registered → email_verified
 * - email_verified → identity_verified
 * - identity_verified → active_contributor (dès la première introduction)
 * - active_contributor → founding_partner (UNIQUEMENT avec ≥1 contribution vérifiée)
 * - suspended / withdrawn accessibles depuis la plupart des états actifs
 * - un compte suspendu peut être réactivé vers son état actif précédent (géré
 *   explicitement par `reinstate`, hors table générique pour rester sûr).
 */
const ALLOWED: Readonly<Record<PartnerStatus, ReadonlySet<PartnerStatus>>> = {
  registered: new Set(["email_verified", "withdrawn", "suspended"]),
  email_verified: new Set(["identity_verified", "withdrawn", "suspended"]),
  identity_verified: new Set(["active_contributor", "founding_partner", "withdrawn", "suspended"]),
  active_contributor: new Set(["founding_partner", "withdrawn", "suspended"]),
  founding_partner: new Set(["withdrawn", "suspended"]),
  suspended: new Set(["withdrawn", "email_verified", "identity_verified", "active_contributor", "founding_partner"]),
  withdrawn: new Set([]), // terminal
};

export interface PartnerTransitionContext {
  /** Nombre de contributions vérifiées du partenaire (dérivé des événements). */
  readonly verifiedContributions: number;
}

/** True si la transition est structurellement listée comme possible. */
export function isPartnerTransitionListed(from: PartnerStatus, to: PartnerStatus): boolean {
  return ALLOWED[from]?.has(to) ?? false;
}

/**
 * Valide une transition de statut. Lève `PartnerTransitionError` si interdite.
 * Applique l'invariant métier : on ne devient `founding_partner` qu'avec au
 * moins une contribution vérifiée.
 */
export function assertPartnerTransition(
  from: PartnerStatus,
  to: PartnerStatus,
  ctx: PartnerTransitionContext,
): void {
  if (from === to) {
    throw new PartnerTransitionError(from, to, "transition vers le même état");
  }
  if (!isPartnerTransitionListed(from, to)) {
    throw new PartnerTransitionError(from, to, "transition non autorisée");
  }
  if (to === "founding_partner" && ctx.verifiedContributions < 1) {
    throw new PartnerTransitionError(
      from,
      to,
      "le titre exige au moins une contribution vérifiée",
    );
  }
}

/** Variante non-levante : retourne le nouvel état ou null si interdit. */
export function nextPartnerStatus(
  from: PartnerStatus,
  to: PartnerStatus,
  ctx: PartnerTransitionContext,
): PartnerStatus | null {
  try {
    assertPartnerTransition(from, to, ctx);
    return to;
  } catch {
    return null;
  }
}

/**
 * Détient-il le titre public + numéro de registre ? Seul `founding_partner`.
 * Un simple inscrit (registered/email_verified/identity_verified/active_contributor)
 * n'est JAMAIS un Partenaire Fondateur public.
 */
export function holdsPublicTitle(status: PartnerStatus): boolean {
  return PUBLIC_TITLE_STATUSES.has(status);
}

/**
 * Peut-il apparaître au registre public ? Détient le titre ET n'est ni suspendu
 * ni retiré. (Un partenaire vérifié puis suspendu disparaît du registre public.)
 */
export function isEligibleForPublicRegistry(status: PartnerStatus): boolean {
  return holdsPublicTitle(status);
}

/**
 * Calcule le statut « naturel » d'un partenaire à partir de ses jalons, sans
 * jamais rétrograder un titre acquis si le partenaire est suspendu/retiré.
 * Utilitaire pour dériver l'état après un événement, en respectant la machine.
 */
export function deriveStatusAfterMilestones(input: {
  current: PartnerStatus;
  emailVerified: boolean;
  identityVerified: boolean;
  hasIntroductions: boolean;
  verifiedContributions: number;
}): PartnerStatus {
  const { current } = input;
  // Les états administratifs ne sont jamais écrasés par une dérivation automatique.
  if (current === "suspended" || current === "withdrawn") return current;

  if (input.verifiedContributions >= 1) return "founding_partner";
  if (input.hasIntroductions && input.identityVerified) return "active_contributor";
  if (input.identityVerified) return "identity_verified";
  if (input.emailVerified) return "email_verified";
  return "registered";
}
