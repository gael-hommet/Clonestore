// src/lib/clonechat/hardening/chat-active.ts
//
// Câblage ACTIVE du runtime durci pour /api/assistant/chat. Utilisé UNIQUEMENT quand le mode est
// `active` (jamais en Production dans ce bloc). Off/shadow n'appellent jamais ce module → comportement
// historique strictement inchangé. Fournit : la config+diagnostics+readiness+breaker par provider, un
// LIMITEUR DE CONCURRENCE SERVI persistant (module-level, tenant-scopé), et deux compositions RÉELLES
// du chemin servi :
//   • runServedActiveStream — acquiert un slot de concurrence, démarre le budget TOTAL AVANT l'attente
//     de file (le budget enveloppe attente-file + démarrage provider + streaming complet + finalisation),
//     construit le flux SSE durci (circuit + timeout provider + budget de sortie + fermeture unique), et
//     rend le slot EXACTEMENT une fois à la fin. Un abort/timeout pendant l'attente retire le waiter (le
//     provider n'est JAMAIS appelé) ; pendant le stream, ferme proprement et rend le slot.
//   • runServedActiveUnary — même enveloppe pour un appel provider unaire (non streamé), AVEC retry
//     BORNÉ réel (config.retry, idempotent, avant tout output). Le streaming, lui, N'A PAS de retry
//     (maxRetries=0 par construction — voir stream-guard : impossible de rejouer après le 1er delta).
// Un provider synthétique peut être injecté pour les tests (fail-closed : seulement en mode E2E test).

import { encodeStreamEvent } from "@/lib/clonechat/openai/streaming";
import { isE2EModeEnabled } from "@/lib/pierre/v1/e2e-test-identity";
import { resolveHardeningConfig, modeEffect, DEFAULT_CIRCUIT, type ResolvedHardeningConfig } from "./config";
import { createBreakerRegistry, type CircuitBreaker } from "./circuit-breaker";
import { createConcurrencyLimiter, type ConcurrencyLimiter } from "./concurrency";
import { withTimeout } from "./timeout";
import { guardProviderCall } from "./provider-guard";
import { HardeningError, safeMessageFor } from "./errors";
import { evaluateReadiness, buildReadinessEvidence, isActiveAllowed, type ReadinessFacts } from "./readiness";
import { pumpHardenedStream, type HardenedStreamDeps, type HardenedStreamSink } from "./stream-guard";
import type { HardeningConfig, ModeEffect, ReadinessReport, HardeningErrorCode } from "./types";

// Registre de breakers isolés par provider (persistant au niveau module, temps réel serveur).
const registry = createBreakerRegistry(DEFAULT_CIRCUIT, { now: () => Date.now() });

// Limiteur de concurrence SERVI, persistant au niveau module (la concurrence doit être appliquée ENTRE
// requêtes, pas par requête). Créé paresseusement depuis la config résolue ; réinitialisé par les tests.
let servedLimiter: ConcurrencyLimiter | null = null;
function getServedLimiter(config: HardeningConfig): ConcurrencyLimiter {
  if (!servedLimiter) servedLimiter = createConcurrencyLimiter(config.concurrency);
  return servedLimiter;
}

// ── Seams de test (fail-closed) ────────────────────────────────────────────────
// Injectent un `produce` (stream) ou un `call` (unary) synthétique pour prouver le chemin servi sans
// appel payant. AUCUN effet hors mode E2E test (isE2EModeEnabled exige mode test + NODE_ENV≠production).
let testProduce: HardenedStreamDeps["produce"] | null = null;
export function __setActiveStreamProduceForTests(fn: HardenedStreamDeps["produce"] | null): void {
  if (!isE2EModeEnabled()) return;
  testProduce = fn;
}
export function activeStreamProduceForTests(): HardenedStreamDeps["produce"] | null {
  return isE2EModeEnabled() ? testProduce : null;
}

export type ActiveUnaryCall = (signal: AbortSignal) => Promise<unknown>;
let testUnaryCall: ActiveUnaryCall | null = null;
export function __setActiveUnaryCallForTests(fn: ActiveUnaryCall | null): void {
  if (!isE2EModeEnabled()) return;
  testUnaryCall = fn;
}
export function activeUnaryCallForTests(): ActiveUnaryCall | null {
  return isE2EModeEnabled() ? testUnaryCall : null;
}

/** Réinitialise seams + breakers + limiteur du chemin actif (tests uniquement, fail-closed). */
export function __resetActiveHardeningForTests(): void {
  if (!isE2EModeEnabled()) return;
  testProduce = null;
  testUnaryCall = null;
  registry.reset();
  servedLimiter = null;
}
/** Introspection du breaker d'un provider (tests). */
export function activeBreakerSnapshotForTests(providerKey: string) {
  return registry.for(providerKey).snapshot();
}
/** Introspection du limiteur servi (tests) : prouve active/queued sur le VRAI chemin servi. */
export function activeConcurrencySnapshotForTests(): { active: number; queued: number; perTenantActive: Record<string, number> } {
  if (!isE2EModeEnabled() || !servedLimiter) return { active: 0, queued: 0, perTenantActive: {} };
  return servedLimiter.snapshot();
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
  readonly limiter: ConcurrencyLimiter;
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
    limiter: getServedLimiter(config),
    breakerFor: (k) => registry.for(k),
  };
}

/** Construit un ReadableStream SSE DURCI réel (pumpHardenedStream → encodeStreamEvent). C'est le code
 *  qu'utilise le chemin actif de la route ET que le gate stream teste directement. Le streaming n'a
 *  AUCUN retry (maxRetries=0 par construction : rejouer après le 1er delta corromprait la sortie). */
export function buildActiveHardenedStream(deps: {
  produce: HardenedStreamDeps["produce"];
  breaker?: CircuitBreaker;
  config: HardeningConfig;
  parentSignal?: AbortSignal | null;
  onProviderError?: HardenedStreamDeps["onProviderError"];
  onFinished?: (r: { outcome: "done" | "error" | "cancelled" }) => void | Promise<void>;
  schedule?: (cb: () => void, ms: number) => { clear: () => void };
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
        parentSignal: deps.parentSignal ?? null, onProviderError: deps.onProviderError, schedule: deps.schedule,
      });
      if (deps.onFinished) await deps.onFinished(result);
    },
  });
}

// ── COMPOSITION SERVIE : concurrence + budget TOTAL + circuit ────────────────────

export interface ServedStreamResult {
  readonly ok: boolean;
  readonly stream?: ReadableStream<Uint8Array>;
  readonly error?: { readonly code: HardeningErrorCode; readonly message: string };
}

function defaultSchedule(cb: () => void, ms: number): { clear: () => void } {
  const t = setTimeout(cb, ms);
  return { clear: () => clearTimeout(t) };
}

function mapAcquireError(e: unknown, timedOut: boolean): HardeningErrorCode {
  if (e instanceof HardeningError) {
    if (e.code === "concurrency_limited") return "concurrency_limited";
    if (e.code === "cancelled") return timedOut ? "timeout" : "cancelled";
    return e.code;
  }
  return "runtime_disabled";
}

/**
 * Chemin servi STREAMING durci. Le budget TOTAL démarre AVANT l'attente de file et enveloppe :
 * attente-file + démarrage provider + streaming complet + finalisation. Le slot de concurrence est
 * tenu pendant TOUT le stream et rendu EXACTEMENT une fois (succès/erreur/annulation/timeout). Un
 * abort client ou un timeout total PENDANT L'ATTENTE retire le waiter et le provider n'est JAMAIS
 * appelé. Retour {ok:false} avec le code exact quand l'acquisition échoue (file pleine/abort/timeout).
 */
export async function runServedActiveStream(deps: {
  limiter: ConcurrencyLimiter;
  tenantKey: string;
  config: HardeningConfig;
  breaker?: CircuitBreaker;
  parentSignal?: AbortSignal | null;
  produce: HardenedStreamDeps["produce"];
  onProviderError?: HardenedStreamDeps["onProviderError"];
  onSettled?: (r: { outcome: "done" | "error" | "cancelled" }) => void | Promise<void>;
  schedule?: (cb: () => void, ms: number) => { clear: () => void };
}): Promise<ServedStreamResult> {
  const schedule = deps.schedule ?? defaultSchedule;
  const parent = deps.parentSignal ?? null;
  if (parent?.aborted) return { ok: false, error: { code: "cancelled", message: safeMessageFor("cancelled") } };

  const combined = new AbortController();
  let timedOut = false;
  const onParentAbort = () => combined.abort();
  if (parent) parent.addEventListener("abort", onParentAbort, { once: true });
  // Budget TOTAL démarré MAINTENANT — avant l'attente de file.
  const timer = schedule(() => { timedOut = true; combined.abort(); }, deps.config.budgets.totalMs);
  let timerCleared = false;
  const clearTimer = () => { if (!timerCleared) { timerCleared = true; timer.clear(); if (parent) parent.removeEventListener("abort", onParentAbort); } };

  // Slot tenu pendant tout le stream ; rendu EXACTEMENT une fois via onFinished.
  let released = false;
  let releaseSlot!: () => void;
  const slotHeld = new Promise<void>((res) => { releaseSlot = () => { if (!released) { released = true; res(); } }; });
  let onAcquired!: () => void;
  let onAcquireError!: (e: unknown) => void;
  const acquisition = new Promise<void>((res, rej) => { onAcquired = res; onAcquireError = rej; });

  const runPromise = deps.limiter.run(deps.tenantKey, async () => { onAcquired(); await slotHeld; }, { signal: combined.signal });
  runPromise.catch((e) => onAcquireError(e)); // acquisition échouée (file pleine/abort/timeout) OU jamais rejeté après acquire

  try {
    await acquisition;
  } catch (e) {
    clearTimer();
    releaseSlot(); // aucun slot n'était tenu (run a rejeté avant acquire) : résolution sûre, pas de fuite
    const code = mapAcquireError(e, timedOut);
    return { ok: false, error: { code, message: safeMessageFor(code) } };
  }

  // Slot acquis — construit le flux durci ; rend le slot + arrête le timer à la fin (une seule fois).
  const stream = buildActiveHardenedStream({
    produce: deps.produce,
    breaker: deps.breaker,
    config: deps.config,
    parentSignal: combined.signal, // abort client OU timeout total ferme proprement le stream
    onProviderError: deps.onProviderError,
    onFinished: async (r) => {
      clearTimer();
      releaseSlot();
      if (deps.onSettled) await deps.onSettled(r);
    },
    schedule: deps.schedule,
  });
  return { ok: true, stream };
}

export type ServedUnaryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: HardeningErrorCode; readonly message: string } };

/**
 * Chemin servi UNAIRE durci (non streamé). Budget TOTAL enveloppant attente-file + appel provider,
 * concurrence tenant-scopée, circuit + timeout provider, et retry BORNÉ RÉEL (config.retry) : le retry
 * n'est autorisé que pour une erreur transitoire déclarée retryable et une opération idempotente
 * (appel unaire AVANT tout output). Aucune réponse inventée : à l'échec final → {ok:false} code sûr.
 */
export async function runServedActiveUnary<T>(deps: {
  limiter: ConcurrencyLimiter;
  tenantKey: string;
  config: HardeningConfig;
  breaker?: CircuitBreaker;
  parentSignal?: AbortSignal | null;
  call: (signal: AbortSignal) => Promise<T>;
  retryable?: (e: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  schedule?: (cb: () => void, ms: number) => { clear: () => void };
}): Promise<ServedUnaryResult<T>> {
  try {
    const value = await withTimeout(
      (sig) => deps.limiter.run(deps.tenantKey, (inner) => guardProviderCall((s) => deps.call(s), {
        breaker: deps.breaker,
        timeoutMs: deps.config.budgets.providerMs,
        parentSignal: inner ?? sig,
        retry: deps.retryable
          ? { maxRetries: deps.config.retry.maxRetries, baseDelayMs: deps.config.retry.baseDelayMs, isRetryable: deps.retryable, idempotent: true, sleep: deps.sleep }
          : undefined,
        schedule: deps.schedule,
      }), { signal: sig }),
      deps.config.budgets.totalMs,
      { parentSignal: deps.parentSignal ?? null, schedule: deps.schedule },
    );
    return { ok: true, value };
  } catch (err) {
    const code: HardeningErrorCode = err instanceof HardeningError ? err.code : "internal_safe_error";
    return { ok: false, error: { code, message: safeMessageFor(code) } };
  }
}
