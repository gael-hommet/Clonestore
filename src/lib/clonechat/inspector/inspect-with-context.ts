// src/lib/clonechat/inspector/inspect-with-context.ts
//
// Intégration ADDITIVE : Brain → Context → Diagnosis → Guide → Care → Actions (plan) → Visual →
// INSPECTION de preuve. La sortie conserve toutes les couches + le `structured` historique INCHANGÉ.
// CloneInspector enrichit Diagnosis/Care/Guide de PREUVES, mais n'accorde aucune permission, ne
// modifie aucun tenant, ne confirme ni n'exécute aucune action, ne déclare aucun succès, ne contourne
// pas CloneGuard et ne transforme jamais une capture en autorisation.

import { decideDiagnoseGuideCarePlanActionAndVisualGuide, type VisualGuidedDecision } from "@/lib/clonechat/visual";
import type { ContextualInput, CloneChatContext } from "@/lib/clonechat/context";
import type { CloneActionRequest } from "@/lib/clonechat/actions";
import type { VisualViewport } from "@/lib/clonechat/visual";
import type { VoiceJourneyResult } from "@/lib/clonechat/voice";
import { inspectEvidence, type InspectDeps } from "./inspect";
import type { RawEvidence, CloneInspectionResult } from "./evidence-types";

export interface InspectedDecision extends VisualGuidedDecision {
  readonly inspection: CloneInspectionResult | null;
}

/**
 * Phase 1 complète (jusqu'au guidage visuel) + inspection de preuve éventuelle. `structured` reste
 * inchangé. Rien n'est exécuté ni confirmé ; l'inspection est purement informative.
 */
export async function decideDiagnoseGuideCarePlanActionVisualAndInspect(
  input: ContextualInput,
  ctx: CloneChatContext,
  opts: { viewport?: VisualViewport; actionRequest?: CloneActionRequest; evidence?: RawEvidence; vision?: InspectDeps["vision"] } = {},
): Promise<InspectedDecision> {
  const visualGuided = decideDiagnoseGuideCarePlanActionAndVisualGuide(input, ctx, { viewport: opts.viewport, actionRequest: opts.actionRequest });
  const inspection = opts.evidence
    ? await inspectEvidence(opts.evidence, { vision: opts.vision }, { context: ctx, userText: input.message })
    : null;
  return { ...visualGuided, inspection };
}

/**
 * Adaptateur CloneVoice → inspection : consomme le contexte DÉJÀ sécurisé d'un résultat vocal, SANS
 * recopier l'audio ni le transcript complet dans l'inspection ou les logs.
 */
export function inspectFromVoiceResult(vr: VoiceJourneyResult, evidence: RawEvidence, deps: InspectDeps = {}): Promise<CloneInspectionResult> {
  return inspectEvidence(evidence, deps, { context: vr.context ?? undefined, userText: "" });
}
