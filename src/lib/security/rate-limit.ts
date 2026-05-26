// src/lib/security/rate-limit.ts
// B41 — In-memory rate limiter. No Redis required. Not for production at scale.
// For production scale: swap with Upstash/Redis adapter behind the same interface.

export type RateLimitScope =
  | "user_per_minute"
  | "user_per_hour"
  | "route_per_minute"
  | "company_per_hour"
  | "global_per_minute";

export type RateLimitConfig = {
  scope: RateLimitScope;
  max_requests: number;
  window_ms: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset_at: number;
  scope: RateLimitScope;
};

type RateLimitEntry = {
  count: number;
  window_start: number;
};

export type InMemoryRateLimiter = {
  buckets: Map<string, RateLimitEntry>;
  configs: Map<RateLimitScope, RateLimitConfig>;
};

// ── Default configs ───────────────────────────────────────────────────────────

const DEFAULT_CONFIGS: RateLimitConfig[] = [
  { scope: "user_per_minute", max_requests: 60, window_ms: 60_000 },
  { scope: "user_per_hour", max_requests: 1_000, window_ms: 3_600_000 },
  { scope: "route_per_minute", max_requests: 120, window_ms: 60_000 },
  { scope: "company_per_hour", max_requests: 5_000, window_ms: 3_600_000 },
  { scope: "global_per_minute", max_requests: 10_000, window_ms: 60_000 },
];

// ── Factory ───────────────────────────────────────────────────────────────────

export function createInMemorySecurityRateLimiter(
  customConfigs?: Partial<Record<RateLimitScope, Partial<RateLimitConfig>>>,
): InMemoryRateLimiter {
  const configs = new Map<RateLimitScope, RateLimitConfig>();
  for (const cfg of DEFAULT_CONFIGS) {
    const override = customConfigs?.[cfg.scope];
    configs.set(cfg.scope, { ...cfg, ...override });
  }
  return { buckets: new Map(), configs };
}

// ── Check ─────────────────────────────────────────────────────────────────────

export function checkSecurityRateLimit(
  limiter: InMemoryRateLimiter,
  scope: RateLimitScope,
  key: string,
  now = Date.now(),
): RateLimitResult {
  const config = limiter.configs.get(scope);
  if (!config) {
    return { allowed: true, remaining: 999, reset_at: now + 60_000, scope };
  }

  const bucketKey = `${scope}:${key}`;
  let entry = limiter.buckets.get(bucketKey);

  if (!entry || now - entry.window_start >= config.window_ms) {
    entry = { count: 0, window_start: now };
    limiter.buckets.set(bucketKey, entry);
  }

  const allowed = entry.count < config.max_requests;
  const remaining = Math.max(0, config.max_requests - entry.count - (allowed ? 1 : 0));
  const reset_at = entry.window_start + config.window_ms;

  return { allowed, remaining, reset_at, scope };
}

export function recordSecurityRequest(
  limiter: InMemoryRateLimiter,
  scope: RateLimitScope,
  key: string,
  now = Date.now(),
): void {
  const config = limiter.configs.get(scope);
  if (!config) return;

  const bucketKey = `${scope}:${key}`;
  let entry = limiter.buckets.get(bucketKey);

  if (!entry || now - entry.window_start >= config.window_ms) {
    entry = { count: 0, window_start: now };
    limiter.buckets.set(bucketKey, entry);
  }

  entry.count++;
}

// ── Composite check (user + route) ────────────────────────────────────────────

export function checkAndRecordRateLimit(
  limiter: InMemoryRateLimiter,
  params: {
    user_id?: string;
    company_id?: string;
    route_id?: string;
    now?: number;
  },
): RateLimitResult {
  const now = params.now ?? Date.now();
  const checks: Array<{ scope: RateLimitScope; key: string }> = [];

  if (params.user_id) {
    checks.push({ scope: "user_per_minute", key: params.user_id });
    checks.push({ scope: "user_per_hour", key: params.user_id });
  }
  if (params.route_id && params.user_id) {
    checks.push({ scope: "route_per_minute", key: `${params.route_id}:${params.user_id}` });
  }
  if (params.company_id) {
    checks.push({ scope: "company_per_hour", key: params.company_id });
  }

  for (const { scope, key } of checks) {
    const result = checkSecurityRateLimit(limiter, scope, key, now);
    if (!result.allowed) return result;
  }

  // Record all
  for (const { scope, key } of checks) {
    recordSecurityRequest(limiter, scope, key, now);
  }

  return { allowed: true, remaining: 999, reset_at: now + 60_000, scope: "user_per_minute" };
}
