// src/lib/clonechat/actions/actions-with-context.ts
//
// Intégration ADDITIVE : Brain → Context → Diagnosis → Guide → Care → PLAN d'action (phase 1, sans
// exécution), puis exécution contrôlée SÉPARÉE (phase 2). La sortie conserve toutes les couches +
// le `structured` historique INCHANGÉ. Un adaptateur consommable par CloneVoice évite de recopier
// l'audio ou le transcript dans les traces.

import { decideDiagnoseGuideAndCare, type CaredDecision } from "@/lib/clonechat/care";
import type { ContextualInput, CloneChatContext } from "@/lib/clonechat/context";
import type { VoiceJourneyResult } from "@/lib/clonechat/voice";
import { planAction, executeAction, type PlanActionContext, type ExecuteActionContext } from "./plan";
import type { CloneActionRequest, CloneActionPlan, CloneActionResult, GuardResult } from "./types";

export interface PlannedDecision extends CaredDecision {
  /** Plan d'action (null si aucune action n'a été demandée/dérivée). */
  readonly actionPlan: CloneActionPlan | null;
  readonly guard: GuardResult | null;
}

/** Dérive une requête d'action SÛRE par défaut depuis le guide (navigation vers la route réelle). */
function deriveActionRequest(cared: CaredDecision): CloneActionRequest | null {
  const route = cared.guide?.recommendedRoute ?? cared.guide?.startRoute ?? null;
  if (route) return { actionId: "navigate", args: { route } };
  return null;
}

/**
 * PHASE 1 complète : comprend, contextualise, diagnostique, guide, produit Care, résout une action
 * réelle et applique CloneGuard — SANS rien exécuter. `structured` reste inchangé.
 */
export function decideDiagnoseGuideCareAndPlanAction(
  input: ContextualInput,
  ctx: CloneChatContext,
  opts: { actionRequest?: CloneActionRequest } = {},
): PlannedDecision {
  const cared = decideDiagnoseGuideAndCare(input, ctx);
  const securityRefusal = cared.decision.requestedAction?.refusedReason === "governance_bypass_or_injection"
    || cared.diagnosis.kind === "permission_denied";

  const request = opts.actionRequest ?? deriveActionRequest(cared);
  if (!request) return { ...cared, actionPlan: null, guard: null };

  const actionPlan = planAction(request, { context: ctx, securityRefusal });
  return { ...cared, actionPlan, guard: actionPlan.guard };
}

/** PHASE 2 : exécution contrôlée d'un plan immuable (Guard + confirmation + idempotence + trace). */
export function executeControlledAction(plan: CloneActionPlan, exec: ExecuteActionContext): Promise<CloneActionResult> {
  return executeAction(plan, exec);
}

/**
 * Adaptateur CloneVoice → plan d'action : consomme un résultat vocal DÉJÀ sécurisé (contexte +
 * décision), SANS recopier l'audio ni le transcript. Renvoie null si le parcours vocal n'a pas
 * produit de contexte exploitable.
 */
export function planActionFromVoiceResult(vr: VoiceJourneyResult, request: CloneActionRequest): CloneActionPlan | null {
  if (!vr.context) return null;
  const securityRefusal = vr.securityRefusal
    || vr.decision?.requestedAction?.refusedReason === "governance_bypass_or_injection";
  const planCtx: PlanActionContext = { context: vr.context, securityRefusal };
  return planAction(request, planCtx);
}
