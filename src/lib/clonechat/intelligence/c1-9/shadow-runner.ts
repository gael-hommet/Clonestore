// C1.9 — EXÉCUTION SHADOW ET COMPARAISON.
//
// Exécute la pipeline True AI À CÔTÉ de la voie stable, sans jamais toucher à ce que
// l'utilisateur reçoit. Trois protections dures :
//
//   1. BUDGET DE PROCESSUS — un plafond de tokens partagé ; épuisé, le shadow s'arrête.
//      Sans cela, brancher le shadow doublerait silencieusement la facture.
//   2. DÉLAI MAXIMUM — le shadow ne peut jamais retarder ni faire échouer un tour.
//   3. AUCUN EFFET — outils désactivés par le contexte lecture seule, aucune persistance.
//
// Cette couche ne renvoie JAMAIS d'exception : un shadow en panne est un shadow absent.
import type { ParrainKnowledgeChunk, ParrainViewerContext } from "../c1-1/parrain-types";
import { runCloneChatIntelligence, type RuntimeResult } from "./intelligence-runtime";
import { createOpenAIC19Port, createTokenBudget, budgetExhausted, loadC19ModelConfig, type TokenBudget } from "./openai-port";
import { createShadowContext, type ShadowContext } from "./shadow-context";
import type { ConversationMemory, ConversationTurn } from "./conversation-memory";
import { EMPTY_MEMORY } from "./conversation-memory";
import { tokenize } from "./semantic-retrieval";

// ── Budget de processus ──────────────────────────────────────────────────────

function readShadowTokenCap(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number.parseInt(env.CLONECHAT_C19_SHADOW_TOKEN_BUDGET ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 200_000;
}

let processBudget: TokenBudget | null = null;
function sharedBudget(): TokenBudget {
  if (!processBudget) processBudget = createTokenBudget(readShadowTokenCap());
  return processBudget;
}
/** Tests uniquement : réinitialise le compteur de processus. */
export function resetShadowBudget(): void { processBudget = null; }
export function shadowBudgetSnapshot(): { spent: number; cap: number } {
  const b = sharedBudget();
  return { spent: b.spentInput + b.spentOutput, cap: b.maxTotalTokens };
}

function readShadowTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number.parseInt(env.CLONECHAT_C19_SHADOW_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 20_000;
}

// ── Comparaison ──────────────────────────────────────────────────────────────

export interface ShadowComparison {
  readonly requestId: string;
  readonly viewerMode: string;
  readonly ran: boolean;
  readonly skippedReason: string | null;

  readonly understanding: {
    readonly primaryGoal: string | null;
    readonly secondaryGoals: readonly string[];
    readonly questionsDetected: number;
    readonly knowledgeNeeds: readonly string[];
    readonly requiresClarification: boolean;
    readonly dependsOnHistory: boolean;
    readonly isCorrection: boolean;
    readonly outOfScope: boolean;
    readonly confidence: number;
  } | null;

  readonly retrieval: { readonly sufficiency: string; readonly selected: number; readonly chars: number } | null;
  readonly plan: { readonly goals: number; readonly shouldClarify: boolean } | null;
  readonly toolsProposedNotExecuted: readonly string[];
  readonly verifier: { readonly action: string; readonly issues: readonly string[] } | null;

  /** Longueurs et signaux seulement — jamais l'intégralité des textes en journal partagé. */
  readonly legacy: { readonly chars: number; readonly source: string; readonly honesty: string; readonly hasCta: boolean };
  readonly shadow: { readonly chars: number; readonly status: string; readonly citations: number } | null;

  readonly delta: {
    /** Part des questions détectées effectivement couverte par chaque réponse. */
    readonly legacyCoverage: number;
    readonly shadowCoverage: number;
    readonly legacyIsTemplate: boolean;
    readonly bothIdentical: boolean;
    readonly shadowLongerBy: number;
  } | null;

  /** §4 — « modèle sélectionné ». La pipeline en route deux : un pour comprendre, un pour
   *  composer. Sans ce champ, l'observabilité ne permet pas de dire QUEL modèle a répondu,
   *  ni de corréler un changement de qualité à un changement de routage. */
  readonly models: { readonly understand: string; readonly compose: string };
  readonly modelCalls: number;

  readonly latencyMs: number;
  readonly tokens: { readonly input: number; readonly output: number };
  readonly estimatedCostUsd: number;
  readonly budget: { readonly spent: number; readonly cap: number };
  readonly error: string | null;
}

/**
 * Couverture mesurée : part des questions détectées dont le vocabulaire apparaît dans la
 * réponse. Volontairement identique des deux côtés — le but est de COMPARER, pas de noter.
 * C'est une mesure lexicale, donc indicative : le juge de campagne reste l'autorité.
 */
function coverageOf(answer: string, questions: readonly string[]): number {
  if (questions.length === 0) return 1;
  const tokens = new Set(tokenize(answer));
  let hit = 0;
  for (const q of questions) {
    const qt = tokenize(q);
    if (qt.length === 0) { hit += 1; continue; }
    if (qt.filter((t) => tokens.has(t)).length / qt.length >= 0.34) hit += 1;
  }
  return Number((hit / questions.length).toFixed(3));
}

/** Tarif indicatif (gpt-5.6-luna). Sert au plafonnement, pas à la facturation. */
const USD_PER_1K_INPUT = 0.00015;
const USD_PER_1K_OUTPUT = 0.0006;

export interface ShadowInput {
  readonly requestId: string;
  readonly message: string;
  readonly history: readonly ConversationTurn[];
  readonly memory?: ConversationMemory;
  readonly viewer: ParrainViewerContext;
  readonly candidates: readonly ParrainKnowledgeChunk[];
  readonly serverCountry: string | null;
  readonly at: string;
  readonly apiKey: string | null;
  /** Réponse RÉELLEMENT montrée à l'utilisateur — lue, jamais modifiée. */
  readonly legacyAnswer: string;
  readonly legacySource: string;
  readonly legacyHonesty: string;
  readonly legacyHasCta: boolean;
}

export interface ShadowOutcome {
  readonly comparison: ShadowComparison;
  /** Résultat complet, réservé à l'archivage local de campagne. Jamais renvoyé au client. */
  readonly result: RuntimeResult | null;
}

function skipped(input: ShadowInput, reason: string, startedAt: number): ShadowOutcome {
  const cfg = loadC19ModelConfig();
  return {
    comparison: {
      models: { understand: cfg.understandModel, compose: cfg.composeModel },
      modelCalls: 0,
      requestId: input.requestId, viewerMode: input.viewer.mode, ran: false, skippedReason: reason,
      understanding: null, retrieval: null, plan: null, toolsProposedNotExecuted: [], verifier: null,
      legacy: { chars: input.legacyAnswer.length, source: input.legacySource, honesty: input.legacyHonesty, hasCta: input.legacyHasCta },
      shadow: null, delta: null,
      latencyMs: Date.now() - startedAt, tokens: { input: 0, output: 0 }, estimatedCostUsd: 0,
      budget: shadowBudgetSnapshot(), error: null,
    },
    result: null,
  };
}

/**
 * Exécute le shadow. Ne lève jamais. Ne modifie jamais la réponse affichée.
 * Le contexte lecture seule garantit `toolsEnabled: false` : le runtime refuse alors
 * tout outil avec `tools_disabled`, ce qui apparaît dans `toolsProposedNotExecuted`.
 */
export async function runShadowComparison(input: ShadowInput): Promise<ShadowOutcome> {
  const startedAt = Date.now();
  const ctx: ShadowContext = createShadowContext(input.requestId);

  if (!input.apiKey) return skipped(input, "no_api_key", startedAt);
  const budget = sharedBudget();
  if (budgetExhausted(budget)) return skipped(input, "shadow_token_budget_exhausted", startedAt);

  const before = { i: budget.spentInput, o: budget.spentOutput };
  const cfg = loadC19ModelConfig();

  try {
    const port = createOpenAIC19Port(input.apiKey, cfg, budget);
    const timeoutMs = readShadowTimeoutMs();

    const result = await Promise.race([
      runCloneChatIntelligence(port, {
        turnId: input.requestId,
        message: input.message,
        history: input.history,
        memory: input.memory ?? EMPTY_MEMORY,
        viewer: input.viewer,
        candidates: input.candidates,
        serverCountry: input.serverCountry,
        at: input.at,
        // `ctx.toolsEnabled` est le type littéral `false` : le shadow ne peut pas exécuter d'outil.
        mode: ctx.toolsEnabled ? "on" : "shadow",
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    const tokensIn = budget.spentInput - before.i;
    const tokensOut = budget.spentOutput - before.o;

    if (!result) {
      const s = skipped(input, "shadow_timeout", startedAt);
      return {
        ...s,
        comparison: { ...s.comparison, tokens: { input: tokensIn, output: tokensOut }, budget: shadowBudgetSnapshot() },
      };
    }

    const understandStage = result.trace.stages.find((s) => s.stage === "understand");
    const retrieveStage = result.trace.stages.find((s) => s.stage === "retrieve");
    const reasonStage = result.trace.stages.find((s) => s.stage === "reason");
    const questions = result.diagnostics.coverageGoals;
    const questionList = result.diagnostics.coverageList ?? [];

    const legacyCoverage = coverageOf(input.legacyAnswer, questionList);
    const shadowCoverage = coverageOf(result.answer, questionList);

    return {
      comparison: {
        requestId: input.requestId,
        viewerMode: input.viewer.mode,
        ran: true,
        skippedReason: null,
        understanding: {
          primaryGoal: result.diagnostics.primaryGoal,
          secondaryGoals: result.diagnostics.secondaryGoals,
          questionsDetected: questions,
          knowledgeNeeds: result.diagnostics.knowledgeNeeds,
          requiresClarification: Boolean(reasonStage?.detail.shouldClarify),
          dependsOnHistory: Boolean(understandStage?.detail.dependsOnHistory),
          isCorrection: result.diagnostics.isCorrection,
          outOfScope: Boolean(understandStage?.detail.outOfScope),
          confidence: Number(understandStage?.detail.confidence ?? 0),
        },
        retrieval: {
          sufficiency: String(retrieveStage?.detail.sufficiency ?? "n/a"),
          selected: Number(retrieveStage?.detail.selected ?? 0),
          chars: Number(retrieveStage?.detail.chars ?? 0),
        },
        plan: { goals: questions, shouldClarify: Boolean(reasonStage?.detail.shouldClarify) },
        toolsProposedNotExecuted: result.diagnostics.toolsRefused,
        verifier: { action: result.diagnostics.verifierAction, issues: result.diagnostics.issues },
        legacy: { chars: input.legacyAnswer.length, source: input.legacySource, honesty: input.legacyHonesty, hasCta: input.legacyHasCta },
        shadow: { chars: result.answer.length, status: result.status, citations: result.citations.length },
        delta: {
          legacyCoverage,
          shadowCoverage,
          // Un texte hérité identique à un autre tour est le marqueur du dictionnaire ; ici on
          // signale seulement qu'il est plus court que la question ne l'exigerait.
          legacyIsTemplate: legacyCoverage < shadowCoverage,
          bothIdentical: input.legacyAnswer.trim() === result.answer.trim(),
          shadowLongerBy: result.answer.length - input.legacyAnswer.length,
        },
        models: { understand: cfg.understandModel, compose: cfg.composeModel },
        modelCalls: result.trace.modelCalls,
        latencyMs: Date.now() - startedAt,
        tokens: { input: tokensIn, output: tokensOut },
        estimatedCostUsd: Number(((tokensIn / 1000) * USD_PER_1K_INPUT + (tokensOut / 1000) * USD_PER_1K_OUTPUT).toFixed(6)),
        budget: shadowBudgetSnapshot(),
        error: null,
      },
      result,
    };
  } catch (e) {
    const s = skipped(input, null as unknown as string, startedAt);
    return {
      ...s,
      comparison: { ...s.comparison, skippedReason: "shadow_error", error: String(e).slice(0, 160) },
    };
  }
}
