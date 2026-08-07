// src/lib/clonechat/hardening/timeout.ts
//
// Bornage temporel + annulation + retry BORNÉ. Toute dépendance externe potentielle passe par ici :
// timeout dur, AbortSignal (chaîné à un éventuel signal parent), retry explicitement limité (jamais de
// boucle infinie), et JAMAIS de duplication d'effet externe au retry (le retry n'est autorisé que pour
// une opération déclarée idempotente/relançable en toute sûreté). Déterministe : le sleep est injecté
// (no-op dans les tests), le temps n'est jamais lu implicitement.

import { HardeningError } from "./errors";

export type SleepFn = (ms: number) => Promise<void>;
const realSleep: SleepFn = (ms) => new Promise((r) => setTimeout(r, ms));

export interface TimeoutOptions {
  readonly parentSignal?: AbortSignal | null;
  /** Injecté dans les tests pour éviter un vrai timer ; défaut = setTimeout réel. */
  readonly schedule?: (cb: () => void, ms: number) => { clear: () => void };
}

function defaultSchedule(cb: () => void, ms: number): { clear: () => void } {
  const t = setTimeout(cb, ms);
  return { clear: () => clearTimeout(t) };
}

/**
 * Exécute `fn(signal)` avec un timeout DUR de `ms`. Au dépassement, avorte le signal (annulation
 * coopérative) et rejette avec HardeningError("timeout"). Si le signal parent est déjà/annulé →
 * HardeningError("cancelled"). L'opération sous-jacente reçoit un AbortSignal : une dépendance qui le
 * supporte cesse tout travail (aucun travail incontrôlé ne continue quand il peut être annulé).
 */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number, opts: TimeoutOptions = {}): Promise<T> {
  const schedule = opts.schedule ?? defaultSchedule;
  const controller = new AbortController();
  const parent = opts.parentSignal ?? null;
  if (parent?.aborted) throw new HardeningError("cancelled", "parent already aborted");

  let timedOut = false;
  const onParentAbort = () => controller.abort();
  if (parent) parent.addEventListener("abort", onParentAbort, { once: true });
  const timer = schedule(() => { timedOut = true; controller.abort(); }, ms);

  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise<never>((_, reject) => {
        const rejectAbort = () => reject(timedOut ? new HardeningError("timeout", "deadline exceeded") : new HardeningError("cancelled", "aborted"));
        // Le signal peut être DÉJÀ avorté (ex. schedule immédiat injecté en test) : addEventListener
        // ne rejouerait pas 'abort'. On rejette alors tout de suite.
        if (controller.signal.aborted) { rejectAbort(); return; }
        controller.signal.addEventListener("abort", rejectAbort, { once: true });
      }),
    ]);
  } finally {
    timer.clear();
    if (parent) parent.removeEventListener("abort", onParentAbort);
  }
}

export interface RetryOptions {
  readonly maxRetries: number; // borne DURE (>= 0)
  readonly baseDelayMs: number;
  /** Retry autorisé UNIQUEMENT si vrai pour l'erreur ET si l'opération est idempotente. */
  readonly isRetryable: (err: unknown) => boolean;
  /**
   * L'opération est-elle sûre à relancer sans dupliquer un effet externe ? Défaut: false (fail-closed :
   * on ne relance jamais une opération à effet potentiellement dupliqué).
   */
  readonly idempotent?: boolean;
  readonly sleep?: SleepFn;
  readonly onRetry?: (attempt: number, err: unknown) => void;
}

/**
 * Exécute `fn` avec au plus `maxRetries` relances. Aucune relance si l'opération n'est pas idempotente.
 * Aucune boucle infinie : le nombre total de tentatives est `maxRetries + 1`, borné. La dernière erreur
 * est propagée telle quelle (le collecteur appelant la mappe en SafeError).
 */
export async function withBoundedRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? realSleep;
  const maxRetries = Math.max(0, Math.floor(opts.maxRetries));
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < maxRetries && opts.idempotent === true && opts.isRetryable(err);
      if (!canRetry) break;
      opts.onRetry?.(attempt + 1, err);
      await sleep(opts.baseDelayMs * (attempt + 1));
    }
  }
  throw lastErr;
}
