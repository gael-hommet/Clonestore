// src/lib/clonechat/onboarding/types.ts
//
// CloneChat BLOC 11 (Partie A) — ONBOARDING contextuel. Accueille et oriente un utilisateur selon
// son état RÉEL dans CloneStore (depuis CloneContext), ne présente que des capacités réellement
// disponibles, et l'accompagne jusqu'à un état « prêt ». Ne suppose JAMAIS authentification /
// entreprise / tenant / droit Pierre / permission / étape déjà réalisée / mission / action réussie.
// Types PURS, versionnés, déterministes (temps INJECTÉ). Réutilise Guided Tour + Visual Guidance +
// CloneContext (isolation) + CloneCare (redaction). N'est PAS un second système d'onboarding produit :
// c'est la couche conversationnelle CloneChat, distincte de clonestore/onboarding.

import type { CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";

export const CLONECHAT_ONBOARDING_VERSION = "onboarding-1" as const;

/** État global de l'onboarding. */
export type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_input"
  | "blocked"
  | "ready"
  | "completed"
  | "skipped"
  | "expired"
  | "escalate";

/** Parcours d'onboarding (adaptés à l'état réel). */
export type OnboardingJourneyId =
  | "public_discovery"
  | "discover_pierre"
  | "view_demo"
  | "signup"
  | "login"
  | "resolve_company"
  | "select_company"
  | "understand_pierre_access"
  | "reserve_pierre"
  | "recover_entitlement"
  | "enter_pierre_space"
  | "discover_clonechat"
  | "clonechat_limits"
  | "start_mission_prep"
  | "contact_support";

export type OnboardingStepState = "pending" | "current" | "done" | "blocked";

export interface OnboardingStep {
  readonly id: string;
  readonly text: string; // instruction accessible (jamais vide)
  readonly route: string | null; // route RÉELLE ou null
  readonly visualTargetId: string | null; // cible Visual Guidance vérifiée, si elle existe
  readonly prerequisites: readonly CloneChatPrerequisite[];
  /** Étape « porte » : satisfaite dès que ses prérequis sont vérifiés dans le contexte. */
  readonly gate: boolean;
  readonly state: OnboardingStepState;
}

export type ResumeState = "fresh" | "resumed";

/** État d'onboarding versionné, persistable, tenant-scopé, sans donnée sensible. */
export interface OnboardingState {
  readonly version: typeof CLONECHAT_ONBOARDING_VERSION;
  readonly id: string; // identifiant LOCAL
  readonly viewerKey: string; // clé viewer SÛRE (jamais un secret)
  readonly tenantKey: string; // strictement scopé
  readonly goal: string; // objectif utilisateur
  readonly journeyId: OnboardingJourneyId;
  readonly currentStep: number; // 1-based ; 0 si aucune ; totalSteps si terminé
  readonly totalSteps: number;
  readonly completedStepIds: readonly string[];
  readonly blockedStepIds: readonly string[];
  readonly missingPrerequisites: readonly CloneChatPrerequisite[];
  readonly currentRoute: string | null;
  readonly recommendedRoute: string | null;
  readonly visualTargetId: string | null;
  readonly requestedInfo: readonly string[]; // infos réellement manquantes demandées
  readonly providedInfo: Readonly<Record<string, string>>; // infos fournies (redigées, jamais un secret)
  readonly createdAtMs: number; // injecté
  readonly updatedAtMs: number; // injecté
  readonly expiresAtMs: number | null;
  readonly resumeState: ResumeState;
  readonly interruptionReason: string | null;
  readonly status: OnboardingStatus;
  readonly steps: readonly OnboardingStep[];
}

/** Snapshot persistable minimal (ce qui est réellement stocké — jamais de contenu sensible). */
export interface OnboardingPersisted {
  readonly version: typeof CLONECHAT_ONBOARDING_VERSION;
  readonly id: string;
  readonly viewerKey: string;
  readonly tenantKey: string;
  readonly journeyId: OnboardingJourneyId;
  readonly completedStepIds: readonly string[];
  readonly providedInfo: Readonly<Record<string, string>>;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly expiresAtMs: number | null;
  readonly status: OnboardingStatus;
  readonly interruptionReason: string | null;
}
