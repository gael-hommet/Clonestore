// src/lib/clonechat/visual/visual-with-context.ts
//
// Intégration ADDITIVE : Brain → Context → Diagnosis → Guide → Care → Actions (plan) → GUIDAGE
// VISUEL. Le guidage visuel peut préparer une navigation ou expliquer une cible, mais ne CONTOURNE
// jamais CloneActions, ne confirme aucune action et ne produit aucun effet externe. La sortie
// conserve toutes les couches + le `structured` historique INCHANGÉ.

import { decideDiagnoseGuideCareAndPlanAction, type PlannedDecision } from "@/lib/clonechat/actions";
import type { ContextualInput, CloneChatContext } from "@/lib/clonechat/context";
import type { CloneActionRequest } from "@/lib/clonechat/actions";
import type { VoiceJourneyResult } from "@/lib/clonechat/voice";
import { resolveVisualGuidance } from "./resolve";
import type { VisualGuidance, VisualViewport } from "./types";

export interface VisualGuidedDecision extends PlannedDecision {
  readonly visualGuidance: VisualGuidance;
}

/**
 * Phase 1 complète + guidage visuel. `structured` reste inchangé. Rien n'est exécuté ni confirmé :
 * le guidage visuel est purement informatif et pointe des cibles réelles (ou un repli texte).
 */
export function decideDiagnoseGuideCarePlanActionAndVisualGuide(
  input: ContextualInput,
  ctx: CloneChatContext,
  opts: { viewport?: VisualViewport; actionRequest?: CloneActionRequest } = {},
): VisualGuidedDecision {
  const planned = decideDiagnoseGuideCareAndPlanAction(input, ctx, { actionRequest: opts.actionRequest });
  const visualGuidance = resolveVisualGuidance({
    viewport: opts.viewport ?? "desktop",
    context: ctx,
    guide: planned.guide,
    diagnosis: planned.diagnosis,
    actionPlan: planned.actionPlan,
  });
  return { ...planned, visualGuidance };
}

/**
 * Adaptateur CloneVoice → guidage visuel : consomme un résultat vocal DÉJÀ sécurisé (contexte +
 * guide + diagnostic), SANS recopier l'audio ni le transcript. Renvoie un repli texte si le parcours
 * vocal n'a pas produit de contexte exploitable.
 */
export function visualGuidanceFromVoiceResult(vr: VoiceJourneyResult, viewport: VisualViewport = "desktop"): VisualGuidance | null {
  if (!vr.context) return null;
  return resolveVisualGuidance({ viewport, context: vr.context, guide: vr.guide, diagnosis: vr.diagnosis, actionPlan: null });
}
