// src/lib/clonechat/context/brain-context.ts
//
// Branche le Brain (BLOC 2) sur le CloneContext (BLOC 3), de façon compatible avec l'API existante.
// Le contexte n'ACCORDE jamais rien : il ne fait que RESTREINDRE/ANNOTER la décision (prérequis
// manquants, blocages réels, route verrouillée). Aucun faux droit, aucun état supposé. La sortie
// reste projetable vers le format existant `{ answer, honesty, tool_call, citations }`.

import {
  decide, toStructured, validateBrainDecision,
  type BrainDecision, type BrainAccountContext, type LegacyStructured,
} from "@/lib/clonechat/brain";
import type { CloneChatContext } from "./types";

/** Dérive le contexte compte du Brain depuis le CloneContext (jamais deviné). */
export function contextToBrainAccount(ctx: CloneChatContext): BrainAccountContext {
  return {
    authenticated: ctx.viewer.authenticated,
    hasCompany: ctx.tenant.resolved,
    hasPierreAccess: ctx.pierre.granted,
  };
}

export interface ContextualDecision {
  readonly decision: BrainDecision;
  readonly context: CloneChatContext;
  readonly structured: LegacyStructured;
}

export interface ContextualInput {
  readonly message: string;
  readonly modelDecision?: unknown;
  readonly modelUnavailable?: boolean;
}

function freeze(d: BrainDecision): BrainDecision {
  return Object.freeze({ ...d, truthIds: Object.freeze([...d.truthIds]), limitations: Object.freeze([...d.limitations]), evidence: Object.freeze([...d.evidence]) });
}

/**
 * Applique des GARDES de contexte à une décision. Ne fait que renforcer la sûreté (jamais accorder) :
 * - une action gouvernée non disponible → contexte compte requis + prérequis en limitations ;
 * - une défaillance de sécurité tenant → blocage annoté, jamais d'accès ;
 * - une route suggérée verrouillée avec prérequis manquants → route conservée (réelle) + limitation ;
 * - jamais executed=true, jamais une route inventée, jamais un droit ajouté.
 */
function applyContextGuards(d: BrainDecision, ctx: CloneChatContext): BrainDecision {
  const limitations = new Set<string>(d.limitations);
  let requiresAccountContext = d.requiresAccountContext;
  let requiresConfirmation = d.requiresConfirmation;
  const requiresEscalation = d.requiresEscalation;

  // Action ou contexte privé demandé mais non disponible → prérequis manquants, jamais accordé.
  const needsPrivilege = d.mode === "act" || ctx.requestClass === "PRIVATE_CONTEXT_REQUIRED" || ctx.requestClass === "GOVERNED_ACTION_REQUIRED";
  if (needsPrivilege && ctx.missingPrerequisites.length > 0) {
    requiresAccountContext = true;
    for (const p of ctx.missingPrerequisites) limitations.add(`prerequisite:${p}`);
  }
  if (d.mode === "act") requiresConfirmation = true; // invariant conservé

  // Défaillance de sécurité tenant : on annonce le blocage, on n'accorde rien, on n'exécute rien.
  if (ctx.tenant.securityFailure) {
    limitations.add("tenant_security_failure");
    requiresAccountContext = true;
  }
  if (ctx.pierre.lookupFailed) limitations.add("entitlement_lookup_unavailable");

  // Route suggérée réelle mais verrouillée avec prérequis manquants : conservée, annotée (jamais inventée).
  if (d.suggestedRoute && ctx.navigation.known && ctx.navigation.routePath === d.suggestedRoute
      && ctx.navigation.status === "gated" && ctx.missingPrerequisites.length > 0) {
    limitations.add("route_requires_prerequisite");
  }

  // Erreurs réellement présentes sur la page → visibles pour un futur diagnostic (BLOC 4), sans les inventer.
  for (const err of ctx.surfacedErrors) limitations.add(`surfaced_error:${err}`);

  const next = freeze({
    ...d,
    requiresAccountContext, requiresConfirmation, requiresEscalation,
    limitations: [...limitations],
  });
  // Sûreté : si l'annotation casse un invariant, on revient à la décision d'origine validée.
  return validateBrainDecision(next).ok ? next : d;
}

/**
 * Décision du Brain ENRICHIE par le contexte réel. Compatible avec l'API existante :
 * `structured` conserve le format `{ answer, honesty, tool_call, citations }`.
 */
export function decideWithContext(input: ContextualInput, ctx: CloneChatContext): ContextualDecision {
  const account = contextToBrainAccount(ctx);
  const base = decide({ message: input.message, account, modelDecision: input.modelDecision, modelUnavailable: input.modelUnavailable });
  const decision = applyContextGuards(base, ctx);
  return { decision, context: ctx, structured: toStructured(decision) };
}
