// src/lib/pierre/v1/ultimate/p16a/types.ts
// P16A — PIERRE ULTIMATE COMPLETION. Types for the Pierre-owned completion layer + the P16C integration
// contract. This layer ORCHESTRATES the already-verified P8.14 cognitive runtime (interpret, capability
// retrieval, clarification, autonomy/guard, continuity). It is NOT a second HR brain, NOT a second
// capability registry, NOT a second planner. Everything here is pure/deterministic, tenant-neutral
// (entities/context are INJECTED by the caller from the real permission-filtered repos), bounded, and
// free of secrets. The final Pierre × T1 × T2 × CloneChat wiring is P16C — this file only DECLARES the
// needs; it never wires an effect.

import type {
  PierreRequestInterpretation, ResolvedReference, ResolvedTemporalReference, PierreNextStep,
} from "../../cognitive-runtime/types";
import type { ClarificationQuestion } from "../../cognitive-runtime/clarification-engine";

// ── Per-request disposition (the honest action ladder — owner §12/§13) ──────────────────────────────
export type P16ADisposition =
  | "read_explain"          // information / analysis only
  | "prepare"               // Pierre prepares a draft/artifact (human sends/decides)
  | "propose"               // governed proposal awaiting confirmation
  | "execute_local"         // executable now under the current autonomy mode (low-risk, no external effect)
  | "provider_blocked"      // a live provider is required and is not available
  | "validation_required"   // needs an explicit human validation before any external effect
  | "human_only"            // a human must make the final decision; Pierre only prepares
  | "refused_unsupported";  // unsupported / impossible request

// ── The final-decision human-only floor (owner §12) ─────────────────────────────────────────────────
export type FinalDecisionCategory =
  | "dismissal" | "sanction" | "salary_change" | "promotion"
  | "legal_conclusion" | "medical_conclusion" | "protected_class_assessment"
  | "irreversible_decision" | "unsupported_country_legal";

export type P16AHumanOnlyDecision = {
  readonly category: FinalDecisionCategory;
  readonly reason: string;
  readonly evidence: string;       // the phrase in the instruction that triggered the floor
  readonly guardLevel: string;     // CloneGuard level (green/orange/red/black)
};

// ── A capability selected for a request, enriched with real canon metadata (owner §6) ───────────────
export type P16ASelectedCapability = {
  readonly id: string;
  readonly domain: string;
  readonly label: string;
  readonly score: number;                 // retrieval relevance score
  readonly autonomy: string;              // HrAutonomyLevel (canon)
  readonly closureStatus: string;         // CLOSED_HR_CAPABILITIES implementation status
  readonly humanOnly: boolean;
  readonly legalDependency: boolean;
  readonly providerDependency: boolean;
  readonly providers: readonly string[];  // integration systems requiring live availability
  readonly countryRuleFamilies: readonly string[];
  readonly requiredInputs: readonly string[];
  readonly expectedArtifacts: readonly string[];
  readonly disposition: P16ADisposition;
};

// ── Mission proposal (governed wrapper — reuses the existing runtime plan / capability outline) ──────
export type P16AMissionTask = {
  readonly key: string;
  readonly label: string;
  readonly dependsOn: readonly string[];
  readonly mode: string;                  // PierreCognitiveMode
  readonly requiresApproval: boolean;
};
export type P16AMissionProposal = {
  readonly objective: string;
  readonly tasks: readonly P16AMissionTask[];
  readonly deliverables: readonly string[];
  readonly completionCriteria: readonly string[];
  readonly executableNow: boolean;
  readonly blockers: readonly string[];
  readonly source: "reused_runtime_plan" | "capability_derived_outline" | "none";
};

// ── Continuity intent (owner §11) — WHICH authoritative mission/artifact a follow-up refers to ───────
export type ContinuityKind = "continue" | "correct" | "use_latest" | "redo_part" | "change_field" | "cancel_last" | "status" | "none";
export type ContinuityTargetKind = "mission" | "artifact" | "none";
export type P16AContinuity = {
  readonly isContinuation: boolean;
  readonly kind: ContinuityKind;
  readonly isCorrection: boolean;         // correction of an existing artifact ≠ a new mission
  readonly targetKind: ContinuityTargetKind;
  readonly targetId: string | null;
  readonly ambiguousCandidates: readonly { id: string; label: string; distinguisher: string }[];
  readonly requiresAuthoritativeRead: boolean; // caller MUST re-read durable state (never trust chat text)
  readonly nextStep: PierreNextStep;
  readonly reason: string;
};

// ── Tech needs declared for P16C (NEVER wired here) ─────────────────────────────────────────────────
export type P16AT1Need = {
  readonly techId: string;                // a real T1 technology id
  readonly reason: string;
  readonly liveBlocked: boolean;          // requires a live provider that is not available
  readonly blockedReason: string | null;
};
export type P16AT2Need = {
  readonly techId: string;                // a real T2 product-technology id
  readonly reason: string;
};

export type P16ABlockedReason = { readonly code: string; readonly detail: string };

// ── THE P16C INTEGRATION CONTRACT (owner §14) ───────────────────────────────────────────────────────
export type PierreUltimateIntegrationContract = {
  readonly version: 1;
  readonly requestId: string;
  readonly companyId: string;
  readonly actorId: string;
  readonly instruction: string;
  readonly nowIso: string;

  readonly understanding: {
    readonly normalizedObjective: string;
    readonly requestKind: string;
    readonly desiredOutcomes: readonly string[];
    readonly relevantDomains: readonly string[];
    readonly confidence: number;
    readonly resolvedDates: readonly ResolvedTemporalReference[];
    readonly resolvedEntities: readonly ResolvedReference[];
    readonly multiIntent: boolean;
  };

  readonly clarification: {
    readonly questions: readonly ClarificationQuestion[];
    readonly blocksExecution: boolean;
  };

  readonly selectedCapabilityIds: readonly string[];
  readonly selectedCapabilities: readonly P16ASelectedCapability[];
  readonly capabilityCount: number;                 // derived from the real registry length
  readonly capabilityCountDerivedFromRegistry: true;

  readonly missionProposal: P16AMissionProposal;

  readonly autonomy: {
    readonly overallDisposition: P16ADisposition;
    readonly requiredValidations: readonly string[];
    readonly humanOnlyDecisions: readonly P16AHumanOnlyDecision[];
    readonly guardLevel: string;
  };

  readonly continuity: P16AContinuity;

  readonly contextRequirements: readonly string[];
  readonly documentEvidenceRequirements: readonly string[];

  readonly providerDependencies: readonly string[];
  readonly legalDependencies: readonly string[];
  readonly blockedReasons: readonly P16ABlockedReason[];

  readonly t1Needs: readonly P16AT1Need[];
  readonly t2Needs: readonly P16AT2Need[];

  readonly cloneChatExplanation: {
    readonly summary: string;
    readonly disclosure: string;
    readonly safeToShowUser: true;
  };

  readonly authoritativeReferences: readonly string[];
  readonly canonicalItemsInvolved: readonly string[]; // which of the 12 Ultimate items this request exercises
  readonly statusExplanation: string;
  readonly nextSafeStep: string;
};
