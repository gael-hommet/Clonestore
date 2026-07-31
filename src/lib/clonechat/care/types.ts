// src/lib/clonechat/care/types.ts
//
// CloneChat BLOC 7 — CLONECARE. Couche de support & résolution au-dessus de
// Brain → CloneContext → Diagnosis → CloneGuide → CloneVoice. CloneCare détermine HONNÊTEMENT si une
// situation correspond à un problème connu, possède une résolution certaine, un simple contournement,
// nécessite des informations, est une panne provider, une limitation produit réelle, un refus de
// sécurité, ou une escalade humaine — et prépare un brouillon de ticket SÛR (jamais envoyé
// automatiquement). Il ne devine JAMAIS un bug, une résolution, un délai, un statut, une équipe ni
// une réussite. Types PURS, versionnés, déterministes.

export const CLONECHAT_CARE_VERSION = "care-1" as const;
export const CLONECHAT_TICKET_VERSION = "ticket-1" as const;

/** Statut de support explicite. */
export type CareStatus =
  | "no_support_needed"
  | "known_issue"
  | "resolution_available"
  | "workaround_available"
  | "needs_information"
  | "provider_outage"
  | "product_limitation"
  | "security_refusal"
  | "human_escalation";

export type CareConfidence = "high" | "medium" | "low";
export type CarePriority = "low" | "normal" | "high" | "urgent";

export type TicketCategory =
  | "payment" | "access" | "entitlement" | "navigation" | "voice" | "provider" | "product" | "security" | "other";

/** Brouillon de ticket support — SÛR par construction (redaction déterministe, jamais de secret). */
export interface SupportTicketDraft {
  readonly version: typeof CLONECHAT_TICKET_VERSION;
  /** Clé déterministe : deux situations identiques → même clé (déduplication / idempotence). */
  readonly idempotencyKey: string;
  readonly summary: string;
  readonly category: TicketCategory;
  readonly priority: CarePriority;
  readonly affectedRoute: string | null; // route RÉELLE (registre) ou null
  readonly errorCodes: readonly string[]; // codes SÛRS uniquement (redigés)
  readonly attemptedSteps: readonly string[]; // jamais inventé
  readonly expectedResult: string;
  readonly observedResult: string;
  readonly evidence: readonly string[]; // preuves NON sensibles, redigées
  /** Identifiant tenant AUTORISÉ et strictement scopé, uniquement si réellement nécessaire ; sinon null. */
  readonly tenantRef: string | null;
}

/** Résultat CloneCare structuré, versionné et ADDITIF. */
export interface CloneCareResult {
  readonly version: typeof CLONECHAT_CARE_VERSION;
  readonly status: CareStatus;
  readonly observedProblem: string | null;
  /** Correspondance éventuelle avec un problème connu (registre). */
  readonly knownIssueId: string | null;
  readonly knownIssueTitle: string | null;
  readonly confidence: CareConfidence;
  readonly evidence: readonly string[];
  /** Résolution officielle proposée quand elle existe (jamais inventée). */
  readonly proposedResolution: string | null;
  /** Contournement temporaire quand il existe. */
  readonly workaround: string | null;
  /** Étapes sûres (issues de CloneGuide — routes réelles). */
  readonly safeSteps: readonly string[];
  /** Condition OBSERVABLE prouvant la résolution (jamais « résolu » sur une réponse générée). */
  readonly resolutionCondition: string | null;
  readonly missingInformation: readonly string[];
  readonly priority: CarePriority;
  readonly escalationRequired: boolean;
  readonly escalationReason: string | null;
  readonly supportRoute: string | null; // route support RÉELLE
  readonly ticketNeeded: boolean;
  readonly ticketDraft: SupportTicketDraft | null;
}

export interface CareInput {
  readonly attemptedSteps?: readonly string[];
  /** Le caller autorise-t-il l'inclusion d'un identifiant tenant scopé dans le ticket ? */
  readonly includeTenantRef?: boolean;
}
