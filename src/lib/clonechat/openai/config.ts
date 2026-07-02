// src/lib/clonechat/openai/config.ts
// P9.4 — Configuration OpenAI CloneChat (SERVEUR uniquement). La clé n'est JAMAIS
// exposée au client, jamais dans NEXT_PUBLIC_*, jamais loggée, jamais dans les preuves.
// Le routage de modèle et les budgets sont configurables par variables d'environnement.

/** Modèle par défaut : le multimodal le moins cher suffisant. Configurable. */
export const DEFAULT_MODEL = "gpt-4o-mini";

export interface CloneChatOpenAIConfig {
  readonly enabled: boolean;          // OpenAI activé ET clé présente ET flag CloneChat on
  readonly model: string;             // modèle par défaut (bon marché)
  readonly escalationModel: string | null; // modèle plus fort — désactivé par défaut
  readonly escalationEnabled: boolean;      // escalade autorisée ? (défaut false)
  readonly maxInputTokens: number;    // borne dure par requête (entrée)
  readonly maxOutputTokens: number;   // borne dure par requête (sortie)
  readonly maxToolRounds: number;     // rondes d'outils max par tour
  readonly userDailyTokenCap: number;
  readonly companyDailyTokenCap: number;
  readonly globalDailyTokenCap: number;
  readonly globalMonthlyTokenCap: number;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (typeof raw !== "string") return fallback;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function flag(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "on" || v === "enabled";
}

/** Clé serveur (jamais renvoyée au client). Retourne null si absente. */
export function readOpenAIKey(): string | null {
  const k = process.env.OPENAI_API_KEY;
  return typeof k === "string" && k.trim().length > 20 ? k.trim() : null;
}

export function loadOpenAIConfig(): CloneChatOpenAIConfig {
  const hasKey = readOpenAIKey() !== null;
  return {
    enabled: hasKey, // le flag produit CloneChat est vérifié séparément côté route
    model: (process.env.CLONECHAT_OPENAI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    escalationModel: (process.env.CLONECHAT_OPENAI_ESCALATION_MODEL ?? "").trim() || null,
    escalationEnabled: flag("CLONECHAT_OPENAI_ESCALATION_ENABLED"),
    maxInputTokens: num("CLONECHAT_MAX_INPUT_TOKENS", 6000),
    maxOutputTokens: num("CLONECHAT_MAX_OUTPUT_TOKENS", 700),
    maxToolRounds: num("CLONECHAT_MAX_TOOL_ROUNDS", 2),
    userDailyTokenCap: num("CLONECHAT_USER_DAILY_TOKEN_CAP", 120_000),
    companyDailyTokenCap: num("CLONECHAT_COMPANY_DAILY_TOKEN_CAP", 600_000),
    globalDailyTokenCap: num("CLONECHAT_GLOBAL_DAILY_TOKEN_CAP", 4_000_000),
    globalMonthlyTokenCap: num("CLONECHAT_GLOBAL_MONTHLY_TOKEN_CAP", 60_000_000),
  };
}

/** Coût estimé (USD) par 1M tokens — table interne, jamais exposée au client normal. */
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const base = model.replace(/-\d{4}-\d{2}-\d{2}$/, ""); // retire un suffixe de date éventuel
  const p = PRICING[base] ?? PRICING[model] ?? PRICING[DEFAULT_MODEL];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}
