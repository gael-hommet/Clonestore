// C1.9 — CLONECHAT INTELLIGENCE RUNTIME.
//
// LA pipeline. Empruntée par tous les lecteurs — anonyme, connecté, sans société, avec
// société. Ce qui change selon le lecteur, ce sont les PERMISSIONS et les CONNAISSANCES
// VISIBLES, jamais le fait que CloneChat raisonne.
//
//   understand → retrieve → reason → decideTools → executeGovernedTools
//              → compose → verify → respond
//
// Aucune étape ne sélectionne un paragraphe pré-écrit. Quand la pipeline ne peut pas
// répondre, elle le DIT — elle ne se rabat pas sur un sujet voisin.
import type { ParrainKnowledgeChunk, ParrainViewerContext } from "../c1-1/parrain-types";
import type { C19ModelPort } from "./understanding";
import { understand } from "./understanding";
import type { ConversationMemory, ConversationTurn } from "./conversation-memory";
import { EMPTY_MEMORY, absorbTurn, memoryRetrievalTerms } from "./conversation-memory";
import { retrieveSemantic } from "./semantic-retrieval";
import { buildTruthContext, providedContextForJudge } from "./truth-context";
import type { ResponsePlan } from "./response-composer";
import { buildResponsePlan, compose } from "./response-composer";
import { factRelevancePlan } from "./response-relevance";
import { verifyResponse } from "./response-verifier";
import { C19_TOOLS, executeGovernedTool, type ToolExecutionOutcome } from "./governed-tools";
import { TraceCollector, type TurnTrace } from "./observability";
import type { C19Mode } from "./flags";
import { c19ToolsEnabled } from "./flags";

export interface RuntimeInput {
  readonly turnId: string;
  readonly message: string;
  readonly history: readonly ConversationTurn[];
  readonly memory?: ConversationMemory;
  readonly viewer: ParrainViewerContext;
  readonly candidates: readonly ParrainKnowledgeChunk[];
  readonly serverCountry: string | null;
  readonly at: string;
  readonly mode: C19Mode;
}

export type RuntimeStatus =
  | "answered"
  | "clarification_required"
  | "source_missing"
  | "blocked"
  | "degraded";

export interface RuntimeResult {
  readonly status: RuntimeStatus;
  readonly answer: string;
  readonly citations: readonly string[];
  readonly memory: ConversationMemory;
  readonly trace: TurnTrace;
  /** Diagnostic non destiné à l'utilisateur — pour la comparaison shadow et la preuve. */
  readonly diagnostics: Readonly<{
    understood: boolean;
    coverageGoals: number;
    /** Les objectifs eux-mêmes : permet de mesurer la couverture des DEUX voies. */
    coverageList: readonly string[];
    primaryGoal: string | null;
    secondaryGoals: readonly string[];
    knowledgeNeeds: readonly string[];
    isCorrection: boolean;
    sufficiency: string;
    verifierAction: string;
    issues: readonly string[];
    toolsExecuted: readonly string[];
    /** Outils proposés par le modèle mais REFUSÉS par la gouvernance (dont shadow). */
    toolsRefused: readonly string[];
    /** Faits transmis au rédacteur — indispensables pour juger le grounding. */
    groundingFacts: readonly string[];
    /** Contrat de pertinence appliqué à ce tour — permet de mesurer la concision. */
    relevance: Readonly<{
      nature: string;
      answerDepth: string;
      forbiddenTopics: readonly string[];
      forbiddenTopicLabels: readonly string[];
      multipleCurrencies: boolean;
      allowedTopics: readonly string[];
      shouldOfferNextStep: boolean;
      shouldUseCommercialCta: boolean;
      requestedCountries: readonly string[];
      unsupportedCountries: readonly string[];
      capabilityUnproven: boolean;
    }> | null;
  }>;
}

const EMPTY_DIAGNOSTICS = {
  coverageList: Object.freeze([] as string[]),
  primaryGoal: null,
  secondaryGoals: Object.freeze([] as string[]),
  knowledgeNeeds: Object.freeze([] as string[]),
  isCorrection: false,
  toolsRefused: Object.freeze([] as string[]),
  groundingFacts: Object.freeze([] as string[]),
  relevance: null,
} as const;

/**
 * Réponse honnête quand la pipeline ne peut PAS produire une réponse raisonnée.
 * Ce n'est pas un repli déguisé en intelligence : il annonce sa propre limite.
 * C'est le correctif de D4 — l'ancien repli renvoyait `honesty: "answered"`.
 */
function degraded(reason: string): { status: RuntimeStatus; answer: string } {
  return {
    status: "degraded",
    answer:
      "Je ne peux pas traiter votre demande correctement à cet instant — je préfère vous le dire " +
      "plutôt que de vous répondre à côté. Reformulez dans un moment, ou dites-moi en une phrase " +
      "ce que vous cherchez et je verrai ce que je peux confirmer avec certitude." +
      (reason ? "" : ""),
  };
}

export async function runCloneChatIntelligence(
  port: C19ModelPort,
  input: RuntimeInput,
): Promise<RuntimeResult> {
  const viewerIsAuthenticated = input.viewer.userId !== null;
  const trace = new TraceCollector(input.turnId, input.mode, viewerIsAuthenticated ? "user" : "anonymous");
  const memoryIn = input.memory ?? EMPTY_MEMORY;
  const toolsEnabled = c19ToolsEnabled(input.mode);

  // ── 1) UNDERSTAND ─────────────────────────────────────────────────────────
  const u = await trace.stage(
    "understand",
    () => understand(port, {
      message: input.message,
      history: input.history,
      memory: memoryIn,
      viewerIsAuthenticated,
      hasCompanyContext: input.viewer.companyId !== null,
      availableToolIds: C19_TOOLS.filter((t) => toolsEnabled).map((t) => t.id),
      at: input.at,
    }),
    (r) => ({
      ok: r.ok,
      reason: r.reason,
      questions: r.understanding?.questions_detected.length ?? 0,
      knowledgeNeeds: r.understanding?.knowledge_needs.length ?? 0,
      confidence: r.understanding?.confidence ?? 0,
      dependsOnHistory: r.understanding?.depends_on_history ?? false,
      outOfScope: r.understanding?.out_of_scope ?? false,
    }),
    (r) => r.ok,
  );
  trace.recordModelCall(u.usage);

  if (!u.ok || !u.understanding) {
    const d = degraded(u.reason ?? "understanding_failed");
    return Object.freeze({
      status: d.status, answer: d.answer, citations: Object.freeze([]),
      memory: memoryIn, trace: trace.finish(d.status),
      diagnostics: Object.freeze({
        ...EMPTY_DIAGNOSTICS,
        understood: false, coverageGoals: 0, sufficiency: "none",
        verifierAction: "n/a", issues: Object.freeze([u.reason ?? "understanding_failed"]),
        toolsExecuted: Object.freeze([]),
      }),
    });
  }
  const understanding = u.understanding;
  const memory = absorbTurn(memoryIn, understanding, memoryIn.turnCount);

  // ── 2) RETRIEVE ───────────────────────────────────────────────────────────
  const retrieval = await trace.stage(
    "retrieve",
    async () => retrieveSemantic(input.candidates, input.viewer, {
      knowledgeNeeds: understanding.knowledge_needs,
      contextTerms: memoryRetrievalTerms(memory),
      rawMessage: input.message,
    }),
    (r) => ({ sufficiency: r.sufficiency, selected: r.selected.length, chars: r.totalChars, unmatched: r.unmatchedNeeds.length }),
    (r) => r.sufficiency !== "none",
  );

  // ── 3) REASON ─────────────────────────────────────────────────────────────
  // Le plan porte désormais DEUX contrats : ce qu'il faut traiter (couverture) et ce qu'il
  // ne faut pas ajouter (pertinence). Le second détermine aussi quels FAITS sont servis :
  // un fait qu'on ne tend pas au rédacteur est un ajout qu'il ne fera pas.
  const plan = await trace.stage(
    "reason",
    async () => buildResponsePlan(understanding, retrieval.sufficiency, {
      unmatchedNeeds: retrieval.unmatchedNeeds,
      rawMessage: input.message,
    }),
    (p) => ({
      goals: p.items.length, shouldClarify: p.shouldClarify, caveats: p.globalCaveats.length,
      nature: p.relevance.nature, depth: p.relevance.answerDepth,
      forbidden: p.relevance.forbiddenUnsolicitedTopics.length,
    }),
  );

  const truth = buildTruthContext({
    retrieved: retrieval.selected,
    serverCountry: input.serverCountry,
    at: input.at,
    viewerIsAuthenticated,
    relevance: factRelevancePlan(plan.relevance, understanding),
  });

  // ── 4/5) DECIDE + EXECUTE TOOLS (gouvernés) ───────────────────────────────
  const toolOutcomes = await trace.stage(
    "executeGovernedTools",
    async (): Promise<readonly ToolExecutionOutcome[]> => {
      if (understanding.tool_needs.length === 0) return [];
      const priceFact = truth.facts.find((f) => f.key === "pierre.price.monthly");
      const subscription = priceFact ? Number.parseFloat(priceFact.value) : null;
      return understanding.tool_needs
        .filter((id) => C19_TOOLS.some((t) => t.id === id))
        .map((id) => executeGovernedTool(
          {
            toolId: id,
            args: {
              // Les paramètres viennent des ENTITÉS relevées, jamais d'une invention du composeur.
              headcount: numberFromEntities(understanding, /effectif|salari|personnes?\b|taille/i),
              peopleOnAdmin: numberFromEntities(understanding, /rh|administrat/i),
              hoursPerWeekPerPerson: numberFromEntities(understanding, /heure|temps|jour/i),
              hourlyCost: numberFromEntities(understanding, /co[ûu]t|salaire|tarif horaire/i),
              subscriptionMonthly: Number.isFinite(subscription) ? subscription : null,
            },
          },
          { viewerIsAuthenticated, toolsEnabled },
        ));
    },
    (r) => ({ proposed: understanding.tool_needs.length, executed: r.filter((x) => x.executed).length }),
  );

  // ── 6) COMPOSE ────────────────────────────────────────────────────────────
  const composed = await trace.stage(
    "compose",
    () => compose(port, {
      message: input.message, history: input.history, memory, understanding, plan, truth,
      toolOutcomes, sufficiency: retrieval.sufficiency, viewerIsAuthenticated,
    }),
    (r) => ({ ok: r.ok, reason: r.reason, chars: r.answer?.length ?? 0, citations: r.citations.length }),
    (r) => r.ok,
  );
  trace.recordModelCall(composed.usage);

  if (!composed.ok || !composed.answer) {
    const d = degraded(composed.reason ?? "compose_failed");
    return Object.freeze({
      status: d.status, answer: d.answer, citations: Object.freeze([]),
      memory, trace: trace.finish(d.status),
      diagnostics: Object.freeze({
        understood: true,
        coverageGoals: plan.coverage.length,
        coverageList: plan.coverage,
        primaryGoal: understanding.primary_goal,
        secondaryGoals: Object.freeze([...understanding.secondary_goals]),
        knowledgeNeeds: Object.freeze([...understanding.knowledge_needs]),
        isCorrection: understanding.is_correction,
        sufficiency: retrieval.sufficiency,
        verifierAction: "n/a", issues: Object.freeze([composed.reason ?? "compose_failed"]),
        toolsExecuted: Object.freeze(toolOutcomes.filter((t) => t.executed).map((t) => t.toolId)),
        toolsRefused: Object.freeze(toolOutcomes.filter((t) => !t.executed).map((t) => `${t.toolId}:${t.refusedReason}`)),
        groundingFacts: providedContextForJudge(truth),
        relevance: relevanceDiagnostics(plan.relevance),
      }),
    });
  }

  // ── 7) VERIFY ─────────────────────────────────────────────────────────────
  const verdict = await trace.stage(
    "verify",
    async () => verifyResponse({
      answer: composed.answer!, citations: composed.citations, plan, truth, toolOutcomes,
    }),
    (v) => ({ action: v.action, issues: v.issues.length, uncovered: v.uncoveredGoals.length }),
    (v) => v.action === "accept" || v.action === "repaired",
  );

  // ── 8) RESPOND ────────────────────────────────────────────────────────────
  const status: RuntimeStatus =
    verdict.action === "block" ? "blocked"
      : retrieval.sufficiency === "none" ? "source_missing"
        : verdict.action === "clarify" ? "clarification_required"
          : "answered";

  const answer = verdict.action === "block"
    ? "Je ne peux pas répondre à cela en l'état — la formulation dépasserait ce que je peux affirmer honnêtement. Dites-moi ce que vous cherchez précisément et je vous répondrai dans les limites de ce qui est vérifié."
    : verdict.text;

  return Object.freeze({
    status,
    answer,
    citations: verdict.citations,
    memory,
    trace: trace.finish(status),
    diagnostics: Object.freeze({
      understood: true,
      coverageGoals: plan.coverage.length,
      coverageList: plan.coverage,
      primaryGoal: understanding.primary_goal,
      secondaryGoals: Object.freeze([...understanding.secondary_goals]),
      knowledgeNeeds: Object.freeze([...understanding.knowledge_needs]),
      isCorrection: understanding.is_correction,
      sufficiency: retrieval.sufficiency,
      verifierAction: verdict.action,
      issues: Object.freeze(verdict.issues.map((i) => i.code)),
      toolsExecuted: Object.freeze(toolOutcomes.filter((t) => t.executed).map((t) => t.toolId)),
      toolsRefused: Object.freeze(toolOutcomes.filter((t) => !t.executed).map((t) => `${t.toolId}:${t.refusedReason}`)),
      // Les FAITS réellement fournis au rédacteur. Sans eux, un juge extérieur ne peut pas
      // distinguer une affirmation soutenue d'une invention : il n'a que la réponse sous les
      // yeux. C'est ce qui faisait noter « non étayé » des phrases pourtant reprises mot pour
      // mot d'un fait transmis. Un banc qui ne voit pas les sources ne mesure pas le grounding.
      //
      // Ce sont les faits SERVIS, pas tous les faits connus : un fait retenu par le contrat
      // de pertinence n'a jamais atteint le rédacteur, et le compter fausserait la mesure
      // dans l'autre sens — il rendrait « étayée » une affirmation qu'aucune source
      // transmise ne soutenait.
      groundingFacts: providedContextForJudge(truth),
      relevance: relevanceDiagnostics(plan.relevance),
    }),
  });
}

/** Vue sérialisable du contrat de pertinence — sert la mesure, jamais le produit. */
function relevanceDiagnostics(c: ResponsePlan["relevance"]) {
  return Object.freeze({
    nature: c.nature,
    answerDepth: c.answerDepth,
    forbiddenTopics: Object.freeze(c.forbiddenUnsolicitedTopics.map((t) => t.id)),
    forbiddenTopicLabels: Object.freeze([...c.forbiddenTopicLabels]),
    multipleCurrencies: c.multipleCurrencies,
    allowedTopics: Object.freeze([...c.allowedSupportingTopics]),
    shouldOfferNextStep: c.shouldOfferNextStep,
    shouldUseCommercialCta: c.shouldUseCommercialCta,
    requestedCountries: Object.freeze([...c.requestedCountries]),
    unsupportedCountries: Object.freeze([...c.unsupportedCountries]),
    capabilityUnproven: c.capabilityUnproven,
  });
}

/** Extrait un nombre d'une entité dont la NATURE correspond — jamais du message brut. */
function numberFromEntities(u: { entities: readonly { kind: string; value: string }[] }, kindMatcher: RegExp): number | null {
  for (const e of u.entities) {
    if (!kindMatcher.test(e.kind)) continue;
    const m = e.value.replace(",", ".").match(/\d+(?:\.\d+)?/);
    if (m) return Number.parseFloat(m[0]);
  }
  return null;
}
