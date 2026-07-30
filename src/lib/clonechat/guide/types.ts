// src/lib/clonechat/guide/types.ts
//
// CloneChat BLOC 5 — CLONEGUIDE V1. Transforme une intention ou un diagnostic en accompagnement
// concret, sûr et progressif vers un résultat RÉEL — SANS exécuter d'action et SANS inventer
// l'interface. Toute autorité (routes, pages, audiences, statuts, prérequis, permissions,
// disponibilités, actions) provient UNIQUEMENT des sources réelles : registre des routes,
// CloneContext (BLOC 3), CloneChat Diagnosis (BLOC 4), Product Truth Engine (BLOC 1) et prérequis/
// CTA réels. Le modèle n'invente jamais une route, un bouton, un champ UI, une étape inexistante,
// une permission, une réussite, un état de compte ni une action déjà exécutée. Tant que les cibles
// UI visuelles réelles n'existent pas (BLOC 9), on reste au niveau ROUTE + INSTRUCTION TEXTUELLE
// vérifiable. Module PUR (aucun I/O, aucun Date.now au niveau module) → déterministe et testable.

import type { CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";

export const CLONECHAT_GUIDE_VERSION = "guide-1" as const;

/** État global du guide. */
export type GuideState = "ready" | "blocked" | "needs_clarification" | "completed" | "escalate";

/** Identifiant stable du guide (couvre au minimum les 13 parcours requis + clarification). */
export type GuideId =
  | "reserve_pierre"
  | "view_demo"
  | "checkout"
  | "login"
  | "signup"
  | "resolve_no_company"
  | "select_company"
  | "resolve_no_pierre"
  | "recover_entitlement_lookup"
  | "contact_support"
  | "unknown_route"
  | "after_payment_diagnosis"
  | "resolve_tenant_or_permission"
  | "clarify_request";

/** Une étape ordonnée : texte précis, route RÉELLE (ou null), conditions observables. Jamais vide. */
export interface CloneGuideStep {
  readonly index: number; // 1-based, ordre stable
  readonly id: string;
  readonly text: string; // instruction textuelle précise (jamais vide, jamais un champ UI inventé)
  readonly route: string | null; // route RÉELLE (registre) ou null — jamais inventée
  readonly prerequisites: readonly CloneChatPrerequisite[];
  readonly successCondition: string; // condition de réussite OBSERVABLE (jamais vide)
  readonly blockedCondition: string; // condition de blocage (jamais vide)
  readonly recovery: string; // action de récupération (jamais vide)
}

/** Guide structuré complet. */
export interface CloneGuide {
  readonly version: typeof CLONECHAT_GUIDE_VERSION;
  readonly id: GuideId;
  readonly goal: string; // objectif utilisateur
  readonly initialState: string; // état initial RÉELLEMENT connu (jamais un état de compte deviné, jamais de companyId)
  readonly startRoute: string | null; // route réelle de départ (ou null)
  readonly steps: readonly CloneGuideStep[];
  readonly totalSteps: number;
  /** Étape actuelle (1-based). 0 si aucune étape actionnable ; totalSteps si le but est déjà atteint. */
  readonly currentStep: number;
  readonly state: GuideState;
  readonly clarificationQuestion: string | null;
  readonly requiresConfirmation: boolean;
  readonly requiresEscalation: boolean;
  readonly missingPrerequisites: readonly CloneChatPrerequisite[];
  readonly recommendedRoute: string | null; // route réelle recommandée (ou null)
  readonly evidence: readonly string[];
}
