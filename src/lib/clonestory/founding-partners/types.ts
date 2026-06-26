// CloneStory — Le Cercle des Partenaires Fondateurs
// types.ts — Contrats et types métier (domaine pur, zéro dépendance React/DB).
//
// Toutes les valeurs numériques (impact direct, impact réseau, contributions
// vérifiées…) sont CALCULÉES à partir d'événements vérifiables. Aucun type ici
// ne permet à un partenaire de saisir ou modifier son nombre de clients.

// ── Statut du partenaire ─────────────────────────────────────────────────────
// Tout le monde peut s'inscrire. Un inscrit n'est PAS automatiquement Partenaire
// Fondateur public : le titre n'est accordé qu'après une contribution réelle et
// vérifiée. Le statut `founding_partner` = éligible au registre public.
export const PARTNER_STATUSES = [
  "registered",         // inscrit, e-mail non vérifié
  "email_verified",     // e-mail confirmé
  "identity_verified",  // identité vérifiée → peut générer lien + code
  "active_contributor", // au moins une introduction en cours / déclarée
  "founding_partner",   // au moins une contribution vérifiée → titre + numéro de registre
  "suspended",          // suspendu (anti-fraude / litige)
  "withdrawn",          // retiré (à la demande / RGPD)
] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

/** Statuts pour lesquels le partenaire détient le titre public et un numéro de registre. */
export const PUBLIC_TITLE_STATUSES: ReadonlySet<PartnerStatus> = new Set<PartnerStatus>([
  "founding_partner",
]);

// ── Méthodes d'attribution ───────────────────────────────────────────────────
export const ATTRIBUTION_METHODS = ["link", "code", "declared"] as const;
export type AttributionMethod = (typeof ATTRIBUTION_METHODS)[number];

// ── Cycle de vie d'une introduction / contribution ───────────────────────────
// declared → prospect_confirmed → prospect_registered → company_created →
// purchase_captured → activation_completed → validation_pending → verified
// Terminaux : canceled (remboursement/annulation), disputed (litige), expired.
export const CONTRIBUTION_STATUSES = [
  "declared",             // introduction déclarée (lien/code/déclaration) AVANT achat
  "prospect_confirmed",   // le prospect a confirmé l'introduction
  "prospect_registered",  // le prospect s'est inscrit (réservation Phase E)
  "company_created",      // compte entreprise créé
  "purchase_captured",    // achat réel encaissé (Stripe)
  "activation_completed", // activation réelle terminée
  "validation_pending",   // délai de validation en cours
  "verified",             // contribution définitivement vérifiée
  "canceled",             // annulée (remboursement / annulation)
  "disputed",             // cas litigieux → validation manuelle
  "expired",              // introduction expirée sans achat
] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

/** Statuts terminaux (aucune transition sortante automatique). */
export const TERMINAL_CONTRIBUTION_STATUSES: ReadonlySet<ContributionStatus> = new Set<ContributionStatus>([
  "verified",
  "canceled",
  "expired",
]);

/** Une contribution n'est comptée comme « vérifiée » que dans cet état exact. */
export const VERIFIED_STATUS: ContributionStatus = "verified";

// ── Modèle de contribution (mesures distinctes, dérivées d'événements) ────────
// On distingue explicitement les jalons demandés par le métier.
export const CONTRIBUTION_EVENT_TYPES = [
  "introduction_declared",
  "introduction_confirmed",
  "prospect_registered",
  "company_created",
  "purchase_captured",
  "activation_completed",
  "contribution_verified",
  "contribution_canceled",
  "contribution_disputed",
  "manual_validation",
] as const;
export type ContributionEventType = (typeof CONTRIBUTION_EVENT_TYPES)[number];

/** Origine vérifiable d'un événement de contribution. */
export const EVIDENCE_SOURCES = ["link", "code", "declared", "stripe", "phase_e", "manual"] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

/**
 * Événement de contribution — APPEND-ONLY. C'est la seule source des chiffres.
 * `evidence_ref` pointe vers une preuve vérifiable (id de réservation Phase E,
 * id d'événement Stripe, id d'audit manuel…). Aucune PII de prospect ici.
 */
export interface ContributionEvent {
  readonly id: string;
  readonly partnerId: string;
  readonly introductionId: string;
  readonly type: ContributionEventType;
  readonly source: EvidenceSource;
  readonly occurredAt: string; // ISO 8601 (horodatage serveur)
  readonly evidenceRef: string | null;
}

/**
 * Introduction : le lien entre un partenaire et un prospect/entreprise.
 * `reservationId` ancre la vérité commerciale sur Phase E (Founder Access).
 * `companyFingerprint` permet la déduplication entreprise sans exposer de PII.
 */
export interface Introduction {
  readonly id: string;
  readonly partnerId: string;
  readonly method: AttributionMethod;
  readonly status: ContributionStatus;
  readonly prospectEmailNormalized: string | null;
  readonly reservationId: string | null;
  readonly companyFingerprint: string | null;
  readonly declaredAt: string; // ISO — horodatage de l'introduction (avant l'achat)
  readonly confirmedAt: string | null;
  readonly purchaseAt: string | null;
  readonly verifiedAt: string | null;
  readonly canceledAt: string | null;
  readonly disputeFlag: boolean;
}

/**
 * Partenaire. `registryNumber` et `publicSlug` ne sont alloués qu'à la première
 * contribution vérifiée (passage à `founding_partner`). `introducedByPartnerId`
 * porte l'origine de branche (qui a amené ce partenaire).
 */
export interface Partner {
  readonly id: string;
  readonly status: PartnerStatus;
  readonly displayName: string;
  readonly emailNormalized: string;
  readonly registryNumber: number | null;
  readonly publicSlug: string | null;
  readonly introducedByPartnerId: string | null;
  readonly emailVerifiedAt: string | null;
  readonly identityVerifiedAt: string | null;
  readonly joinedAt: string; // ISO — date d'inscription
}

// ── Statistiques dérivées (lecture seule) ────────────────────────────────────
// Calculées exclusivement depuis les événements. Jamais persistées comme source
// de vérité, jamais éditables par le partenaire.
export interface PartnerStats {
  /** Introductions déclarées mais pas encore vérifiées. */
  readonly introductionsInProgress: number;
  /** Prospects inscrits attribués au partenaire. */
  readonly prospectsRegistered: number;
  /** Entreprises clientes attribuées (achat encaissé). */
  readonly customersWithPurchase: number;
  /** Contributions définitivement vérifiées — IMPACT DIRECT. */
  readonly verifiedDirect: number;
  /** Impact RÉSEAU : contributions vérifiées de la sous-branche (descendants). */
  readonly verifiedNetwork: number;
  /** Contributions annulées (remboursement / annulation). */
  readonly canceled: number;
}

export const EMPTY_PARTNER_STATS: PartnerStats = {
  introductionsInProgress: 0,
  prospectsRegistered: 0,
  customersWithPurchase: 0,
  verifiedDirect: 0,
  verifiedNetwork: 0,
  canceled: 0,
};
