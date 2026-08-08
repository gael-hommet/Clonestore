// src/lib/clonechat/hardening/provider-guard.ts
//
// Enveloppe d'appel provider RÉELLE : circuit breaker (par provider) → timeout borné + AbortSignal →
// retry BORNÉ (uniquement idempotent/safe, jamais un effet dupliqué). Un circuit ouvert refuse vite
// (`circuit_open`) SANS appeler le provider — l'appelant renvoie un fallback sûr, jamais une réponse
// inventée. Aucune exception brute ne fuit : l'appelant mappe l'erreur en SafeError.

import { withTimeout, withBoundedRetry, type SleepFn } from "./timeout";
import type { CircuitBreaker } from "./circuit-breaker";

export interface ProviderGuardOptions {
  readonly breaker?: CircuitBreaker;        // isolé par provider ; absent → pas de circuit (tests unitaires)
  readonly timeoutMs: number;
  readonly parentSignal?: AbortSignal | null;
  readonly retry?: { readonly maxRetries: number; readonly baseDelayMs: number; readonly isRetryable: (e: unknown) => boolean; readonly idempotent: boolean; readonly sleep?: SleepFn };
  readonly schedule?: (cb: () => void, ms: number) => { clear: () => void };
}

/** Exécute `fn(signal)` sous circuit + timeout (+ retry borné optionnel). Le signal transmis à `fn`
 *  s'annule au timeout OU à l'abort parent : un provider qui le supporte cesse tout travail. */
export async function guardProviderCall<T>(fn: (signal: AbortSignal) => Promise<T>, opts: ProviderGuardOptions): Promise<T> {
  const once = () => {
    const call = () => withTimeout((sig) => fn(sig), opts.timeoutMs, { parentSignal: opts.parentSignal ?? null, schedule: opts.schedule });
    return opts.breaker ? opts.breaker.exec(call) : call();
  };
  if (opts.retry) {
    return withBoundedRetry(() => once(), {
      maxRetries: opts.retry.maxRetries, baseDelayMs: opts.retry.baseDelayMs,
      isRetryable: opts.retry.isRetryable, idempotent: opts.retry.idempotent, sleep: opts.retry.sleep,
    });
  }
  return once();
}
