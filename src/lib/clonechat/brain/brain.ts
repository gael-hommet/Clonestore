// src/lib/clonechat/brain/brain.ts
//
// BRAIN — point d'entrée `decide()`. Produit une BrainDecision structurée, déterministe et sûre.
// Autorité DÉTERMINISTE : injection (BLOC 0), route (registre réel), vérités (Product Truth Engine),
// action (jamais exécutée, confirmation requise), contexte compte (jamais deviné). Le modèle ne
// fournit que de la prose validée. `toStructured()` projette la décision vers le format EXISTANT
// consommé par l'interface, sans le casser.

import { detectPromptInjection, injectionRefusalMessage } from "@/lib/clonechat/context-boundary";
import { getRouteEntry } from "@/lib/nav/route-registry";
import { getTruthById } from "@/lib/clonechat/product-truth/registry";
import { classifyMode, resolveRoute, retrieveTruths, norm } from "./classify";
import { extractModelProse, validateBrainDecision } from "./parse";
import {
  BRAIN_DECISION_VERSION, type BrainDecision, type BrainInput, type BrainRequestedAction,
} from "./types";

function freeze(d: BrainDecision): BrainDecision {
  return Object.freeze({ ...d, truthIds: Object.freeze([...d.truthIds]), limitations: Object.freeze([...d.limitations]), evidence: Object.freeze([...d.evidence]) });
}

/** Décision sûre de dernier recours (jamais un faux succès). */
function safeFallback(reason: string): BrainDecision {
  return freeze({
    version: BRAIN_DECISION_VERSION, mode: "clarify", intent: "safe_fallback",
    answer: "Je n'ai pas bien compris la demande. Peux-tu la reformuler ? Par exemple : comprendre Pierre, voir les prix, réserver, ou un problème précis.",
    confidence: "low", needsClarification: true,
    clarificationQuestion: "Peux-tu préciser ta demande ?",
    truthIds: [], suggestedRoute: null, requestedAction: null,
    requiresAccountContext: false, requiresConfirmation: false, requiresEscalation: false,
    limitations: [reason], evidence: ["safe_fallback"],
  });
}

function actionKindForRoute(route: string | null): string {
  if (route === "/reserver/pierre") return "reserve_pierre";
  if (route === "/checkout") return "open_checkout";
  if (route === "/demo/pierre") return "open_demo";
  return route ? "open_page" : "unknown_action";
}

function routeLabel(route: string | null): string | null {
  return route ? (getRouteEntry(route)?.label ?? null) : null;
}

/** Produit la décision structurée du Brain pour une demande libre. Toujours une décision valide. */
export function decide(input: BrainInput): BrainDecision {
  const message = input.message ?? "";
  const account = input.account;
  const prose = extractModelProse(input.modelDecision);

  // 0) SÉCURITÉ (BLOC 0) : injection / contournement de gouvernance → refus, jamais une question
  //    légitime, jamais adouci par la prose du modèle.
  if (detectPromptInjection(message)) {
    const action: BrainRequestedAction = { kind: "refused", targetRoute: null, executed: false, refusedReason: "governance_bypass_or_injection" };
    return finalize(freeze({
      version: BRAIN_DECISION_VERSION, mode: "act", intent: "refused_governance_or_injection",
      answer: injectionRefusalMessage(), confidence: "high", needsClarification: false, clarificationQuestion: null,
      truthIds: [], suggestedRoute: null, requestedAction: action,
      requiresAccountContext: false, requiresConfirmation: true, requiresEscalation: false,
      limitations: ["governance_bypass_or_injection_refused"], evidence: ["detectPromptInjection=true"],
    }));
  }

  const { mode, confidence, intent } = classifyMode(message, account);
  const hits = retrieveTruths(message, 5);
  const truthIds = hits.map((h) => h.id);
  const evidence = hits.map((h) => h.evidence);
  const modelUnavailable = input.modelUnavailable === true;

  switch (mode) {
    case "clarify": {
      const q = prose.clarificationQuestion ?? "Peux-tu préciser ce que tu cherches ? (ex. réserver Pierre, comprendre les prix, un problème précis)";
      return finalize(freeze({
        version: BRAIN_DECISION_VERSION, mode, intent: prose.intent ?? intent, answer: q, confidence,
        needsClarification: true, clarificationQuestion: q, truthIds, suggestedRoute: null, requestedAction: null,
        requiresAccountContext: false, requiresConfirmation: false, requiresEscalation: false,
        limitations: ["needs_clarification"], evidence: evidence.length ? evidence : ["classifier:vague"],
      }));
    }

    case "act": {
      const route = resolveRoute(message);
      const kind = actionKindForRoute(route);
      const needsAccount = !(account?.authenticated === true);
      const label = routeLabel(route);
      const det = route
        ? `Je ne peux pas exécuter cette action à ta place : je prépare, tu confirmes. Pour cela, la page est « ${label ?? route} » : ${route}. Confirme pour continuer.`
        : "Je ne peux pas exécuter cette action à ta place : je prépare et tu confirmes. Peux-tu préciser l'action souhaitée ?";
      const action: BrainRequestedAction = { kind, targetRoute: route, executed: false, refusedReason: null };
      const lims = ["action_not_executed", ...(needsAccount ? ["account_required"] : []), ...(route ? [] : ["route_not_found"])];
      return finalize(freeze({
        version: BRAIN_DECISION_VERSION, mode, intent, answer: det, confidence,
        needsClarification: false, clarificationQuestion: null, truthIds, suggestedRoute: route, requestedAction: action,
        requiresAccountContext: needsAccount, requiresConfirmation: true, requiresEscalation: false,
        limitations: lims, evidence: evidence.length ? evidence : ["classifier:act"],
      }));
    }

    case "escalate": {
      return finalize(freeze({
        version: BRAIN_DECISION_VERSION, mode, intent,
        answer: "Cette situation ressemble à un problème que je ne peux pas résoudre seul. Je peux préparer une demande d'aide structurée pour un humain — tu décides de l'envoyer.",
        confidence, needsClarification: false, clarificationQuestion: null, truthIds, suggestedRoute: null, requestedAction: null,
        requiresAccountContext: false, requiresConfirmation: false, requiresEscalation: true,
        limitations: ["requires_human"], evidence: evidence.length ? evidence : ["classifier:escalate"],
      }));
    }

    case "diagnose": {
      const hasCtx = account?.authenticated === true;
      const answer = hasCtx
        ? "Voici un diagnostic fondé sur ton compte : je vérifie l'étape en cours, l'accès Pierre et la configuration. Dis-moi l'action précise qui échoue pour cibler la cause."
        : "Pour diagnostiquer précisément pourquoi tu es bloqué, j'ai besoin du contexte de ton compte (connexion, accès Pierre, étape en cours). Connecte-toi ou précise l'étape — je ne devine jamais un état de compte que je ne vois pas.";
      return finalize(freeze({
        version: BRAIN_DECISION_VERSION, mode, intent, answer, confidence,
        needsClarification: false, clarificationQuestion: null, truthIds, suggestedRoute: null, requestedAction: null,
        requiresAccountContext: !hasCtx, requiresConfirmation: false, requiresEscalation: false,
        limitations: hasCtx ? ["diagnosis_partial"] : ["account_context_needed"],
        evidence: evidence.length ? evidence : ["classifier:diagnose"],
      }));
    }

    case "guide": {
      const route = resolveRoute(message);
      const label = routeLabel(route);
      const needsAccount = route === "/reserver/pierre" || route === "/checkout";
      const answer = route
        ? `Voici comment procéder : 1) ouvre la page « ${label ?? route} » (${route}) ; 2) suis les étapes indiquées ; 3) confirme quand c'est demandé. Je peux t'accompagner à chaque étape.`
        : "Je peux te guider pas à pas — précise ce que tu veux accomplir (réserver Pierre, payer, configurer) et je t'indique la page et les étapes réelles.";
      return finalize(freeze({
        version: BRAIN_DECISION_VERSION, mode, intent, answer, confidence,
        needsClarification: false, clarificationQuestion: null, truthIds, suggestedRoute: route, requestedAction: null,
        requiresAccountContext: needsAccount && !(account?.authenticated === true), requiresConfirmation: false, requiresEscalation: false,
        limitations: route ? [] : ["route_not_found"], evidence: evidence.length ? evidence : ["classifier:guide"],
      }));
    }

    case "orient": {
      const route = resolveRoute(message);
      const label = routeLabel(route);
      const answer = route
        ? `Pour cela, rendez-vous sur la page « ${label ?? route} » : ${route}.`
        : "Je n'ai pas de page dédiée exacte pour cette demande. Peux-tu préciser (réserver, payer, démo, support) ?";
      return finalize(freeze({
        version: BRAIN_DECISION_VERSION, mode, intent, answer, confidence,
        needsClarification: !route, clarificationQuestion: route ? null : "Que veux-tu faire précisément (réserver, payer, voir la démo, support) ?",
        truthIds, suggestedRoute: route, requestedAction: null,
        requiresAccountContext: false, requiresConfirmation: false, requiresEscalation: false,
        limitations: route ? [] : ["route_not_found"], evidence: evidence.length ? evidence : ["classifier:orient"],
      }));
    }

    case "explain":
    case "answer":
    default: {
      const grounded = hits.length > 0;
      let answer: string;
      const lims: string[] = [];
      if (prose.answer) {
        answer = prose.answer;
      } else if (grounded) {
        answer = summarizeTruths(hits.map((h) => h.id));
      } else if (modelUnavailable) {
        answer = "Je ne peux pas répondre à l'instant (connexion momentanément indisponible). Réessaie dans quelques instants.";
        lims.push("model_unavailable");
      } else {
        answer = "Je n'ai pas cette information sous la main de façon fiable. Peux-tu préciser, ou reformuler ta question ?";
        lims.push("no_grounded_truth");
      }
      return finalize(freeze({
        version: BRAIN_DECISION_VERSION, mode: mode === "explain" ? "explain" : "answer", intent: prose.intent ?? intent,
        answer, confidence: grounded ? confidence : "low", needsClarification: false, clarificationQuestion: null,
        truthIds, suggestedRoute: null, requestedAction: null,
        requiresAccountContext: false, requiresConfirmation: false, requiresEscalation: false,
        limitations: lims, evidence: evidence.length ? evidence : ["classifier:answer"],
      }));
    }
  }
}

/** Résumé déterministe et fondé à partir des vérités produit sélectionnées (valeurs canoniques). */
function summarizeTruths(ids: readonly string[]): string {
  const values = ids.map((id) => getTruthById(id)?.value).filter((v): v is string => !!v);
  return values.slice(0, 2).join(" ");
}

/** Garantit une décision VALIDE ; sinon renvoie le fallback sûr (jamais un faux succès). */
function finalize(d: BrainDecision): BrainDecision {
  const v = validateBrainDecision(d);
  if (!v.ok) return safeFallback(`invalid_decision:${v.errors.join(",")}`);
  return d;
}

// ── Adaptateur vers le format EXISTANT consommé par l'interface ───────────────
export interface LegacyStructured {
  readonly answer: string;
  readonly honesty: "answered" | "unknown";
  readonly tool_call: null;
  readonly citations: readonly [];
}

/** Projette une BrainDecision vers { answer, honesty, tool_call, citations } (compat interface). */
export function toStructured(d: BrainDecision): LegacyStructured {
  const uncertain = d.needsClarification || d.requiresEscalation
    || d.limitations.some((l) => l === "model_unavailable" || l === "no_grounded_truth" || l === "account_context_needed");
  return { answer: d.answer, honesty: uncertain ? "unknown" : "answered", tool_call: null, citations: [] };
}

export { norm };
