// src/lib/clonechat/actions/types.ts
//
// CloneChat BLOC 8 — CLONEACTIONS. Couche d'EXÉCUTION CONTRÔLÉE au-dessus de
// Brain → CloneContext → Diagnosis → CloneGuide → CloneVoice → CloneCare. CloneChat ne peut réaliser
// QUE des actions simples, réelles, autorisées et explicitement contrôlées : registre canonique,
// validation stricte, permissions & tenant réels, confirmation liée, CloneGuard avant toute
// exécution, idempotence, annulation, échecs honnêtes, CloneTrace sûr. Aucun faux succès, aucune
// exécution inventée par le modèle, aucune mutation métier (Pierre/RH/paiement/signature…). Types
// PURS, versionnés, déterministes (le temps est INJECTÉ, jamais Date.now au niveau module).

export const CLONECHAT_ACTIONS_VERSION = "actions-1" as const;
export const CLONECHAT_TRACE_VERSION = "trace-1" as const;
export const CLONECHAT_CONFIRMATION_VERSION = "confirm-1" as const;
export const CLONECHAT_GUARD_VERSION = "guard-1" as const;

/** Nature de l'action (croissance du risque : read → navigation → prepare → write). */
export type ActionNature = "read" | "navigation" | "prepare" | "write";
export type ActionRisk = "low" | "medium" | "high" | "irreversible";
export type ActionCategory = "navigation" | "support" | "recovery" | "governed_prepare";
/** Niveau d'accès requis (vérifié contre le contexte réel, jamais accordé par le modèle). */
export type ActionPermission = "public" | "authenticated" | "company_member" | "company_owner";

/** États explicites du cycle de vie. */
export type ActionState =
  | "requested"
  | "planned"
  | "blocked"
  | "awaiting_confirmation"
  | "confirmed"
  | "executing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "duplicate";

export interface StructuredActionError {
  readonly code: string;
  readonly message: string;
}

export interface CloneActionRequest {
  /** Identifiant DEMANDÉ (peut être inconnu / inventé par le modèle → sera refusé). */
  readonly actionId: string;
  readonly args: Readonly<Record<string, unknown>>;
}

export type ArgsValidation =
  | { readonly ok: true; readonly args: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** Entrée du registre canonique. Le temps/effets ne vivent pas ici : uniquement la définition. */
export interface ActionDefinition {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly category: ActionCategory;
  readonly risk: ActionRisk;
  readonly nature: ActionNature;
  /** L'action est-elle RÉELLEMENT disponible ? (false = déclarée mais non disponible → refus explicite) */
  readonly available: boolean;
  readonly authRequired: boolean;
  readonly tenantRequired: boolean;
  readonly entitlementRequired: boolean;
  readonly permission: ActionPermission;
  readonly confirmationRequired: boolean;
  readonly cancellable: boolean;
  /** Stratégie d'idempotence : "none" (sans effet) ou "effect" (effet ⇒ clé + claim). */
  readonly idempotency: "none" | "effect";
  readonly adapterId: string;
  readonly successCondition: string; // condition OBSERVABLE de succès
  readonly possibleErrors: readonly string[];
  readonly provenance: string; // preuve que l'action existe réellement
  /** Valide (strictement) les arguments. Déterministe. */
  validate(args: Readonly<Record<string, unknown>>): ArgsValidation;
  /** Route concernée (extraite des args validés) si l'action porte sur une route, sinon null. */
  routeOf(args: Readonly<Record<string, unknown>>): string | null;
}

export type GuardDecision = "allow" | "needs_confirmation" | "block";

export interface GuardCheck {
  readonly id: string;
  readonly ok: boolean;
  readonly detail?: string;
}

export interface GuardResult {
  readonly version: typeof CLONECHAT_GUARD_VERSION;
  readonly decision: GuardDecision;
  readonly reason: string | null;
  /** Code structuré du blocage (null si non bloqué). */
  readonly blockCode: string | null;
  readonly checks: readonly GuardCheck[];
  readonly confirmationRequired: boolean;
}

/** Confirmation LIÉE exactement à l'action, aux arguments, au viewer et au tenant. */
export interface ConfirmationToken {
  readonly version: typeof CLONECHAT_CONFIRMATION_VERSION;
  readonly token: string; // dérivé du planHash — vérifiable, à usage unique
  readonly actionId: string;
  readonly actionVersion: string;
  readonly argsHash: string;
  readonly viewerKey: string;
  readonly tenantKey: string;
  readonly planHash: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
}

export interface ActionAuthorization {
  readonly viewerKey: string; // forme SÛRE (jamais un secret)
  readonly tenantKey: string; // strictement scopé
  readonly authenticated: boolean;
  readonly tenantResolved: boolean;
  readonly tenantSecurityFailure: boolean; // suspension / indisponibilité → tenant invalide
  readonly pierreGranted: boolean;
  readonly role: string | null;
  readonly securityRefusal: boolean; // injection / contournement de gouvernance détecté en amont
}

/** Plan d'action IMMUTABLE (phase 1). N'exécute RIEN. */
export interface CloneActionPlan {
  readonly version: typeof CLONECHAT_ACTIONS_VERSION;
  readonly state: ActionState; // planned | awaiting_confirmation | blocked | cancelled
  readonly request: CloneActionRequest;
  readonly definition: ActionDefinition | null;
  readonly validatedArgs: Readonly<Record<string, unknown>> | null;
  readonly authorization: ActionAuthorization;
  readonly guard: GuardResult;
  readonly confirmationRequired: boolean;
  readonly idempotencyKey: string | null;
  readonly planHash: string;
  readonly route: string | null;
  readonly error: StructuredActionError | null;
}

/** Trace structurée, versionnée, immutable et SÛRE (redigée). */
export interface CloneTrace {
  readonly version: typeof CLONECHAT_TRACE_VERSION;
  readonly traceId: string;
  readonly actionId: string;
  readonly actionVersion: string;
  readonly at: string; // ISO, dérivé d'un temps INJECTÉ
  readonly viewer: string; // clé viewer sûre
  readonly tenant: string; // clé tenant scopée
  readonly guardDecision: GuardDecision;
  readonly confirmationToken: string | null; // id du jeton (hash), jamais un secret
  readonly idempotencyKey: string | null;
  readonly transitions: readonly ActionState[];
  readonly adapterId: string | null;
  readonly observableResult: string | null;
  readonly error: StructuredActionError | null;
  readonly finalStatus: ActionState;
}

/** Résultat d'exécution (phase 2). */
export interface CloneActionResult {
  readonly version: typeof CLONECHAT_ACTIONS_VERSION;
  readonly state: ActionState; // succeeded | failed | duplicate | cancelled | blocked
  readonly observableSuccess: string | null; // condition observable RÉELLEMENT satisfaite
  readonly output: Readonly<Record<string, unknown>> | null;
  readonly error: StructuredActionError | null;
  readonly trace: CloneTrace;
}
