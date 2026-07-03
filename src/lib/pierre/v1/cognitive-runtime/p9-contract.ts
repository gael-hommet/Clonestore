// src/lib/pierre/v1/cognitive-runtime/p9-contract.ts
// PHASE 8.14 — the STABLE contract P9 (CloneChat + cockpit) consumes. P9 stays a separate lane: it only
// renders what this contract returns and deep-links to real missions/employees/validations/documents. P9
// must NOT plan HR itself — for any HR request it calls Pierre's intelligence API, which returns this.
// Everything here is client-safe: no raw prompts, no chain-of-thought, no secrets, no cross-tenant data.

import type { PierreRequestInterpretation, PierreNextStep } from "./types";
import type { GeneratedPlan } from "./plan-generator";
import type { ClarificationQuestion } from "./clarification-engine";
import type { Finding } from "./analytics-engine";

export type IntelligencePhase = "interpreted" | "needs_clarification" | "plan_ready" | "executing" | "blocked" | "completed" | "declined" | "analysis";

export type IntelligenceAnalysis = { kind: "optimization" | "monitoring"; findings: readonly Finding[]; watch: readonly string[] };

export type PlanStepPreview = {
  readonly stepKey: string;
  readonly actionKey: string;
  readonly summary: string;
  readonly requiresApproval: boolean;
};

export type IntelligenceResponse = {
  readonly requestId: string;
  readonly phase: IntelligencePhase;
  readonly objective: string;
  readonly requestKind: string;
  readonly confidence: number;
  readonly clarifications: readonly ClarificationQuestion[];
  readonly planSteps: readonly PlanStepPreview[];
  readonly planFingerprint: string | null;
  readonly executableNow: boolean;
  readonly blockers: readonly string[];
  readonly missionId: string | null;      // set once a real mission is persisted (deep-link target)
  readonly nextStep: PierreNextStep;
  readonly analysis: IntelligenceAnalysis | null;  // set for OPTIMIZATION / MONITORING requests
  readonly disclosure: string;             // honest note (country-legal automation separate, etc.)
};

// Client-safe disclosure — must be unambiguous about legal readiness. Country-legal automatic execution
// is NOT available today (0 country rules are human-verified); it would additionally require qualified
// human legal review, live providers, and owner sign-off — none of which are in place.
const DISCLOSURE = "Pierre interprète et prépare le travail RH ; toute exécution sensible passe par une validation humaine. L'exécution légale automatique par pays n'est PAS disponible aujourd'hui (0 règle pays vérifiée par un juriste) : elle nécessiterait en plus une revue juridique humaine, des providers actifs et une validation du propriétaire.";

/** Pure mapper: interpretation (+ optional compiled plan preview) → the client-safe P9 response. */
export function toIntelligenceResponse(args: {
  interpretation: PierreRequestInterpretation;
  clarifications: readonly ClarificationQuestion[];
  plan?: GeneratedPlan | null;
  missionId?: string | null;
}): IntelligenceResponse {
  const { interpretation, clarifications, plan } = args;
  const needsClarification = interpretation.nextStep === "ASK_CLARIFICATION" || clarifications.some((c) => c.blocksExecution);
  const planSteps: PlanStepPreview[] = plan
    ? plan.planInput.steps.map((s) => ({
        stepKey: s.step_key,
        actionKey: s.action_key,
        summary: `${s.action_key}`,
        requiresApproval: /approval|signature|termination|sanction|compensation|contract/.test(s.action_key),
      }))
    : [];
  let phase: IntelligencePhase;
  if (interpretation.nextStep === "DECLINE_UNSUPPORTED") phase = "declined";
  else if (needsClarification) phase = "needs_clarification";
  else if (plan && !plan.ok) phase = "blocked";
  else if (plan && plan.ok) phase = "plan_ready";
  else phase = "interpreted";

  return {
    requestId: interpretation.requestId,
    phase,
    objective: interpretation.normalizedObjective,
    requestKind: interpretation.requestKind,
    confidence: interpretation.confidence,
    clarifications: needsClarification ? clarifications : [],
    planSteps,
    planFingerprint: plan?.compiled.plan_fingerprint ?? null,
    executableNow: !!plan && plan.ok && !needsClarification,
    blockers: plan?.blockers ?? [],
    missionId: args.missionId ?? null,
    nextStep: interpretation.nextStep,
    analysis: null,
    disclosure: DISCLOSURE,
  };
}

/** Build a client-safe response for an OPTIMIZATION / MONITORING request (engine findings, not a plan). */
export function toAnalysisResponse(args: {
  interpretation: PierreRequestInterpretation;
  analysis: IntelligenceAnalysis;
}): IntelligenceResponse {
  const { interpretation, analysis } = args;
  return {
    requestId: interpretation.requestId, phase: "analysis", objective: interpretation.normalizedObjective,
    requestKind: interpretation.requestKind, confidence: interpretation.confidence,
    clarifications: [], planSteps: [], planFingerprint: null, executableNow: false, blockers: [],
    missionId: null, nextStep: interpretation.nextStep, analysis, disclosure: DISCLOSURE,
  };
}
