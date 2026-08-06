// src/lib/clonechat/onboarding/orchestrator.ts
//
// Intégration GLOBALE BLOC 11 : Brain → Context → Diagnosis → Guide → Voice → Care → Actions →
// Visual → Inspector (BLOC 10) + Onboarding (A) + Mission Support (B). Sortie ADDITIVE conservant
// toutes les couches + le `structured` historique INCHANGÉ. Ne recopie aucun audio/transcript/
// binaire/secret dans l'état d'onboarding ou de mission. N'exécute ni ne confirme aucune action, ne
// crée aucune mission runtime.

import { decideDiagnoseGuideCarePlanActionVisualAndInspect, type InspectedDecision } from "@/lib/clonechat/inspector";
import type { ContextualInput, CloneChatContext } from "@/lib/clonechat/context";
import type { CloneActionRequest } from "@/lib/clonechat/actions";
import type { VisualViewport } from "@/lib/clonechat/visual";
import type { RawEvidence } from "@/lib/clonechat/inspector";
import type { VisionProvider } from "@/lib/clonechat/inspector";
import { resolveOnboarding, type OnboardingGoal } from "./engine";
import type { OnboardingStore } from "./store";
import type { OnboardingState } from "./types";
import { intakeAndPrepareMission } from "@/lib/clonechat/mission";
import type { MissionContract, MissionInputKey } from "@/lib/clonechat/mission";

export interface OnboardAndMissionResult extends InspectedDecision {
  readonly onboarding: OnboardingState;
  readonly mission: MissionContract;
  readonly nextStep: string;
}

export interface OnboardAndMissionOptions {
  readonly viewport?: VisualViewport;
  readonly actionRequest?: CloneActionRequest;
  readonly evidence?: RawEvidence;
  readonly vision?: VisionProvider;
  readonly onboardingGoal?: OnboardingGoal;
  readonly onboardingStore?: OnboardingStore;
  readonly providedInfo?: Readonly<Record<string, string>>;
  readonly providedMissionInputs?: Readonly<Partial<Record<MissionInputKey, string>>>;
  readonly cancelledOnboarding?: boolean;
  readonly interruptedOnboarding?: boolean; // interruption explicite reprenable (≠ abandon)
  readonly alreadyOnboarded?: boolean;
  readonly nowMs: number;
  readonly ttlMs?: number;
}

function computeNextStep(onboarding: OnboardingState, mission: MissionContract): string {
  if (onboarding.status === "escalate") return "Contactez le support pour rétablir l'accès.";
  if (onboarding.status === "blocked") return onboarding.steps[onboarding.currentStep - 1]?.text ?? "Réessayez dans un instant.";
  if (onboarding.status === "in_progress" || onboarding.status === "awaiting_input") {
    return onboarding.steps[onboarding.currentStep - 1]?.text ?? "Poursuivez l'onboarding.";
  }
  // Onboarding prêt/terminé → prochaine étape côté mission.
  switch (mission.status) {
    case "needs_clarification": return "Précisez votre demande (objectif et résultat attendu).";
    case "collecting_information": return `Fournissez : ${mission.missingInputs.join(", ")}.`;
    case "blocked": return "Un prérequis manque (compte / entreprise / droit Pierre).";
    case "requires_human_review": return "Cette demande sensible nécessite une revue humaine.";
    case "requires_confirmation": return "Confirmez explicitement ; l'exécution reste indisponible (paquet préparatoire).";
    case "unavailable": return "Demande non disponible : voir la limite indiquée.";
    case "prepared": return "Un brouillon/plan est prêt ; validez-le avant toute suite.";
    default: return "Décrivez votre besoin pour préparer une demande.";
  }
}

/**
 * Onboarding + préparation de mission, en une passe additive. `structured` reste inchangé. Le
 * système est consommable depuis texte / voix / parcours guidé / pièce jointe inspectée / reprise.
 */
export async function onboardAndPrepareMissionWithCloneChat(
  input: ContextualInput,
  ctx: CloneChatContext,
  opts: OnboardAndMissionOptions,
): Promise<OnboardAndMissionResult> {
  const inspected = await decideDiagnoseGuideCarePlanActionVisualAndInspect(input, ctx, {
    viewport: opts.viewport, actionRequest: opts.actionRequest, evidence: opts.evidence, vision: opts.vision,
  });

  const securityRefusal = inspected.diagnosis.kind === "permission_denied"
    || inspected.decision.requestedAction?.refusedReason === "governance_bypass_or_injection";

  const onboarding = resolveOnboarding({
    context: ctx, goal: opts.onboardingGoal, store: opts.onboardingStore, nowMs: opts.nowMs, ttlMs: opts.ttlMs,
    cancelled: opts.cancelledOnboarding, interrupted: opts.interruptedOnboarding, alreadyOnboarded: opts.alreadyOnboarded, providedInfo: opts.providedInfo,
  });

  const mission = intakeAndPrepareMission({
    message: input.message, context: ctx, diagnosis: inspected.diagnosis, securityRefusal,
    providedInputs: opts.providedMissionInputs, inspection: inspected.inspection, nowMs: opts.nowMs, ttlMs: opts.ttlMs,
  });

  return { ...inspected, onboarding, mission, nextStep: computeNextStep(onboarding, mission) };
}
