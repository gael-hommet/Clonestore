// src/lib/clonechat/diagnosis/types.ts
//
// CloneChat BLOC 4 — DIAGNOSIS. Pour toute situation de blocage, un diagnostic STRUCTURÉ, typé et
// versionné, fondé UNIQUEMENT sur des sources réelles (CloneContext du BLOC 3, Product Truth Engine,
// registre des routes, viewer/tenant/entitlement réels, surfacedErrors réellement fournis, prérequis
// et blockers réels, indisponibilité provider réellement observée). JAMAIS deviné : ni état compte
// absent, ni erreur non observée, ni permission, ni tenant, ni droit Pierre, ni cause certaine quand
// elle n'est que probable, ni résolution réussie, ni route/action inexistante. Module PUR (aucun I/O,
// aucun Date.now au niveau module) → déterministe et testable.

import type { CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";

export const CLONECHAT_DIAGNOSIS_VERSION = "diagnosis-1" as const;

/**
 * Classification PRIMAIRE du diagnostic. `no_blocker` = aucun blocage observé ; les neuf autres
 * distinguent CLAIREMENT chaque nature de blocage exigée par le BLOC 4.
 */
export type DiagnosisKind =
  | "no_blocker" // aucun blocage observé (demande satisfaisable / conversationnelle)
  | "confirmed_cause" // cause racine CERTAINE (preuve dure observée)
  | "probable_cause" // cause PROBABLE (indices réels, pas de preuve dure) — jamais présentée comme certaine
  | "insufficient_context" // pas assez d'informations réelles pour conclure
  | "provider_failure" // panne d'infrastructure observée (modèle OU lecture d'entitlement)
  | "tenant_security_failure" // suspension / indisponibilité d'entreprise (fail-closed)
  | "missing_prerequisite" // prérequis réel manquant (authentification / entreprise / Pierre)
  | "permission_denied" // demande refusée par la gouvernance (contournement / injection)
  | "route_or_navigation_issue" // route inconnue du registre / navigation impossible
  | "unknown_requires_escalation"; // rien de sûr → escalade humaine

/** Certitude de la cause : distinction DURE certaine vs probable vs indéterminée. */
export type CauseCertainty = "confirmed" | "probable" | "none";

export type DiagnosisConfidence = "high" | "medium" | "low";

/** Domaine du blocage (permission, tenant, entitlement, route, environnement, provider). */
export type BlockerCategory =
  | "permission"
  | "tenant"
  | "entitlement"
  | "route"
  | "environment"
  | "provider"
  | "none";

/** Action de déblocage RÉELLEMENT disponible. `route` est toujours une route du registre, ou null. */
export interface DiagnosisUnblockAction {
  readonly id: string; // ex. "authenticate", "select_company", "activate_pierre", "retry", "contact_support", "provide_error"
  readonly label: string;
  readonly route: string | null; // route RÉELLE (registre) ou null — jamais inventée
}

/** Diagnostic structuré complet produit pour une situation. */
export interface CloneChatDiagnosis {
  readonly version: typeof CLONECHAT_DIAGNOSIS_VERSION;
  readonly kind: DiagnosisKind;
  /** Y a-t-il un blocage réel ? (false ⇔ kind === "no_blocker") */
  readonly blocked: boolean;
  /** Le problème OBSERVÉ (jamais inventé ; null si aucun blocage). */
  readonly observedProblem: string | null;
  /** La cause racine (certaine ou probable) ; null si indéterminable. */
  readonly rootCause: string | null;
  readonly causeCertainty: CauseCertainty;
  readonly confidence: DiagnosisConfidence;
  /** Preuves RÉELLES utilisées (flags de contexte, ids d'erreur, notes de route, ids de vérité…). */
  readonly evidence: readonly string[];
  /** Informations manquantes pour conclure (jamais devinées). */
  readonly missingInformation: readonly string[];
  /** L'étape EXACTE où l'utilisateur est bloqué ; null si non bloqué. */
  readonly blockedStep: string | null;
  /** Prérequis réels manquants pour satisfaire la demande. */
  readonly missingPrerequisites: readonly CloneChatPrerequisite[];
  /** Catégorie du blocage (permission / tenant / entitlement / route / environnement / provider). */
  readonly blockerCategory: BlockerCategory;
  /** Actions de déblocage RÉELLEMENT disponibles (routes réelles ou null). */
  readonly unblockActions: readonly DiagnosisUnblockAction[];
  /** Route RÉELLE recommandée (registre) ou null — jamais inventée. */
  readonly recommendedRoute: string | null;
  readonly requiresClarification: boolean;
  readonly clarificationQuestion: string | null;
  /** Une escalade humaine est-elle nécessaire ? (aucune résolution sûre disponible) */
  readonly requiresEscalation: boolean;
}
