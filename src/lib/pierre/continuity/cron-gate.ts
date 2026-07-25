// P21 — Continuity cron gate (pure, testable).
//
// Pierre's durable runtime scheduler (src/lib/pierre/v1/runtime-scheduler.ts) is code-complete —
// lease recovery, DB-native wait/wake, idempotent outbox drain — but nothing in the repo ever
// triggered it automatically, so "continuity" (wait → wake → verify → relance → resume → escalate)
// never actually ran without a manual poke. This gate lets a Vercel cron fire it safely.
//
// It is deliberately FAIL-CLOSED on two independent axes so enabling autonomous operation is an
// explicit, reversible owner decision — never a silent side effect of deploying this code:
//   1. an owner opt-in flag (PIERRE_CONTINUITY_CRON_ENABLED must be exactly "true"); and
//   2. a shared secret (Vercel's CRON_SECRET or the dedicated runtime system secret),
//      compared in constant time.
// Missing either → the tick is a no-op / refused. Nothing autonomous happens by default.

import { timingSafeEqual } from "crypto";

export type ContinuityCronEnv = Record<string, string | undefined>;

export type ContinuityCronDecision =
  | { action: "disabled"; reason: string }
  | { action: "unconfigured"; reason: string }
  | { action: "unauthorized"; reason: string }
  | { action: "run" };

function readEnv(env?: ContinuityCronEnv): ContinuityCronEnv {
  return env ?? (typeof process !== "undefined" ? process.env : {});
}

/** Owner opt-in: autonomous continuity only runs when explicitly turned on. */
export function isContinuityCronEnabled(env?: ContinuityCronEnv): boolean {
  return (readEnv(env).PIERRE_CONTINUITY_CRON_ENABLED ?? "").trim() === "true";
}

/** The accepted shared secrets (Vercel cron secret + dedicated runtime secret). Empty values ignored. */
export function continuityCronSecrets(env?: ContinuityCronEnv): string[] {
  const e = readEnv(env);
  return [e.CRON_SECRET, e.PIERRE_RUNTIME_SYSTEM_SECRET]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0);
}

function constantTimeEquals(provided: string, secret: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Extract the presented secret from an Authorization: Bearer header or x-cron-secret. */
export function presentedCronSecret(headers: {
  get(name: string): string | null;
}): string | null {
  const auth = headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return headers.get("x-cron-secret") ?? headers.get("x-pierre-system-secret");
}

/**
 * Full decision for an incoming continuity-cron request. Deterministic and total.
 * Order matters: disabled (opt-in off) is reported before auth so an operator can tell "off" from
 * "wrong secret". Every non-"run" outcome leaves the runtime completely untouched.
 */
export function decideContinuityCron(
  headers: { get(name: string): string | null },
  env?: ContinuityCronEnv,
): ContinuityCronDecision {
  if (!isContinuityCronEnabled(env)) {
    return {
      action: "disabled",
      reason: "PIERRE_CONTINUITY_CRON_ENABLED is not 'true' — autonomous continuity is off.",
    };
  }

  const secrets = continuityCronSecrets(env);
  if (secrets.length === 0) {
    return {
      action: "unconfigured",
      reason: "No CRON_SECRET / PIERRE_RUNTIME_SYSTEM_SECRET configured — refusing to run fail-open.",
    };
  }

  const provided = presentedCronSecret(headers);
  if (!provided) {
    return { action: "unauthorized", reason: "No cron secret presented." };
  }

  // Evaluate all secrets (no short-circuit) to avoid leaking which one matched via timing.
  const ok = secrets.reduce(
    (acc, s) => (constantTimeEquals(provided, s) ? true : acc),
    false,
  );
  if (!ok) return { action: "unauthorized", reason: "Cron secret mismatch." };

  return { action: "run" };
}
