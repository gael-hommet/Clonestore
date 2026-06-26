// Coûts IA pour le Founder Command Center — REUTILISE le ledger gouverné existant
// (src/lib/cloneos/ai/cost-ledger). Aucune nouvelle source : on agrège les vrais
// événements d'usage IA (provider/modèle/tokens/coût), jamais les prompts ni les réponses.
// L'état de la source est dérivé d'une VRAIE agrégation exécutée contre le ledger.

import { getAiCostLedger } from "@/lib/cloneos/ai/cost-ledger/runtime";
import { getAiCostLedgerConfig } from "@/lib/cloneos/ai/cost-ledger/config";
import type { AiCostLedgerEvent } from "@/lib/cloneos/ai/cost-ledger/types";

export type SourceHealthLite = {
  state: "connected" | "degraded" | "misconfigured" | "unavailable" | "not_configured";
  detail: string;
};

export interface FounderAiCostSummary {
  provider_mode: "memory" | "supabase";
  currency: string;          // coûts en cents de cette devise (USD côté ledger)
  cost_today_cents: number;
  cost_7d_cents: number;
  cost_30d_cents: number;
  calls_30d: number;
  top_provider: string | null;
  top_model: string | null;
}

function startOfTodayUtcIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function topOf(events: AiCostLedgerEvent[], field: "provider" | "model"): string | null {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e[field], (counts.get(e[field]) ?? 0) + 1);
  let best: string | null = null;
  let max = -1;
  for (const [k, n] of counts) if (n > max) { max = n; best = k; }
  return best;
}

const costOf = (s: { actual_cost_cents: number; estimated_cost_cents: number }) =>
  s.actual_cost_cents > 0 ? s.actual_cost_cents : s.estimated_cost_cents;

/**
 * Agrégation des coûts IA pour le cockpit. Renvoie null si le ledger est désactivé ou
 * inaccessible. N'expose aucun contenu sensible.
 */
export async function founderAiCostSummary(): Promise<FounderAiCostSummary | null> {
  const config = getAiCostLedgerConfig();
  if (config.provider === "disabled") return null;
  try {
    const ledger = getAiCostLedger();
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const [today, d7, d30, events] = await Promise.all([
      ledger.summarize({ from: startOfTodayUtcIso(), to: iso(now) }),
      ledger.summarize({ from: iso(now - 7 * 864e5), to: iso(now) }),
      ledger.summarize({ from: iso(now - 30 * 864e5), to: iso(now) }),
      ledger.listEvents({ from: iso(now - 30 * 864e5), to: iso(now), limit: 2000 }),
    ]);
    return {
      provider_mode: config.provider === "supabase" ? "supabase" : "memory",
      currency: "USD",
      cost_today_cents: costOf(today),
      cost_7d_cents: costOf(d7),
      cost_30d_cents: costOf(d30),
      calls_30d: d30.request_count,
      top_provider: topOf(events, "provider"),
      top_model: topOf(events, "model"),
    };
  } catch {
    return null;
  }
}

/** État RÉEL de la source « Coûts IA » : exécute une vraie agrégation contre le ledger. */
export async function aiCostHealth(): Promise<SourceHealthLite> {
  const config = getAiCostLedgerConfig();
  if (config.provider === "disabled") {
    return { state: "not_configured", detail: "Ledger IA désactivé (AI_COST_LEDGER_PROVIDER=disabled)" };
  }
  try {
    const ledger = getAiCostLedger();
    const summary = await ledger.summarize({
      from: new Date(Date.now() - 30 * 864e5).toISOString(),
      to: new Date().toISOString(),
    });
    const mode = config.provider === "supabase" ? "Supabase" : "mémoire (in-process)";
    return summary.request_count === 0
      ? { state: "connected", detail: `Ledger ${mode} accessible · aucune consommation enregistrée` }
      : { state: "connected", detail: `Ledger ${mode} · ${summary.request_count} appels / 30 j` };
  } catch {
    return { state: "unavailable", detail: "Ledger IA inaccessible (agrégation échouée)" };
  }
}
