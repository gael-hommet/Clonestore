// src/lib/pierre/v1/cognitive-runtime/types.ts
// PHASE 8.14 — authoritative contracts for the ONE Pierre cognitive runtime. This module ORCHESTRATES
// the already-verified P8 substrate (runCloneAIContract, compileMissionPlan, runPierreRuntimeJobs,
// autonomy, guard, Employee360, providers, communications). It is NOT a second mission/task/validation
// runtime. The model PROPOSES; the deterministic runtime VALIDATES and ACTS. Nothing here executes an
// effect directly — execution goes through the compiled plan + the real run engine.

// ── Resolution outcomes ────────────────────────────────────────────────────
// Every entity/temporal/amount resolution returns one of these, so ambiguity NEVER silently becomes an
// executed guess (owner §7: "Never guess when ambiguity affects execution").
export type ResolutionStatus = "resolved" | "ambiguous" | "forbidden" | "not_found" | "unresolved";

export type ResolvedReference = {
  readonly kind: "employee" | "candidate" | "manager" | "team" | "site" | "contract" | "document" | "mission" | "case";
  readonly status: ResolutionStatus;
  readonly id: string | null;                 // resolved id (null unless status==="resolved")
  readonly label: string;                     // human label used in the request
  readonly candidates: ReadonlyArray<{ id: string; label: string; distinguisher: string }>; // for ambiguous
  readonly reason: string;
};

export type ResolvedTemporalReference = {
  readonly status: ResolutionStatus;
  readonly original: string;
  readonly iso: string | null;                // resolved ISO date (yyyy-mm-dd), null unless resolved
  readonly kind: "absolute" | "relative_day" | "relative_period" | "weekday" | "none";
  readonly reason: string;
};

export type ResolvedAmountReference = {
  readonly status: ResolutionStatus;
  readonly original: string;
  readonly amountCents: number | null;        // integer cents, null unless resolved
  readonly currency: "EUR" | "CHF" | null;
  readonly reason: string;
};

// ── Request interpretation (owner §6) ──────────────────────────────────────
export type PierreRequestKind = "INFORMATION" | "ANALYSIS" | "OPERATION" | "MONITORING" | "OPTIMIZATION" | "MULTI_OBJECTIVE";
export type PierreNextStep = "ANSWER" | "ASK_CLARIFICATION" | "PREPARE_PLAN" | "RESUME_EXISTING_WORK" | "DECLINE_UNSUPPORTED";

export type PierreAmbiguity = { readonly field: string; readonly question: string; readonly options: readonly string[] };
export type PierreMissingInformation = { readonly field: string; readonly question: string; readonly blocksExecution: boolean };
export type ExplicitAssumption = { readonly field: string; readonly value: string; readonly confidence: number };

export type PierreRequestInterpretation = {
  readonly requestId: string;
  readonly companyId: string;
  readonly actorId: string;
  readonly originalRequest: string;
  readonly normalizedObjective: string;
  readonly desiredOutcomes: readonly string[];
  readonly subjects: {
    readonly employees: readonly ResolvedReference[];
    readonly managers: readonly ResolvedReference[];
    readonly teams: readonly ResolvedReference[];
    readonly sites: readonly ResolvedReference[];
    readonly contracts: readonly ResolvedReference[];
    readonly documents: readonly ResolvedReference[];
    readonly missions: readonly ResolvedReference[];
    readonly cases: readonly ResolvedReference[];
  };
  readonly dates: readonly ResolvedTemporalReference[];
  readonly amounts: readonly ResolvedAmountReference[];
  readonly constraints: readonly string[];
  readonly assumptions: readonly ExplicitAssumption[];
  readonly relevantDomains: readonly string[];
  readonly candidateCapabilityIds: readonly string[];
  readonly ambiguities: readonly PierreAmbiguity[];
  readonly missingInformation: readonly PierreMissingInformation[];
  readonly requestKind: PierreRequestKind;
  readonly confidence: number;
  readonly nextStep: PierreNextStep;
};

// ── Cognitive plan (owner §9) — a governed wrapper over a compiled RuntimePlanInput ────────────────
export type PierreCognitiveMode = "AUTONOMOUS" | "CONFIRMATION_REQUIRED" | "HUMAN_DECISION_REQUIRED";

export type PierrePlannedStep = {
  readonly stepKey: string;
  readonly actionKey: string;                 // MUST be a registered RUNTIME_ACTION_REGISTRY key
  readonly input: Record<string, unknown>;
  readonly dependsOn: readonly string[];
  readonly mode: PierreCognitiveMode;
  readonly rationale: string;
};

export type PierrePlanBlocker = { readonly code: string; readonly detail: string };

export type PierreCognitivePlan = {
  readonly planId: string;
  readonly version: number;
  readonly requestId: string;
  readonly objective: string;
  readonly steps: readonly PierrePlannedStep[];
  readonly capabilityIds: readonly string[];
  readonly missionPackIds: readonly string[];
  readonly runtimeActionIds: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly requiredHumanDecisions: readonly string[];
  readonly legalDependencies: readonly string[];
  readonly providerDependencies: readonly string[];
  readonly risks: readonly string[];
  readonly executableNow: boolean;
  readonly blockers: readonly PierrePlanBlocker[];
  readonly planFingerprint: string | null;    // set once compiled by compileMissionPlan
  readonly estimatedToolRounds: number;
  readonly estimatedExternalEffects: number;
};

// ── Long-running cognitive operation state (owner §14) ──────────────────────
export type PierreCognitiveTerminalState =
  | "COMPLETED"
  | "AWAITING_INFORMATION"
  | "AWAITING_CONFIRMATION"
  | "AWAITING_APPROVAL"
  | "AWAITING_HUMAN_DECISION"
  | "AWAITING_PROVIDER"
  | "AWAITING_DATE"
  | "BLOCKED_LEGAL"
  | "BLOCKED_PERMISSION"
  | "FAILED_RECOVERABLE"
  | "FAILED_TERMINAL"
  | "CANCELLED";

// ── Plan proposer (dependency injection) ───────────────────────────────────
// The REAL proposer wraps runCloneAIContract (LLM). Tests inject a deterministic proposer. This keeps
// the whole cognitive runtime unit-testable WITHOUT burning OpenAI (owner §29: no normal test hits OpenAI).
export type ProposedPlanStep = {
  readonly step_key: string;
  readonly action_key: string;
  readonly input?: Record<string, unknown>;
  readonly depends_on?: readonly string[];
};
export type ProposedPlan = {
  readonly objective: string;
  readonly steps: readonly ProposedPlanStep[];
  readonly source: "llm" | "deterministic_fallback";
};
export type PlanProposerInput = {
  readonly instruction: string;
  readonly companyId: string;
  readonly actorId: string;
  readonly allowedActionKeys: readonly string[];
  readonly nowIso: string;
};
export type PlanProposer = (input: PlanProposerInput) => Promise<ProposedPlan | null>;
