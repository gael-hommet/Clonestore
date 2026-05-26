// src/lib/cloneos/channels/email-production/rate-limit.ts
// B39 — In-memory rate limiting for email sends.
// Resets on process restart (no Supabase dependency for npm test / npm run build).
// Per-company and per-user counters, hourly and daily windows.

import type { EmailRateLimitPolicy } from "./types";

// ── In-memory store ───────────────────────────────────────────────────────────

type Counter = { count: number; window_start: number };

const companyHourly = new Map<string, Counter>();
const companyDaily  = new Map<string, Counter>();
const userHourly    = new Map<string, Counter>();
const userDaily     = new Map<string, Counter>();

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * 60 * 60 * 1000;

function getOrCreate(map: Map<string, Counter>, key: string, windowMs: number): Counter {
  const now = Date.now();
  const existing = map.get(key);
  if (!existing || now - existing.window_start >= windowMs) {
    const fresh: Counter = { count: 0, window_start: now };
    map.set(key, fresh);
    return fresh;
  }
  return existing;
}

function increment(map: Map<string, Counter>, key: string, windowMs: number): number {
  const counter = getOrCreate(map, key, windowMs);
  counter.count += 1;
  return counter.count;
}

function peek(map: Map<string, Counter>, key: string, windowMs: number): number {
  return getOrCreate(map, key, windowMs).count;
}

// ── Check (before send) ───────────────────────────────────────────────────────

export type RateLimitCheckResult = {
  ok: boolean;
  blocked_scope: "company_hourly" | "company_daily" | "user_hourly" | "user_daily" | null;
  blocked_reason: string | null;
};

export function checkRateLimit(
  companyId: string,
  userId: string | null,
  policy: EmailRateLimitPolicy,
): RateLimitCheckResult {
  const coH = peek(companyHourly, companyId, HOUR_MS);
  if (coH >= policy.max_hourly_per_company) {
    return {
      ok: false,
      blocked_scope: "company_hourly",
      blocked_reason: `Limite horaire entreprise atteinte : ${coH}/${policy.max_hourly_per_company}`,
    };
  }

  const coD = peek(companyDaily, companyId, DAY_MS);
  if (coD >= policy.max_daily_per_company) {
    return {
      ok: false,
      blocked_scope: "company_daily",
      blocked_reason: `Limite journalière entreprise atteinte : ${coD}/${policy.max_daily_per_company}`,
    };
  }

  if (userId) {
    const uH = peek(userHourly, userId, HOUR_MS);
    if (uH >= policy.max_hourly_per_user) {
      return {
        ok: false,
        blocked_scope: "user_hourly",
        blocked_reason: `Limite horaire utilisateur atteinte : ${uH}/${policy.max_hourly_per_user}`,
      };
    }

    const uD = peek(userDaily, userId, DAY_MS);
    if (uD >= policy.max_daily_per_user) {
      return {
        ok: false,
        blocked_scope: "user_daily",
        blocked_reason: `Limite journalière utilisateur atteinte : ${uD}/${policy.max_daily_per_user}`,
      };
    }
  }

  return { ok: true, blocked_scope: null, blocked_reason: null };
}

// ── Record (after successful send) ───────────────────────────────────────────

export function recordEmailSent(companyId: string, userId: string | null): void {
  increment(companyHourly, companyId, HOUR_MS);
  increment(companyDaily, companyId, DAY_MS);
  if (userId) {
    increment(userHourly, userId, HOUR_MS);
    increment(userDaily, userId, DAY_MS);
  }
}

// ── Peek current counters (for tests / monitoring) ────────────────────────────

export function getRateLimitCounters(companyId: string, userId: string | null) {
  return {
    company_hourly: peek(companyHourly, companyId, HOUR_MS),
    company_daily:  peek(companyDaily, companyId, DAY_MS),
    user_hourly:    userId ? peek(userHourly, userId, HOUR_MS) : 0,
    user_daily:     userId ? peek(userDaily, userId, DAY_MS) : 0,
  };
}

// ── Reset (for tests only) ────────────────────────────────────────────────────

export function resetRateLimitCounters(): void {
  companyHourly.clear();
  companyDaily.clear();
  userHourly.clear();
  userDaily.clear();
}
