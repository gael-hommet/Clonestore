// src/lib/clonechat/openai/budget-gate.ts
// P9.4 — Gardes de BUDGET durs AVANT tout appel OpenAI. Le coût est une contrainte
// produit (fonds limités). Aucune consommation en arrière-plan. Aucun appel si le
// budget est épuisé — repli déterministe. Pur (le compteur d'usage est injecté).

import type { CloneChatOpenAIConfig } from "./config";

/** Usage cumulé lu par le gate (fourni par un store — DB, mémoire, PGlite en test). */
export interface UsageSnapshot {
  readonly userDailyTokens: number;
  readonly companyDailyTokens: number;
  readonly globalDailyTokens: number;
  readonly globalMonthlyTokens: number;
}

export type BudgetDenyReason =
  | "user_daily" | "company_daily" | "global_daily" | "global_monthly"
  | "request_too_large";

export interface BudgetDecision {
  readonly allowed: boolean;
  readonly reason: BudgetDenyReason | null;
  /** Plafond de sortie effectif pour CETTE requête (jamais > config, jamais négatif). */
  readonly maxOutputTokens: number;
}

/**
 * Décide si un appel OpenAI est permis. `estimatedInputTokens` est une estimation
 * bornée de la requête. Refuse AVANT l'appel si un plafond serait dépassé.
 */
export function checkBudget(
  cfg: CloneChatOpenAIConfig,
  usage: UsageSnapshot,
  estimatedInputTokens: number,
): BudgetDecision {
  // 1) Requête individuelle trop grande → refus (jamais tronquer silencieusement).
  if (estimatedInputTokens > cfg.maxInputTokens) {
    return { allowed: false, reason: "request_too_large", maxOutputTokens: 0 };
  }
  // Coût potentiel maximal de la requête = entrée estimée + sortie max.
  const worstCase = estimatedInputTokens + cfg.maxOutputTokens;
  const checks: Array<[number, number, BudgetDenyReason]> = [
    [usage.userDailyTokens, cfg.userDailyTokenCap, "user_daily"],
    [usage.companyDailyTokens, cfg.companyDailyTokenCap, "company_daily"],
    [usage.globalDailyTokens, cfg.globalDailyTokenCap, "global_daily"],
    [usage.globalMonthlyTokens, cfg.globalMonthlyTokenCap, "global_monthly"],
  ];
  for (const [used, cap, reason] of checks) {
    if (used + worstCase > cap) {
      return { allowed: false, reason, maxOutputTokens: 0 };
    }
  }
  return { allowed: true, reason: null, maxOutputTokens: cfg.maxOutputTokens };
}

/** Message client honnête en cas d'épuisement (jamais de montant $ interne exposé). */
export function budgetFallbackMessage(reason: BudgetDenyReason): string {
  if (reason === "request_too_large") {
    return "Votre demande est trop longue pour être analysée d'un coup. Reformulez-la plus simplement — je peux quand même vous orienter et consulter votre espace.";
  }
  return "L'assistance avancée est momentanément indisponible pour préserver le service. Je reste disponible pour vous orienter, ouvrir vos missions, salariés et documents.";
}
