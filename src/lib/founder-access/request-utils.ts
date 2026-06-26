// Phase E.2 — Founder Access : utilitaires de requête serveur (rate limit, IP hash).
// node:crypto + Map en mémoire (fallback dev) + limiteur DISTRIBUÉ Postgres (prod).

import { createHash } from "node:crypto";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";

const IP_SALT = process.env.CLONESTORE_IP_HASH_SALT ?? "clonestore-founder-ip-salt";

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(IP_SALT + "|" + ip, "utf8").digest("hex").slice(0, 32);
}

export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

// ── Rate limiter en mémoire (token bucket fenêtré) ─────────────────────────
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max = 8, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= max) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

export interface RateLimitResult { ok: boolean; retryAfter: number; count: number; limit: number }

/**
 * Rate limiting DISTRIBUÉ (§3.6) : compteur partagé en Postgres, fenêtre fixe,
 * incrément atomique via INSERT … ON CONFLICT. Fonctionne entre instances/serverless.
 * En cas d'indisponibilité DB, retombe sur le limiteur mémoire (fail-open borné).
 * La clé est hashée avant stockage — aucune IP brute persistée.
 */
export async function distributedRateLimit(
  db: SqlExecutor,
  rawKey: string,
  max = 8,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  const key = createHash("sha256").update(IP_SALT + "|rl|" + rawKey, "utf8").digest("hex").slice(0, 48);
  try {
    const { rows } = await db.query<{ count: number; retry_after: number }>(
      `insert into clonestore_rate_limits (bucket_key, count, window_ms, expires_at, updated_at)
         values ($1, 1, $2, now() + ($2 || ' milliseconds')::interval, now())
       on conflict (bucket_key) do update set
         count = case when clonestore_rate_limits.expires_at < now() then 1
                      else clonestore_rate_limits.count + 1 end,
         window_ms = excluded.window_ms,
         expires_at = case when clonestore_rate_limits.expires_at < now()
                           then now() + ($2 || ' milliseconds')::interval
                           else clonestore_rate_limits.expires_at end,
         updated_at = now()
       returning count, ceil(extract(epoch from (expires_at - now())))::int as retry_after`,
      [key, windowMs],
    );
    const count = Number(rows[0]?.count) || 1;
    const retryAfter = Math.max(0, Number(rows[0]?.retry_after) || 0);
    return { ok: count <= max, retryAfter: count <= max ? 0 : retryAfter, count, limit: max };
  } catch {
    const mem = rateLimit(rawKey, max, windowMs);
    return { ok: mem.ok, retryAfter: mem.retryAfter, count: mem.ok ? 1 : max + 1, limit: max };
  }
}

/** Purge opportuniste des compteurs expirés (appelée par le tick email/cron). */
export async function purgeExpiredRateLimits(db: SqlExecutor): Promise<number> {
  try {
    const { rows } = await db.query<{ n: number }>(
      "with d as (delete from clonestore_rate_limits where expires_at < now() - interval '1 hour' returning 1) select count(*)::int n from d",
    );
    return Number(rows[0]?.n) || 0;
  } catch {
    return 0;
  }
}

/** Borne défensive de taille de payload (octets) avant parsing. */
export const MAX_BODY_BYTES = 8 * 1024;

export async function readJsonBounded<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return null;
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    return null;
  }
}

export interface Tracking {
  source?: string | null;
  referrer?: string | null;
  landing_path?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  anonymous_session_id?: string | null;
}

const trk = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 200);
  return s || null;
};

export function extractTracking(body: Record<string, unknown>): Tracking {
  return {
    source: trk(body.source),
    referrer: trk(body.referrer),
    landing_path: trk(body.landing_path),
    utm_source: trk(body.utm_source),
    utm_medium: trk(body.utm_medium),
    utm_campaign: trk(body.utm_campaign),
    utm_content: trk(body.utm_content),
    utm_term: trk(body.utm_term),
    anonymous_session_id: trk(body.anonymous_session_id),
  };
}
