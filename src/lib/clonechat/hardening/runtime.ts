// src/lib/clonechat/hardening/runtime.ts
//
// Orchestrateur du runtime durci. `guard()` applique le mode courant :
//   • off / kill switch → PASSTHROUGH (handler inchangé).
//   • shadow → observation read-only (handler inchangé, vérifications non bloquantes, aucun effet).
//   • active → enforcement : readiness (fail-closed, evidence explicite) → limites → [budget TOTAL qui
//     enveloppe attente de file + exécution] → concurrence/backpressure abortable → handler.
// Le budget total englobe l'attente en file (un client parti ne lance jamais le handler plus tard).
// Ne lève jamais : toute erreur → SafeError honnête. `active` refusé si readiness ≠ ready_for_b14.

import { modeEffect } from "./config";
import { checkInputLimits, type HardeningInput } from "./limits";
import { withTimeout } from "./timeout";
import { createConcurrencyLimiter, type ConcurrencyLimiter } from "./concurrency";
import { toSafeError, makeSafeError, HardeningError } from "./errors";
import { evaluateReadiness, isActiveAllowed, type ReadinessEvidence } from "./readiness";
import type { ConfigDiagnostic } from "./config";
import type { HardeningConfig, SafeError, ModeEffect, ReadinessReport } from "./types";

export type GuardResult<T> =
  | { readonly ok: true; readonly value: T; readonly effect: ModeEffect }
  | { readonly ok: false; readonly error: SafeError; readonly effect: ModeEffect };

export interface GuardContext {
  readonly tenantKey?: string | null;
  readonly correlationId?: string | null;
  readonly parentSignal?: AbortSignal | null;
  readonly input?: HardeningInput;
}

export interface HardenedRuntime {
  readonly config: HardeningConfig;
  readonly effect: ModeEffect;
  readiness(): ReadinessReport;
  guard<T>(ctx: GuardContext, handler: (signal: AbortSignal) => Promise<T>): Promise<GuardResult<T>>;
  snapshot(): { concurrency: ReturnType<ConcurrencyLimiter["snapshot"]> };
}

export interface RuntimeDeps {
  /** Evidence RÉELLE des garanties (fail-closed : absente → active bloqué). Aucun défaut vert. */
  readonly readinessEvidence?: readonly ReadinessEvidence[];
  readonly configResolution?: { valid: boolean; diagnostics: readonly ConfigDiagnostic[] };
  readonly schedule?: (cb: () => void, ms: number) => { clear: () => void };
  readonly limiter?: ConcurrencyLimiter;
}

export function createHardenedRuntime(config: HardeningConfig, deps: RuntimeDeps = {}): HardenedRuntime {
  const effect = modeEffect(config);
  const limiter = deps.limiter ?? createConcurrencyLimiter(config.concurrency);
  const evidence = deps.readinessEvidence ?? []; // AUCUN défaut vert : sans evidence → blocked

  const runtime: HardenedRuntime = {
    config,
    effect,
    readiness: () => evaluateReadiness(config, evidence, deps.configResolution),
    snapshot: () => ({ concurrency: limiter.snapshot() }),
    async guard<T>(ctx: GuardContext, handler: (signal: AbortSignal) => Promise<T>): Promise<GuardResult<T>> {
      const corr = ctx.correlationId ?? null;
      const noSignal = () => new AbortController().signal;

      if (effect.passthrough || effect.observeOnly) {
        if (effect.observeOnly) void checkInputLimits(ctx.input ?? {}, config.limits, corr); // observé, non bloquant
        try { return { ok: true, value: await handler(ctx.parentSignal ?? noSignal()), effect }; }
        catch (err) { return { ok: false, error: toSafeError(err, corr), effect }; }
      }

      // ACTIVE — fail-closed.
      if (!isActiveAllowed(runtime.readiness())) return { ok: false, error: makeSafeError("runtime_disabled", corr), effect };
      const limitError = checkInputLimits(ctx.input ?? {}, config.limits, corr);
      if (limitError) return { ok: false, error: limitError, effect };
      try {
        const value = await withTimeout(
          (sig) => limiter.run(ctx.tenantKey ?? "anon", () => handler(sig), { signal: sig }),
          config.budgets.totalMs,
          { parentSignal: ctx.parentSignal ?? null, schedule: deps.schedule },
        );
        return { ok: true, value, effect };
      } catch (err) {
        const safe = err instanceof HardeningError ? makeSafeError(err.code, corr) : toSafeError(err, corr);
        return { ok: false, error: safe, effect };
      }
    },
  };
  return runtime;
}
