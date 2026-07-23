// C1.9 — PORT MODÈLE RÉEL.
//
// Seul endroit où la couche C1.9 touche un provider. Le SDK est importé dynamiquement
// (comme le client existant) pour qu'il n'entre jamais dans le bundle client.
//
// La clé reste SERVEUR. Aucun secret n'est journalisé. Le port est injecté dans la
// pipeline : tous les tests structurels tournent sans lui.
import type { C19ModelPort } from "./understanding";

export interface C19ModelConfig {
  /** Modèle pour la compréhension — tâche courte et structurée. */
  readonly understandModel: string;
  /** Modèle pour la composition — tâche de rédaction et de raisonnement. */
  readonly composeModel: string;
  /**
   * Plafond DUR de tokens de sortie. Il borne, il ne dicte pas : chaque étape demande ce
   * dont elle a besoin. Fixé au-dessus du besoin de la compréhension (1 500) car un objet
   * tronqué est indistinguable d'un objet invalide et coûte un tour entier.
   *
   * Relevé de 1 600 à 3 000 après un défaut de MESURE : quatre verdicts de juge sur
   * trente-sept sont revenus tronqués avant la fin du JSON. Le budget de sortie d'un
   * modèle à raisonnement couvre AUSSI ses jetons de raisonnement — plus l'entrée est
   * riche (ici, la liste des faits fournis), plus il en consomme avant d'écrire. Le
   * plafond ne coûte rien tant qu'il n'est pas atteint ; une réponse coupée, elle,
   * invalide la mesure entière.
   */
  readonly maxOutputTokens: number;
}

export const C19_DEFAULT_CONFIG: C19ModelConfig = Object.freeze({
  understandModel: "gpt-5.6-luna",
  composeModel: "gpt-5.6-luna",
  maxOutputTokens: 3000,
});

export function loadC19ModelConfig(env: NodeJS.ProcessEnv = process.env): C19ModelConfig {
  return Object.freeze({
    understandModel: env.CLONECHAT_C19_UNDERSTAND_MODEL?.trim() || C19_DEFAULT_CONFIG.understandModel,
    composeModel: env.CLONECHAT_C19_COMPOSE_MODEL?.trim() || C19_DEFAULT_CONFIG.composeModel,
    maxOutputTokens: C19_DEFAULT_CONFIG.maxOutputTokens,
  });
}

/**
 * Compteur de dépense partagé par un lot d'appels. Sert de plafond DUR pour une campagne
 * ou une session : au-delà, le port refuse au lieu de continuer à facturer.
 */
export interface TokenBudget {
  spentInput: number;
  spentOutput: number;
  readonly maxTotalTokens: number;
}

export function createTokenBudget(maxTotalTokens: number): TokenBudget {
  return { spentInput: 0, spentOutput: 0, maxTotalTokens };
}

export function budgetExhausted(b: TokenBudget): boolean {
  return b.spentInput + b.spentOutput >= b.maxTotalTokens;
}

/**
 * Statuts qui décrivent une indisponibilité PASSAGÈRE : la même requête, refaite un peu
 * plus tard, a de bonnes chances d'aboutir. Un 400 ou un 401, non.
 */
const TRANSIENT_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

/**
 * Nombre total de tentatives, attente de base et plafond.
 *
 * Mesuré : une campagne de 47 cas a rendu SEIZE verdicts invalides d'affilée, tous en
 * `openai_http_429`. Le port n'avait aucune reprise, et la seule relance du banc repartait
 * dans l'instant — donc dans la même fenêtre de limitation. Une limitation de débit n'est
 * pas une panne de fournisseur : c'est une invitation à attendre. Sans attente, elle
 * détruit un tiers de la mesure et se déguise en défaut produit.
 */
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 20_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Attente exponentielle avec dispersion, bornée. Honore `Retry-After` s'il est fourni. */
function backoffDelay(attempt: number, err: unknown): number {
  const headers = (err as { headers?: Record<string, string> }).headers;
  const retryAfter = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_DELAY_MS);
  }
  const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  // Dispersion : plusieurs appels limités en même temps ne doivent pas repartir ensemble.
  return exponential + Math.floor(Math.random() * 500);
}

export function createOpenAIC19Port(
  apiKey: string,
  config: C19ModelConfig = C19_DEFAULT_CONFIG,
  budget?: TokenBudget,
): C19ModelPort {
  return {
    async complete(req) {
      if (budget && budgetExhausted(budget)) {
        return { ok: false, text: null, usage: null, error: "budget_exhausted" };
      }
      const model = req.purpose === "understand" ? config.understandModel : config.composeModel;
      let lastError = "openai_error";

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const { default: OpenAI } = await import("openai");
          const client = new OpenAI({ apiKey });
          const input = [
            { role: "system" as const, content: req.system },
            ...(req.history ?? []).map((h) => ({ role: h.role, content: h.text })),
            { role: "user" as const, content: req.userText },
          ];
          const res = await client.responses.create({
            model,
            max_output_tokens: Math.min(req.maxOutputTokens, config.maxOutputTokens),
            input,
            text: { format: { type: "json_object" } },
          } as unknown as Parameters<typeof client.responses.create>[0]);

          const r = res as unknown as {
            output_text?: string;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          const text = typeof r.output_text === "string" ? r.output_text : null;
          const usage = {
            inputTokens: r.usage?.input_tokens ?? 0,
            outputTokens: r.usage?.output_tokens ?? 0,
            model,
          };
          if (budget) { budget.spentInput += usage.inputTokens; budget.spentOutput += usage.outputTokens; }
          if (!text) return { ok: false, text: null, usage, error: "empty_output" };
          return { ok: true, text, usage, error: null };
        } catch (e) {
          const status = (e as { status?: number }).status;
          lastError = typeof status === "number" ? `openai_http_${status}` : "openai_error";
          const transient = typeof status === "number"
            ? TRANSIENT_STATUSES.has(status)
            : true; // panne réseau sans statut : passagère jusqu'à preuve du contraire
          if (!transient || attempt === MAX_ATTEMPTS) break;
          // Le budget peut s'épuiser pendant l'attente : on ne relance pas dans le vide.
          if (budget && budgetExhausted(budget)) {
            return { ok: false, text: null, usage: null, error: "budget_exhausted" };
          }
          await sleep(backoffDelay(attempt, e));
        }
      }
      return { ok: false, text: null, usage: null, error: lastError };
    },
  };
}
