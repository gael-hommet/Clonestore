// src/lib/clonechat/openai/usage-accounting.ts
// P9.4 — Comptabilité d'usage OpenAI. Enregistre l'usage RÉEL renvoyé par OpenAI
// (modèle, tokens entrée/sortie, tokens cachés, coût estimé, images, rondes d'outils,
// raison d'escalade). Store injectable (DB/mémoire/PGlite). Aucun montant $ interne
// exposé au client normal.

import { estimateCostUsd } from "./config";
import type { OpenAIUsage } from "./client";
import type { UsageSnapshot } from "./budget-gate";

export interface UsageRecord {
  readonly at: string;
  readonly userId: string | null;
  readonly companyId: string | null;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
  readonly imageCount: number;
  readonly toolRounds: number;
  readonly escalationReason: string | null;
}

/** Store d'usage : lecture des cumuls (pour le gate) + écriture d'un enregistrement. */
export interface UsageStore {
  snapshot(scope: { userId: string | null; companyId: string | null }): Promise<UsageSnapshot>;
  record(rec: UsageRecord): Promise<void>;
}

export function buildUsageRecord(input: {
  usage: OpenAIUsage;
  userId: string | null;
  companyId: string | null;
  at: string;
  imageCount?: number;
  toolRounds?: number;
  escalationReason?: string | null;
}): UsageRecord {
  const total = input.usage.inputTokens + input.usage.outputTokens;
  return {
    at: input.at,
    userId: input.userId,
    companyId: input.companyId,
    model: input.usage.model,
    inputTokens: input.usage.inputTokens,
    outputTokens: input.usage.outputTokens,
    cachedInputTokens: input.usage.cachedInputTokens,
    totalTokens: total,
    estimatedCostUsd: estimateCostUsd(input.usage.model, input.usage.inputTokens, input.usage.outputTokens),
    imageCount: input.imageCount ?? 0,
    toolRounds: input.toolRounds ?? 0,
    escalationReason: input.escalationReason ?? null,
  };
}

/** Store en mémoire (par-processus) — utilisé en local/QA. En prod, brancher une DB. */
export function createInMemoryUsageStore(): UsageStore & { all(): UsageRecord[] } {
  const records: UsageRecord[] = [];
  const dayKey = (iso: string) => iso.slice(0, 10);
  const monthKey = (iso: string) => iso.slice(0, 7);
  return {
    all: () => [...records],
    async snapshot(scope) {
      // Le "today" est dérivé du dernier enregistrement (pas de Date.now ici — pur).
      const last = records[records.length - 1];
      const today = last ? dayKey(last.at) : "";
      const month = last ? monthKey(last.at) : "";
      let userDaily = 0, companyDaily = 0, globalDaily = 0, globalMonthly = 0;
      for (const r of records) {
        if (monthKey(r.at) === month) globalMonthly += r.totalTokens;
        if (dayKey(r.at) === today) {
          globalDaily += r.totalTokens;
          if (scope.userId && r.userId === scope.userId) userDaily += r.totalTokens;
          if (scope.companyId && r.companyId === scope.companyId) companyDaily += r.totalTokens;
        }
      }
      return { userDailyTokens: userDaily, companyDailyTokens: companyDaily, globalDailyTokens: globalDaily, globalMonthlyTokens: globalMonthly };
    },
    async record(rec) { records.push(rec); },
  };
}
