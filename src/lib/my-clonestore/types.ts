// My CloneStore — types du view-model client (P9.2).
//
// Modèle PUR (aucune dépendance serveur/DOM) : décrit l'état de l'espace client
// à partir des données réelles (session, orders/entitlement, onboarding). La
// résolution des données réelles se fait côté serveur/hooks ; ce module ne fait
// que typer et calculer, donc testable dans l'environnement `node` de Vitest.

/**
 * Miroir de `OperationalAccessState` (src/lib/access/operational-access.ts).
 * Redéclaré ici pour garder cette lib pure et sans import serveur ; toute
 * évolution doit rester alignée avec la source d'accès opérationnelle.
 */
export type OperationalState =
  | "anonymous"
  | "authenticated_without_employee"
  | "payment_pending"
  | "activation_pending"
  | "employee_active"
  | "subscription_suspended"
  | "subscription_ended";

/** Décision d'accès au cockpit opérationnel pour le client (Étape 8). */
export type CockpitAccessDecision =
  | "ready"
  | "onboarding_required"
  | "entitlement_pending"
  | "entitlement_inactive"
  | "employee_not_owned"
  | "account_incomplete"
  | "unavailable";

export interface CockpitAccessInput {
  readonly authenticated: boolean;
  readonly operationalState: OperationalState;
  /** L'entreprise possède-t-elle CET employé IA (order active/trialing) ? */
  readonly ownsEmployee: boolean;
  /** Identité entreprise minimale renseignée (Quick Start) ? */
  readonly companyIdentityComplete: boolean;
  /** Onboarding suffisant pour ouvrir le cockpit ? */
  readonly onboardingSufficient: boolean;
  /** La route cockpit existe-t-elle réellement ? */
  readonly routeAvailable: boolean;
}

export interface CockpitCta {
  readonly label: string;
  readonly href: string;
}

export interface CockpitAccessResult {
  readonly decision: CockpitAccessDecision;
  /** Peut ouvrir le cockpit maintenant ? */
  readonly canOpen: boolean;
  readonly title: string;
  readonly message: string;
  readonly cta: CockpitCta;
}

/** Statut de démarrage (bloc « Démarrage » de la home). */
export type StartupStage =
  | "not_started"
  | "quick_start_in_progress"
  | "quick_start_complete"
  | "footprint_in_progress"
  | "footprint_sufficient";

/** Prochaine action recommandée sur la home My CloneStore. */
export interface NextAction {
  readonly stage: StartupStage;
  readonly title: string;
  readonly description: string;
  readonly cta: CockpitCta;
  /** 0..1 — progression globale du démarrage. */
  readonly progress: number;
  /** Estimation lisible du temps restant (ex. « moins de 5 min »). */
  readonly estimatedTime?: string;
}
