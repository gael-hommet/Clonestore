// src/lib/clonechat/hardening/circuit-breaker.ts
//
// Circuit breaker DÉTERMINISTE et INJECTABLE (temps injecté), à utiliser UNIQUEMENT là où une
// dépendance externe réelle le justifie (provider modèle/voix). États : closed → open → half_open.
// Un circuit OUVERT refuse vite (HardeningError "circuit_open") — il ne devient JAMAIS une permission
// d'inventer une réponse : l'appelant doit renvoyer un fallback sûr/honnête, jamais un contenu fabriqué.
// Isolation stricte entre providers (registre par clé).

import { HardeningError } from "./errors";
import type { CircuitPolicy, CircuitState } from "./types";

export interface CircuitBreaker {
  readonly state: () => CircuitState;
  /** Exécute `fn` si le circuit l'autorise ; sinon lève HardeningError("circuit_open"). */
  exec<T>(fn: () => Promise<T>): Promise<T>;
  /** Introspection déterministe (tests/observabilité). */
  snapshot(): { state: CircuitState; failures: number; openedAtMs: number | null; halfOpenProbes: number };
}

export interface CircuitDeps {
  readonly now: () => number; // temps INJECTÉ (déterministe)
}

export function createCircuitBreaker(policy: CircuitPolicy, deps: CircuitDeps): CircuitBreaker {
  let state: CircuitState = "closed";
  let failures = 0;
  let openedAtMs: number | null = null;
  let halfOpenProbes = 0;

  function transitionIfCooldownElapsed(): void {
    if (state === "open" && openedAtMs !== null && deps.now() - openedAtMs >= policy.cooldownMs) {
      state = "half_open";
      halfOpenProbes = 0;
    }
  }

  function onSuccess(): void {
    failures = 0;
    openedAtMs = null;
    halfOpenProbes = 0;
    state = "closed";
  }

  function onFailure(): void {
    if (state === "half_open") { // échec de récupération → ré-ouverture
      state = "open"; openedAtMs = deps.now(); halfOpenProbes = 0; return;
    }
    failures += 1;
    if (failures >= policy.failureThreshold) { state = "open"; openedAtMs = deps.now(); }
  }

  return {
    state: () => { transitionIfCooldownElapsed(); return state; },
    snapshot: () => ({ state, failures, openedAtMs, halfOpenProbes }),
    async exec<T>(fn: () => Promise<T>): Promise<T> {
      transitionIfCooldownElapsed();
      if (state === "open") throw new HardeningError("circuit_open", "circuit open");
      if (state === "half_open") {
        if (halfOpenProbes >= policy.halfOpenMaxProbes) throw new HardeningError("circuit_open", "half-open probe budget exhausted");
        halfOpenProbes += 1;
      }
      try {
        const r = await fn();
        onSuccess();
        return r;
      } catch (err) {
        onFailure();
        throw err;
      }
    },
  };
}

/** Registre de breakers isolés PAR provider : un provider en panne n'ouvre jamais le circuit d'un autre. */
export function createBreakerRegistry(policy: CircuitPolicy, deps: CircuitDeps) {
  const breakers = new Map<string, CircuitBreaker>();
  return {
    for(providerKey: string): CircuitBreaker {
      let b = breakers.get(providerKey);
      if (!b) { b = createCircuitBreaker(policy, deps); breakers.set(providerKey, b); }
      return b;
    },
    snapshot(): Record<string, ReturnType<CircuitBreaker["snapshot"]>> {
      const out: Record<string, ReturnType<CircuitBreaker["snapshot"]>> = {};
      for (const [k, b] of breakers) out[k] = b.snapshot();
      return out;
    },
  };
}
