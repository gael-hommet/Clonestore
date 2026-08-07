// src/lib/clonechat/hardening/runtime.ts
//
// Orchestrateur du runtime durci. `guard()` applique le mode courant au chemin servi :
//   • kill switch (prioritaire) ou mode `off`  → PASSTHROUGH : le handler s'exécute inchangé.
//   • `shadow` → observation read-only : le handler s'exécute inchangé ; les vérifications tournent
//     en mode OBSERVE (jamais bloquantes) ; AUCUN effet externe ; aucun résultat shadow substitué.
//   • `active` → enforcement : limites → concurrence/backpressure → timeout borné → handler ; toute
//     erreur est mappée en SafeError ; `active` n'est accepté que si le readiness gate est vert.
// Une panne du runtime durci ne fabrique jamais de réponse : elle renvoie un SafeError honnête.

import { modeEffect } from "./config";
import { checkInputLimits, type HardeningInput } from "./limits";
import { withTimeout } from "./timeout";
import { createConcurrencyLimiter, type ConcurrencyLimiter } from "./concurrency";
import { toSafeError, makeSafeError, HardeningError } from "./errors";
import { evaluateReadiness, defaultReadinessProbes, isActiveAllowed, type ReadinessProbes } from "./readiness";
import type { HardeningConfig, SafeError, ModeEffect } from "./types";

export type GuardResult<T> =
  | { readonly ok: true; readonly value: T; readonly effect: ModeEffect }
  | { readonly ok: false; readonly error: SafeError; readonly effect: ModeEffect };

export interface GuardContext {
  readonly tenantKey?: string | null;
  readonly correlationId?: string | null;
  readonly parentSignal?: AbortSignal | null;
  readonly input?: HardeningInput;
  readonly nowMs?: number;
}

export interface HardenedRuntime {
  readonly config: HardeningConfig;
  readonly effect: ModeEffect;
  /** Exécute `handler` sous la politique du mode courant. Ne lève jamais : renvoie un GuardResult. */
  guard<T>(ctx: GuardContext, handler: (signal: AbortSignal) => Promise<T>): Promise<GuardResult<T>>;
  snapshot(): { concurrency: ReturnType<ConcurrencyLimiter["snapshot"]> };
}

export interface RuntimeDeps {
  readonly readinessProbes?: ReadinessProbes;
  /** Injecté dans les tests pour éviter un vrai timer. */
  readonly schedule?: (cb: () => void, ms: number) => { clear: () => void };
  readonly limiter?: ConcurrencyLimiter;
}

export function createHardenedRuntime(config: HardeningConfig, deps: RuntimeDeps = {}): HardenedRuntime {
  const effect = modeEffect(config);
  const limiter = deps.limiter ?? createConcurrencyLimiter(config.concurrency);
  const probes = deps.readinessProbes ?? defaultReadinessProbes();

  return {
    config,
    effect,
    snapshot: () => ({ concurrency: limiter.snapshot() }),
    async guard<T>(ctx: GuardContext, handler: (signal: AbortSignal) => Promise<T>): Promise<GuardResult<T>> {
      const correlationId = ctx.correlationId ?? null;
      // PASSTHROUGH — off ou kill switch : rien ne change, aucune vérification bloquante.
      if (effect.passthrough) {
        try {
          const value = await handler(ctx.parentSignal ?? new AbortController().signal);
          return { ok: true, value, effect };
        } catch (err) {
          // En passthrough, on ne masque pas : on remonte via SafeError uniquement si l'appelant
          // veut une frontière. Ici on propage l'erreur d'origine au handler appelant (comportement
          // historique). Pour rester "ne lève jamais", on renvoie un SafeError générique.
          return { ok: false, error: toSafeError(err, correlationId), effect };
        }
      }

      // SHADOW — observation read-only : le handler s'exécute inchangé, aucune vérification ne bloque,
      // aucun effet externe, aucun résultat substitué. Les limites sont évaluées mais seulement observées.
      if (effect.observeOnly) {
        void checkInputLimits(ctx.input ?? {}, config.limits, correlationId); // observé, jamais bloquant
        try {
          const value = await handler(ctx.parentSignal ?? new AbortController().signal);
          return { ok: true, value, effect };
        } catch (err) {
          return { ok: false, error: toSafeError(err, correlationId), effect };
        }
      }

      // ACTIVE — enforcement. Refusé si le readiness gate n'est pas vert (fail-closed).
      const readiness = evaluateReadiness(config, probes);
      if (!isActiveAllowed(readiness)) {
        return { ok: false, error: makeSafeError("runtime_disabled", correlationId), effect };
      }
      // 1) Limites d'entrée.
      const limitError = checkInputLimits(ctx.input ?? {}, config.limits, correlationId);
      if (limitError) return { ok: false, error: limitError, effect };
      // 2) Concurrence/backpressure + 3) timeout borné + annulation.
      try {
        const value = await limiter.run(ctx.tenantKey ?? "anon", () =>
          withTimeout((signal) => handler(signal), config.budgets.totalMs, { parentSignal: ctx.parentSignal ?? null, schedule: deps.schedule }),
        );
        return { ok: true, value, effect };
      } catch (err) {
        const safe = err instanceof HardeningError ? { ...makeSafeError(err.code, correlationId) } : toSafeError(err, correlationId);
        return { ok: false, error: safe, effect };
      }
    },
  };
}
