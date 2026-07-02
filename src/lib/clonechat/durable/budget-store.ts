// src/lib/clonechat/durable/budget-store.ts
// P9.4.1 — Budget DURABLE et ATOMIQUE (multi-instance). Remplace le Map par-processus :
// la réservation passe par une fonction Postgres qui verrouille les lignes de compteur
// (FOR UPDATE) et re-vérifie chaque plafond sous verrou ⇒ deux requêtes concurrentes,
// même sur deux instances, ne peuvent JAMAIS dépasser ensemble un plafond. Cycle :
//   RESERVE (worst-case) → appel OpenAI → COMMIT (réel) + release du surplus  |  RELEASE (échec).
// Survit au restart (les compteurs sont en base). Aucun montant interne renvoyé au client.

import type { ClonechatDb } from "./pg";
import type { CloneChatOpenAIConfig } from "../openai/config";
import type { BudgetDenyReason, UsageSnapshot } from "../openai/budget-gate";
import type { UsageRecord } from "../openai/usage-accounting";

export interface BudgetScope { readonly userId: string | null; readonly companyId: string | null; }

export interface BudgetReservation {
  readonly granted: boolean;
  readonly reason: BudgetDenyReason | null;
  readonly scopes: string[];
  readonly reservedTokens: number;
  readonly maxOutputTokens: number;
}

export interface DurableBudget {
  reserve(cfg: CloneChatOpenAIConfig, scope: BudgetScope, estimatedInputTokens: number, at: string): Promise<BudgetReservation>;
  commit(reservation: BudgetReservation, actualTokens: number): Promise<void>;
  release(reservation: BudgetReservation): Promise<void>;
  recordUsage(rec: UsageRecord): Promise<void>;
  snapshot(scope: BudgetScope, at: string): Promise<UsageSnapshot>;
}

const day = (iso: string) => iso.slice(0, 10);
const month = (iso: string) => iso.slice(0, 7);

/** Clés de scope + genres + plafonds pour un contexte donné. */
function scopePlan(cfg: CloneChatOpenAIConfig, scope: BudgetScope, at: string) {
  const d = day(at), m = month(at);
  const keys: string[] = [], kinds: string[] = [], caps: number[] = [];
  if (scope.userId) { keys.push(`u:${scope.userId}:${d}`); kinds.push("user_day"); caps.push(cfg.userDailyTokenCap); }
  if (scope.companyId) { keys.push(`c:${scope.companyId}:${d}`); kinds.push("company_day"); caps.push(cfg.companyDailyTokenCap); }
  keys.push(`g:day:${d}`); kinds.push("global_day"); caps.push(cfg.globalDailyTokenCap);
  keys.push(`g:month:${m}`); kinds.push("global_month"); caps.push(cfg.globalMonthlyTokenCap);
  return { keys, kinds, caps };
}

export function createDurableBudget(db: ClonechatDb): DurableBudget {
  return {
    async reserve(cfg, scope, estimatedInputTokens, at) {
      if (estimatedInputTokens > cfg.maxInputTokens) {
        return { granted: false, reason: "request_too_large", scopes: [], reservedTokens: 0, maxOutputTokens: 0 };
      }
      const worstCase = estimatedInputTokens + cfg.maxOutputTokens;
      const { keys, kinds, caps } = scopePlan(cfg, scope, at);
      return db.withInternal(async (q) => {
        const r = await q.query<{ ok: boolean }>(
          "select clonechat_budget_try_reserve($1::text[],$2::text[],$3::bigint[],$4::bigint) as ok",
          [keys, kinds, caps, worstCase],
        );
        if (r.rows[0]?.ok === true) {
          return { granted: true, reason: null, scopes: keys, reservedTokens: worstCase, maxOutputTokens: cfg.maxOutputTokens };
        }
        // Déterminer le plafond réellement dépassé (pour un message honnête).
        const reason = await firstExceeded(q, keys, kinds, caps, worstCase);
        return { granted: false, reason, scopes: keys, reservedTokens: 0, maxOutputTokens: 0 };
      });
    },
    async commit(reservation, actualTokens) {
      if (!reservation.granted || reservation.scopes.length === 0) return;
      await db.withInternal(async (q) => {
        await q.query("select clonechat_budget_commit($1::text[],$2::bigint,$3::bigint)", [reservation.scopes, reservation.reservedTokens, Math.max(0, actualTokens)]);
      });
    },
    async release(reservation) {
      if (!reservation.granted || reservation.scopes.length === 0) return;
      await db.withInternal(async (q) => {
        await q.query("select clonechat_budget_release($1::text[],$2::bigint)", [reservation.scopes, reservation.reservedTokens]);
      });
    },
    async recordUsage(rec) {
      await db.withInternal(async (q) => {
        await q.query(
          `insert into clonechat_usage_events (company_id, user_id, model, input_tokens, output_tokens, cached_tokens, kind, at)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [rec.companyId, rec.userId, rec.model, rec.inputTokens, rec.outputTokens, rec.cachedInputTokens, rec.imageCount > 0 ? "vision" : "chat", rec.at],
        );
      });
    },
    async snapshot(scope, at) {
      const { keys } = scopePlan({ userDailyTokenCap: 0, companyDailyTokenCap: 0, globalDailyTokenCap: 0, globalMonthlyTokenCap: 0 } as CloneChatOpenAIConfig, scope, at);
      return db.withInternal(async (q) => {
        const r = await q.query<{ scope_key: string; committed_tokens: string }>(
          "select scope_key, committed_tokens from clonechat_budget_counters where scope_key = any($1::text[])",
          [keys],
        );
        const by = new Map(r.rows.map((x) => [x.scope_key, Number(x.committed_tokens)]));
        return {
          userDailyTokens: scope.userId ? by.get(`u:${scope.userId}:${day(at)}`) ?? 0 : 0,
          companyDailyTokens: scope.companyId ? by.get(`c:${scope.companyId}:${day(at)}`) ?? 0 : 0,
          globalDailyTokens: by.get(`g:day:${day(at)}`) ?? 0,
          globalMonthlyTokens: by.get(`g:month:${month(at)}`) ?? 0,
        };
      });
    },
  };
}

async function firstExceeded(q: { query<T>(t: string, p?: readonly unknown[]): Promise<{ rows: T[] }> }, keys: string[], kinds: string[], caps: number[], worstCase: number): Promise<BudgetDenyReason> {
  const r = await q.query<{ scope_key: string; used: string }>(
    "select scope_key, (committed_tokens + reserved_tokens) as used from clonechat_budget_counters where scope_key = any($1::text[])",
    [keys],
  );
  const by = new Map(r.rows.map((x) => [x.scope_key, Number(x.used)]));
  const KIND_TO_REASON: Record<string, BudgetDenyReason> = {
    user_day: "user_daily", company_day: "company_daily", global_day: "global_daily", global_month: "global_monthly",
  };
  for (let i = 0; i < keys.length; i++) {
    if ((by.get(keys[i]) ?? 0) + worstCase > caps[i]) return KIND_TO_REASON[kinds[i]] ?? "global_daily";
  }
  return "global_daily";
}
