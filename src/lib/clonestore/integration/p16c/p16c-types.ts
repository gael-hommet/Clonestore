// src/lib/clonestore/integration/p16c/p16c-types.ts
// P16C — PIERRE × CLONESTORE TECHNOLOGIES × CLONECHAT INTEGRATION GATE : types de base.
// DOCTRINE (immuable) : Pierre est le cerveau RH (P16A) ; T1 = capacités bas-niveau ; T2 = systèmes
// produit ; CloneOS = orchestration générique ; CloneChat = conversation/délégation. P16C INTÈGRE les
// couches déjà vérifiées — il NE reconstruit rien, NE crée AUCUN 2e cerveau RH, N'active AUCUN provider
// live, N'autorise NI production NI paiement. Chaque état effectif est le PLUS STRICT de tous les gates
// (fail-closed). `externallyExecutable` reste false pendant tout P16C. Module PUR : aucune I/O.

import type {
  PierreUltimateIntegrationContract, P16ADisposition, P16AT1Need, P16AT2Need,
} from "@/lib/pierre/v1/ultimate/p16a";
import type { TechnologyId, TechnologyMode, TechnologyStatus } from "@/lib/clonestore/technologies/t1";
import type {
  ProductTechnologyId, ProductTechnologyMode, CloneOSRunResult,
} from "@/lib/clonestore/product-technologies/t2";

// ── Les 10 items d'intégration canoniques (adaptateurs Pierre→Techno, catégorie C du master split P16.0) ──
export type P16CCanonicalIntegrationId =
  | "int.document_adapter"
  | "int.mail_adapter"
  | "int.calendar_adapter"
  | "int.signature_adapter"
  | "int.voice_adapter"
  | "int.notification_adapter"
  | "int.analytics_adapter"
  | "int.evidence_adapter"
  | "int.workflow_adapter"
  | "int.permission_adapter";

/** Niveau de complétude honnête d'un item d'intégration. */
export type P16CIntegrationStatus =
  | "integrated_local_safe"   // chemin runtime réel + preuves de test, local-safe
  | "architecture_ready"      // câblé mais non-live par conception (voix)
  | "blocked";                // dépendance externe/live bloque toute complétion

// ── L'état de gouvernance effectif (le PLUS STRICT gagne — précédence §8) ──────────────────────────
export type P16CGovernanceState =
  | "PERMISSION_BLOCKED"
  | "HUMAN_ONLY"
  | "UNSUPPORTED"
  | "LEGAL_BLOCKED"
  | "PROVIDER_BLOCKED"
  | "VALIDATION_REQUIRED"
  | "PREPARE_LOCAL"
  | "PROPOSE"
  | "LOCAL_EXECUTION_ALLOWED"
  | "READ_ONLY";

export const ALL_P16C_GOVERNANCE_STATES: readonly P16CGovernanceState[] = [
  "PERMISSION_BLOCKED", "HUMAN_ONLY", "UNSUPPORTED", "LEGAL_BLOCKED", "PROVIDER_BLOCKED",
  "VALIDATION_REQUIRED", "PREPARE_LOCAL", "PROPOSE", "LOCAL_EXECUTION_ALLOWED", "READ_ONLY",
];

/** Contribution d'un gate au calcul de l'état effectif (traçable — chaque gate dit ce qu'il impose). */
export interface P16CGovernanceContribution {
  readonly gate:
    | "pierre_disposition" | "permission" | "pierre_human_only" | "legal" | "provider"
    | "cloneguard" | "clonepolicy" | "clonetrust" | "cloneos" | "clarification" | "must_not_claim_payroll"
    | "t1_status" | "t2_status" | "production";
  readonly state: P16CGovernanceState;
  readonly reason: string;
}

export interface P16CGovernanceDecision {
  readonly effectiveState: P16CGovernanceState;
  readonly decidedBy: P16CGovernanceContribution["gate"];
  readonly contributions: readonly P16CGovernanceContribution[];
  /** Exécution LOCALE sûre permise (aucun effet externe) — seulement si TOUS les gates l'autorisent. */
  readonly executableLocally: boolean;
  /** INVARIANT P16C : jamais true (aucun effet externe/live n'est autorisé par P16C). */
  readonly externallyExecutable: false;
  readonly exactBlockers: readonly string[];
}

// ── Étape technologique T1 résolue (contrat réel, permission, mode, fallback, blocage live) ────────
export interface P16CT1Step {
  readonly techId: TechnologyId;
  readonly known: boolean;                 // techno présente dans le VRAI registre T1
  readonly reason: string;                 // pourquoi Pierre l'a déclarée
  readonly status: TechnologyStatus;
  readonly mode: TechnologyMode;
  readonly permissionAllowed: boolean;     // checkTechnologyPermission (fail-closed)
  readonly permissionReason: string;
  readonly liveBlocked: boolean;           // dépend d'un provider live indisponible
  readonly liveBlockedReason: string | null;
  readonly supportsLocalExecution: boolean; // mode local_safe → préparation locale possible
  readonly safeFallback: string;
  readonly resultKind: string;             // kind du TechnologyResult réel de prepare()
  readonly requiresHumanValidation: boolean;
  readonly artifactPrepared: boolean;
}

// ── Étape technologique T2 résolue (contrat produit réel) ──────────────────────────────────────────
export interface P16CT2Step {
  readonly techId: ProductTechnologyId;
  readonly known: boolean;                 // techno présente dans le VRAI registre T2
  readonly reason: string;
  readonly status: string;
  readonly mode: ProductTechnologyMode;
  readonly liveBlockedReason: string | null;
  readonly resultKind: string;
  readonly requiresHumanValidation: boolean;
  readonly artifactPrepared: boolean;
  readonly artifactKind: string | null;
}

// ── Statut autoritaire d'une opération/mission (result merger — §11) ───────────────────────────────
export type P16COperationStatus =
  | "prepared_artifact"
  | "generated_draft"
  | "proposed_action"
  | "validated_action"
  | "locally_executed_operation"
  | "provider_blocked_operation"
  | "human_only_decision"
  | "failed_operation";

export type P16CMissionStatus =
  | "prepared"
  | "partial"
  | "proposed"
  | "provider_blocked"
  | "human_only"
  | "unsupported"
  | "conflict_failed";
  // NOTE : « completed_mission_with_evidence » N'EST JAMAIS produit par P16C —
  // l'exécution autoritaire reste derrière la route de confirmation + le contrat V1.

export interface P16COperationResult {
  readonly ref: string;
  readonly layer: "t1" | "t2" | "cloneos";
  readonly status: P16COperationStatus;
  readonly detail: string;
  readonly hasAuthoritativeCompletionEvidence: false; // P16C ne fabrique jamais de complétion
}

export interface P16CMergedResult {
  readonly missionStatus: P16CMissionStatus;
  readonly operations: readonly P16COperationResult[];
  /** RÈGLE DURE : jamais true en P16C (aucune tâche n'a de preuve de complétion autoritaire ici). */
  readonly authoritativeCompletion: false;
  readonly conflicts: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly summary: string;
}

// ── Le plan d'exécution technologique typé (§10) ───────────────────────────────────────────────────
export interface P16CTechnologyExecutionPlan {
  readonly version: 1;
  readonly integrationRequestId: string;
  readonly companyId: string;
  readonly actorId: string;
  readonly pierreRequestId: string;
  readonly sourceContractVersion: number;
  readonly missionObjective: string;
  readonly capabilityIds: readonly string[];
  readonly effectiveGovernanceState: P16CGovernanceState;
  readonly cloneAdnContextRefs: readonly string[];
  readonly guardDecision: string | null;
  readonly policyDecision: string | null;
  readonly trustDecision: string | null;
  readonly cloneOsMissionPlan: {
    readonly title: string;
    readonly objective: string;
    readonly taskIds: readonly string[];
    readonly decidesHrOutcomes: false;
    readonly executed: false;
  } | null;
  readonly t1Steps: readonly P16CT1Step[];
  readonly t2Steps: readonly P16CT2Step[];
  readonly validations: readonly string[];
  readonly humanOnlyDecisions: readonly string[];
  readonly providerBlockers: readonly string[];
  readonly legalBlockers: readonly string[];
  readonly permissionBlockers: readonly string[];
  readonly traceRequirements: readonly string[];
  readonly reviewRequirements: readonly string[];
  readonly briefRequirements: readonly string[];
  readonly continuityRequirements: readonly string[];
  readonly signalsRequirements: readonly string[];
  readonly learningCandidatesAllowed: boolean;
  readonly cloneChatExplanation: string;
  readonly executableLocally: boolean;
  /** INVARIANT P16C : toujours false. */
  readonly externallyExecutable: false;
  readonly exactBlockers: readonly string[];
  readonly nextSafeStep: string;
  readonly authoritativeReferences: readonly string[];
}

// ── Sortie complète du runtime d'intégration (interne — jamais renvoyée telle quelle au client) ─────
export interface P16CIntegrationResult {
  readonly ok: boolean;
  readonly rejectedReason: string | null;         // contrat rejeté (version/capacité/tenant/forge)
  readonly contractConsumed: boolean;
  readonly plan: P16CTechnologyExecutionPlan | null;
  readonly governance: P16CGovernanceDecision | null;
  readonly merged: P16CMergedResult | null;
  readonly cloneOsRun: CloneOSRunResult | null;    // le run T2 réel (audit inclus)
  readonly canonicalItemsResolved: readonly P16CCanonicalIntegrationId[];
}

// Réexports pratiques (les consommateurs P16C n'importent qu'un module).
export type { PierreUltimateIntegrationContract, P16ADisposition, P16AT1Need, P16AT2Need };
