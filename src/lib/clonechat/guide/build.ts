// src/lib/clonechat/guide/build.ts
//
// Sélection + finalisation DÉTERMINISTE du guide. À partir du CloneContext (BLOC 3), du diagnostic
// (BLOC 4) et — optionnellement — de la décision du Brain (BLOC 2, pour l'intention), on choisit le
// parcours réel adapté et on calcule l'étape actuelle et l'état. Toutes les routes proviennent du
// registre / des CTA réels ; aucune étape, route ou réussite n'est inventée. Le guide ne prétend
// JAMAIS avoir terminé une action : `completed` n'est atteint que lorsqu'un état RÉEL du contexte
// prouve que le but est déjà satisfait (ex. entreprise résolue), jamais pour une action « à faire ».

import { prerequisiteCta, type CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";
import type { BrainDecision } from "@/lib/clonechat/brain";
import type { CloneChatContext } from "@/lib/clonechat/context";
import type { CloneChatDiagnosis } from "@/lib/clonechat/diagnosis";
import {
  CLONECHAT_GUIDE_VERSION, type CloneGuide, type CloneGuideStep, type GuideState,
} from "./types";
import {
  type GuideBlueprint,
  reservePierreBlueprint, viewDemoBlueprint, checkoutBlueprint, loginBlueprint, signupBlueprint,
  resolveNoCompanyBlueprint, selectCompanyBlueprint, resolveNoPierreBlueprint, recoverBlueprint,
  contactSupportBlueprint, unknownRouteBlueprint, afterPaymentBlueprint, tenantOrPermissionBlueprint,
  clarifyRequestBlueprint,
} from "./catalog";

export interface BuildGuideOptions {
  readonly brainDecision?: BrainDecision;
}

// ── Prédicats de contexte (jamais devinés) ────────────────────────────────────

function prereqSatisfied(ctx: CloneChatContext, p: CloneChatPrerequisite): boolean {
  if (p === "authentication") return ctx.viewer.authenticated;
  if (p === "active_company") return ctx.tenant.resolved;
  return ctx.pierre.granted; // pierre_entitlement
}

/** État initial réellement connu — décrit en CATÉGORIES (jamais de companyId, jamais un état deviné). */
function describeInitialState(ctx: CloneChatContext): string {
  const who = ctx.viewer.authenticated ? "connecté" : "anonyme";
  const co = ctx.tenant.resolved
    ? "entreprise active"
    : ctx.tenant.securityFailure
      ? "accès entreprise bloqué"
      : "sans entreprise résolue";
  const pierre = ctx.pierre.granted
    ? "Pierre actif"
    : ctx.pierre.lookupFailed
      ? "droit Pierre non vérifiable"
      : "Pierre non actif";
  return `Utilisateur ${who} ; ${co} ; ${pierre}.`;
}

/** Première étape « actuelle » : première porte non satisfaite, sinon première étape d'action. */
function computeCurrent(ctx: CloneChatContext, bp: GuideBlueprint): number {
  for (let i = 0; i < bp.steps.length; i++) {
    const s = bp.steps[i];
    if (s.gate) {
      if (!(s.prerequisites ?? []).every((p) => prereqSatisfied(ctx, p))) return i + 1;
    } else {
      return i + 1;
    }
  }
  return bp.steps.length; // toutes les portes satisfaites, aucune action restante → but atteint
}

function toSteps(bp: GuideBlueprint): CloneGuideStep[] {
  return bp.steps.map((s, i) => ({
    index: i + 1,
    id: s.id,
    text: s.text,
    route: s.route,
    prerequisites: Object.freeze([...(s.prerequisites ?? [])]),
    successCondition: s.success,
    blockedCondition: s.blocked,
    recovery: s.recovery,
  }));
}

interface FinalizeOverrides {
  readonly state: GuideState;
  readonly currentStep: number;
  readonly clarificationQuestion?: string | null;
  readonly requiresConfirmation?: boolean;
  readonly requiresEscalation?: boolean;
  readonly recommendedRoute?: string | null;
  readonly evidence?: readonly string[];
}

function finalize(bp: GuideBlueprint, ctx: CloneChatContext, diagnosis: CloneChatDiagnosis, o: FinalizeOverrides): CloneGuide {
  const steps = toSteps(bp);
  return Object.freeze({
    version: CLONECHAT_GUIDE_VERSION,
    id: bp.id,
    goal: bp.goal,
    initialState: describeInitialState(ctx),
    startRoute: bp.startRoute,
    steps: Object.freeze(steps),
    totalSteps: steps.length,
    currentStep: o.currentStep,
    state: o.state,
    clarificationQuestion: o.clarificationQuestion ?? null,
    requiresConfirmation: o.requiresConfirmation ?? bp.requiresConfirmation ?? false,
    requiresEscalation: o.requiresEscalation ?? false,
    missingPrerequisites: Object.freeze([...ctx.missingPrerequisites]),
    recommendedRoute: o.recommendedRoute ?? diagnosis.recommendedRoute ?? bp.startRoute,
    evidence: Object.freeze([...(o.evidence ?? [`guide:${bp.id}`, `diagnosis:${diagnosis.kind}`])]),
  });
}

/** Guide « de flux » (intention / résolution de prérequis) : état et étape calculés depuis les portes. */
function flowGuide(bp: GuideBlueprint, ctx: CloneChatContext, diagnosis: CloneChatDiagnosis): CloneGuide {
  const gates = bp.steps.filter((s) => s.gate);
  const allGatesSatisfied = gates.every((s) => (s.prerequisites ?? []).every((p) => prereqSatisfied(ctx, p)));
  const hasDoing = bp.steps.some((s) => !s.gate);
  const completed = gates.length > 0 && allGatesSatisfied && !hasDoing; // uniquement pour les guides de prérequis
  return finalize(bp, ctx, diagnosis, {
    state: completed ? "completed" : "ready",
    currentStep: completed ? bp.steps.length : computeCurrent(ctx, bp),
  });
}

// ── Détection d'intention (depuis la décision réelle du Brain) ─────────────────

function intentBlueprint(brain: BrainDecision | undefined): GuideBlueprint | null {
  const route = brain?.suggestedRoute ?? brain?.requestedAction?.targetRoute ?? null;
  switch (route) {
    case "/reserver/pierre": return reservePierreBlueprint();
    case "/demo/pierre": return viewDemoBlueprint();
    case "/checkout": return checkoutBlueprint();
    case "/login": return loginBlueprint();
    case "/signup": return signupBlueprint();
    case "/questions": return contactSupportBlueprint();
    default: return null;
  }
}

/** Guide de résolution pour le prérequis manquant le plus proche (auth → entreprise → Pierre). */
function prereqResolutionBlueprint(ctx: CloneChatContext): GuideBlueprint | null {
  const missing = ctx.missingPrerequisites;
  if (missing.includes("authentication")) return loginBlueprint();
  if (missing.includes("active_company")) {
    const route = prerequisiteCta(["active_company"])?.route ?? null;
    return ctx.tenant.refusalCode === "COMPANY_SELECTION_REQUIRED"
      ? selectCompanyBlueprint(route)
      : resolveNoCompanyBlueprint(route);
  }
  if (missing.includes("pierre_entitlement")) return resolveNoPierreBlueprint(prerequisiteCta(["pierre_entitlement"])?.route ?? null);
  return null;
}

// ── Moteur de construction du guide ────────────────────────────────────────────

/**
 * Construit le guide adapté à la situation réelle. Renvoie `null` quand il n'y a ni intention
 * actionnable ni blocage à résoudre (ex. simple question conversationnelle) — on n'invente jamais
 * un parcours sans objet.
 */
export function buildCloneGuide(ctx: CloneChatContext, diagnosis: CloneChatDiagnosis, opts: BuildGuideOptions = {}): CloneGuide | null {
  const brain = opts.brainDecision;

  switch (diagnosis.kind) {
    // Blocages durs : priment sur toute intention (on ne peut pas « juste continuer »).
    case "permission_denied":
      return finalize(tenantOrPermissionBlueprint("permission"), ctx, diagnosis, {
        state: "blocked", currentStep: 1, requiresEscalation: false, recommendedRoute: null,
      });

    case "tenant_security_failure": {
      const suspended = ctx.tenant.refusalCode === "MEMBERSHIP_SUSPENDED";
      return finalize(tenantOrPermissionBlueprint(suspended ? "tenant_suspended" : "tenant_unavailable"), ctx, diagnosis, {
        state: suspended ? "escalate" : "blocked",
        currentStep: 1,
        requiresEscalation: diagnosis.requiresEscalation,
      });
    }

    case "provider_failure": {
      if (diagnosis.blockerCategory === "entitlement") {
        return finalize(recoverBlueprint("entitlement"), ctx, diagnosis, { state: "blocked", currentStep: 1 });
      }
      // Modèle indisponible : le guidage déterministe reste possible → on privilégie l'intention.
      const intent = intentBlueprint(brain);
      if (intent) return flowGuide(intent, ctx, diagnosis);
      return finalize(recoverBlueprint("provider"), ctx, diagnosis, { state: "blocked", currentStep: 1 });
    }

    case "route_or_navigation_issue":
      return finalize(unknownRouteBlueprint(ctx.navigation.routePath), ctx, diagnosis, {
        state: "needs_clarification", currentStep: 1,
        clarificationQuestion: diagnosis.clarificationQuestion,
      });

    case "unknown_requires_escalation":
      return finalize(contactSupportBlueprint(), ctx, diagnosis, {
        state: "escalate", currentStep: 1, requiresEscalation: true,
      });

    case "confirmed_cause":
    case "probable_cause": {
      const confirmed = diagnosis.causeCertainty === "confirmed";
      return finalize(afterPaymentBlueprint(diagnosis.recommendedRoute, confirmed), ctx, diagnosis, {
        state: confirmed ? "ready" : "needs_clarification",
        currentStep: 1,
        clarificationQuestion: diagnosis.clarificationQuestion,
      });
    }

    case "insufficient_context": {
      // Une intention claire prime : on guide vers le but plutôt que de seulement demander des détails.
      const intent = intentBlueprint(brain);
      if (intent) return flowGuide(intent, ctx, diagnosis);
      return finalize(clarifyRequestBlueprint(), ctx, diagnosis, {
        state: "needs_clarification", currentStep: 1,
        clarificationQuestion: diagnosis.clarificationQuestion,
      });
    }

    // missing_prerequisite | no_blocker
    default: {
      // 1) Intention explicite → guide vers le but (les portes de prérequis sont intégrées).
      const intent = intentBlueprint(brain);
      if (intent) return flowGuide(intent, ctx, diagnosis);
      // 2) Prérequis manquant sans intention → guide de résolution du prérequis le plus proche.
      if (diagnosis.kind === "missing_prerequisite") {
        const bp = prereqResolutionBlueprint(ctx);
        if (bp) return flowGuide(bp, ctx, diagnosis);
      }
      // 3) Rien à guider (question conversationnelle sans objet actionnable).
      return null;
    }
  }
}
