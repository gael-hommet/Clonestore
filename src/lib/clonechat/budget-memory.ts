// src/lib/clonechat/budget-memory.ts
// P9.4.1 — Adaptateur budget IN-MEMORY conforme à l'interface DurableBudget (repli sans
// DB, tests/dev). Corrige le défaut atomique de P9.4 même en mémoire : la réservation
// est calculée et appliquée de façon SYNCHRONE (avant tout await) → deux requêtes du même
// tick ne peuvent pas dépasser ensemble le plafond. Non durable / non multi-instance (une
// vraie DB durable est requise pour ces garanties — voir createDurableBudget).

import type { DurableBudget, BudgetReservation, BudgetScope } from "./durable/budget-store";
import type { CloneChatOpenAIConfig } from "./openai/config";
import type { BudgetDenyReason } from "./openai/budget-gate";
import type { UsageRecord } from "./openai/usage-accounting";

const day = (iso: string) => iso.slice(0, 10);
const month = (iso: string) => iso.slice(0, 7);

interface Counter { committed: number; reserved: number; kind: string; }

export function createInMemoryBudget(): DurableBudget & { usageEvents(): UsageRecord[] } {
  const counters = new Map<string, Counter>();
  const events: UsageRecord[] = [];

  function plan(cfg: CloneChatOpenAIConfig, scope: BudgetScope, at: string) {
    const d = day(at), m = month(at);
    const keys: string[] = [], kinds: string[] = [], caps: number[] = [];
    if (scope.userId) { keys.push(`u:${scope.userId}:${d}`); kinds.push("user_daily"); caps.push(cfg.userDailyTokenCap); }
    if (scope.companyId) { keys.push(`c:${scope.companyId}:${d}`); kinds.push("company_daily"); caps.push(cfg.companyDailyTokenCap); }
    keys.push(`g:day:${d}`); kinds.push("global_daily"); caps.push(cfg.globalDailyTokenCap);
    keys.push(`g:month:${m}`); kinds.push("global_monthly"); caps.push(cfg.globalMonthlyTokenCap);
    return { keys, kinds, caps };
  }

  return {
    usageEvents: () => [...events],
    async reserve(cfg, scope, estimatedInputTokens, at) {
      if (estimatedInputTokens > cfg.maxInputTokens) return { granted: false, reason: "request_too_large", scopes: [], reservedTokens: 0, maxOutputTokens: 0 };
      const worstCase = estimatedInputTokens + cfg.maxOutputTokens;
      const { keys, kinds, caps } = plan(cfg, scope, at);
      // SYNCHRONE : check + apply avant tout await → atomique dans le processus.
      for (let i = 0; i < keys.length; i++) {
        const c = counters.get(keys[i]) ?? { committed: 0, reserved: 0, kind: kinds[i] };
        if (c.committed + c.reserved + worstCase > caps[i]) {
          return { granted: false, reason: kinds[i] as BudgetDenyReason, scopes: keys, reservedTokens: 0, maxOutputTokens: 0 };
        }
      }
      for (const k of keys) { const c = counters.get(k) ?? { committed: 0, reserved: 0, kind: "" }; c.reserved += worstCase; counters.set(k, c); }
      return { granted: true, reason: null, scopes: keys, reservedTokens: worstCase, maxOutputTokens: cfg.maxOutputTokens };
    },
    async commit(reservation: BudgetReservation, actualTokens: number) {
      if (!reservation.granted) return;
      for (const k of reservation.scopes) { const c = counters.get(k); if (c) { c.reserved = Math.max(0, c.reserved - reservation.reservedTokens); c.committed += Math.max(0, actualTokens); } }
    },
    async release(reservation: BudgetReservation) {
      if (!reservation.granted) return;
      for (const k of reservation.scopes) { const c = counters.get(k); if (c) c.reserved = Math.max(0, c.reserved - reservation.reservedTokens); }
    },
    async recordUsage(rec: UsageRecord) { events.push(rec); },
    async snapshot(scope, at) {
      const d = day(at), m = month(at);
      const get = (k: string) => counters.get(k)?.committed ?? 0;
      return {
        userDailyTokens: scope.userId ? get(`u:${scope.userId}:${d}`) : 0,
        companyDailyTokens: scope.companyId ? get(`c:${scope.companyId}:${d}`) : 0,
        globalDailyTokens: get(`g:day:${d}`),
        globalMonthlyTokens: get(`g:month:${m}`),
      };
    },
  };
}
