// src/lib/clonechat/hardening/chat-active.ts
//
// Câblage ACTIVE du runtime durci pour /api/assistant/chat. Utilisé UNIQUEMENT quand le mode est
// `active` (jamais en Production dans ce bloc). Off/shadow n'appellent jamais ce module → comportement
// historique strictement inchangé. Fournit : la config+diagnostics+readiness+breaker par provider, et
// la construction d'un flux SSE DURCI réel (pumpHardenedStream → encodeStreamEvent). Un provider
// synthétique peut être injecté pour les tests (fail-closed : seulement en mode E2E test).

import { encodeStreamEvent } from "@/lib/clonechat/openai/streaming";
import { isE2EModeEnabled } from "@/lib/pierre/v1/e2e-test-identity";
import { resolveHardeningConfig, modeEffect, DEFAULT_CIRCUIT, type ResolvedHardeningConfig } from "./config";
import { createBreakerRegistry, type CircuitBreaker } from "./circuit-breaker";
import { evaluateReadiness, buildReadinessEvidence, isActiveAllowed, type ReadinessFacts } from "./readiness";
import { pumpHardenedStream, type HardenedStreamDeps, type HardenedStreamSink } from "./stream-guard";
import type { HardeningConfig, ModeEffect, ReadinessReport } from "./types";

// Registre de breakers isolés par provider (persistant au niveau module, temps réel serveur).
const registry = createBreakerRegistry(DEFAULT_CIRCUIT, { now: () => Date.now() });

// Seam de test (fail-closed) : injecte un `produce` synthétique pour prouver le chemin actif sans appel
// payant. N'a AUCUN effet hors mode E2E test (isE2EModeEnabled exige mode test + NODE_ENV≠production).
let testProduce: HardenedStreamDeps["produce"] | null = null;
export function __setActiveStreamProduceForTests(fn: HardenedStreamDeps["produce"] | null): void {
  if (!isE2EModeEnabled()) return;
  testProduce = fn;
}
export function activeStreamProduceForTests(): HardenedStreamDeps["produce"] | null {
  return isE2EModeEnabled() ? testProduce : null;
}
/** Réinitialise le seam + les breakers du chemin actif (tests uniquement, fail-closed). */
export function __resetActiveHardeningForTests(): void {
  if (!isE2EModeEnabled()) return;
  testProduce = null;
  registry.reset();
}
/** Introspection du breaker d'un provider (tests). */
export function activeBreakerSnapshotForTests(providerKey: string) {
  return registry.for(providerKey).snapshot();
}

/**
 * Faits de readiness du chemin actif servi. Les garanties STRUCTURELLES (timeout total, abort,
 * concurrence/backpressure, provider policy/circuit) sont prouvées PAR CONSTRUCTION de ce runtime.
 * `config_valid` vient des diagnostics serveur réels. Les garanties de la ROUTE/BLOC0→12
 * (auth/tenant/rate-limit/analytics-fail-open/secrets/fallback/no-external-effect) doivent être
 * assertées par la route via `routeCaps` — absentes → unknown → blocked (fail-closed, falsifiable).
 */
export function activeReadinessFacts(config: HardeningConfig, resolution: ResolvedHardeningConfig, routeCaps: Partial<ReadinessFacts> = {}): ReadinessFacts {
  return {
    config_valid: resolution.valid,
    timeout_total: true,
    abort: true,
    concurrency_backpressure: true,
    provider_policy: true,
    redaction: config.redactionEnabled === true,
    actions_governed: config.actions.maxPreparedActions >= config.actions.maxExecutableActions,
    confirmation: config.actions.requireConfirmation === true,
    ...routeCaps, // route-asserted guarantees (auth/tenant/rate-limit/analytics/secrets/fallback/no-external)
  };
}

export interface ActiveHardening {
  readonly resolution: ResolvedHardeningConfig;
  readonly config: HardeningConfig;
  readonly effect: ModeEffect;
  readonly readiness: ReadinessReport;
  readonly activeAllowed: boolean;
  breakerFor(providerKey: string): CircuitBreaker;
}

export const ACTIVE_STREAM_PROVIDER_KEY = "openai:public-stream" as const;

export function activeHardening(env: NodeJS.ProcessEnv = process.env, routeCaps: Partial<ReadinessFacts> = {}): ActiveHardening {
  const resolution = resolveHardeningConfig(env);
  const config = resolution.config;
  // Santé provider (dégradante) dérivée du VRAI breaker module : circuit ouvert → non healthy.
  const providerHealthy = registry.for(ACTIVE_STREAM_PROVIDER_KEY).state() !== "open";
  const facts: ReadinessFacts = { ...activeReadinessFacts(config, resolution, routeCaps), provider_healthy: providerHealthy };
  const evidence = buildReadinessEvidence(facts, "chat-active");
  const readiness = evaluateReadiness(config, evidence, resolution);
  return {
    resolution, config, effect: modeEffect(config), readiness, activeAllowed: isActiveAllowed(readiness),
    breakerFor: (k) => registry.for(k),
  };
}

/** Construit un ReadableStream SSE DURCI réel (pumpHardenedStream → encodeStreamEvent). C'est le code
 *  qu'utilise le chemin actif de la route ET que le gate stream teste directement. */
export function buildActiveHardenedStream(deps: {
  produce: HardenedStreamDeps["produce"];
  breaker?: CircuitBreaker;
  config: HardeningConfig;
  parentSignal?: AbortSignal | null;
  onProviderError?: HardenedStreamDeps["onProviderError"];
  onFinished?: (r: { outcome: "done" | "error" | "cancelled" }) => void | Promise<void>;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const sink: HardenedStreamSink = {
        send(ev) { try { controller.enqueue(encoder.encode(encodeStreamEvent(ev as Parameters<typeof encodeStreamEvent>[0]))); } catch { /* client parti */ } },
        close() { try { controller.close(); } catch { /* déjà fermé */ } },
      };
      const result = await pumpHardenedStream(sink, {
        produce: deps.produce, breaker: deps.breaker,
        maxOutputChars: deps.config.limits.maxOutputChars, providerTimeoutMs: deps.config.budgets.providerMs,
        parentSignal: deps.parentSignal ?? null, onProviderError: deps.onProviderError,
      });
      if (deps.onFinished) await deps.onFinished(result);
    },
  });
}
