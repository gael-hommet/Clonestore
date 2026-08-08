// src/lib/clonechat/hardening/concurrency.ts
//
// Concurrence + backpressure DÉTERMINISTE et ABORTABLE. Concurrence globale bornée, file bornée,
// plafond PAR TENANT. Un waiter en file est retiré ATOMIQUEMENT s'il est annulé (AbortSignal) — il ne
// démarre JAMAIS plus tard. Rejet SÛR au-delà du budget (`concurrency_limited`) ; jamais d'attente
// infinie (le budget TOTAL, appliqué par l'appelant via un signal, enveloppe attente + exécution). Slot
// TOUJOURS rendu (succès/erreur/timeout/abort), jamais deux fois. Aucune fuite de file, aucun compteur
// fantôme, FIFO parmi les waiters éligibles.

import { HardeningError } from "./errors";
import type { ConcurrencyPolicy } from "./types";

interface Waiter {
  readonly tenantKey: string;
  readonly resolve: () => void;
  readonly reject: (e: unknown) => void;
  readonly signal: AbortSignal | null;
  onAbort: (() => void) | null;
  settled: boolean;
}

export interface RunOptions { readonly signal?: AbortSignal | null; }

export interface ConcurrencyLimiter {
  run<T>(tenantKey: string, fn: (signal?: AbortSignal) => Promise<T>, opts?: RunOptions): Promise<T>;
  snapshot(): { active: number; queued: number; perTenantActive: Record<string, number> };
}

export function createConcurrencyLimiter(policy: ConcurrencyPolicy): ConcurrencyLimiter {
  let active = 0;
  const queue: Waiter[] = [];
  const perTenantActive = new Map<string, number>();
  const tenantCount = (k: string) => perTenantActive.get(k) ?? 0;

  function acquire(k: string) { active += 1; perTenantActive.set(k, tenantCount(k) + 1); }
  function release(k: string) {
    active = Math.max(0, active - 1);
    const n = tenantCount(k) - 1;
    if (n <= 0) perTenantActive.delete(k); else perTenantActive.set(k, n);
    pump();
  }
  function detach(w: Waiter) { if (w.signal && w.onAbort) { w.signal.removeEventListener("abort", w.onAbort); w.onAbort = null; } }

  function pump() {
    for (let i = 0; i < queue.length; i++) {
      if (active >= policy.maxConcurrent) return;
      const w = queue[i];
      if (w.settled) { queue.splice(i, 1); i--; continue; }
      if (tenantCount(w.tenantKey) >= policy.perTenantMaxConcurrent) continue; // FIFO éligible, pas de famine du global
      queue.splice(i, 1);
      w.settled = true;
      detach(w);
      acquire(w.tenantKey);
      w.resolve();
      return;
    }
  }

  return {
    snapshot: () => ({ active, queued: queue.length, perTenantActive: Object.fromEntries(perTenantActive) }),
    async run<T>(tenantKey: string, fn: (signal?: AbortSignal) => Promise<T>, opts?: RunOptions): Promise<T> {
      const key = tenantKey || "anon";
      const signal = opts?.signal ?? null;
      if (signal?.aborted) throw new HardeningError("cancelled", "aborted before enqueue");

      const canStart = active < policy.maxConcurrent && tenantCount(key) < policy.perTenantMaxConcurrent;
      if (!canStart) {
        if (queue.length >= policy.maxQueue) throw new HardeningError("concurrency_limited", "queue full");
        await new Promise<void>((resolve, reject) => {
          const waiter: Waiter = { tenantKey: key, resolve, reject, signal, onAbort: null, settled: false };
          const onAbort = () => {
            if (waiter.settled) return;
            waiter.settled = true;
            const i = queue.indexOf(waiter);
            if (i >= 0) queue.splice(i, 1); // retrait atomique : ne démarrera jamais
            detach(waiter);
            reject(new HardeningError("cancelled", "aborted while queued"));
          };
          waiter.onAbort = onAbort;
          if (signal) signal.addEventListener("abort", onAbort, { once: true });
          queue.push(waiter);
        });
        // Arrivé ici : pump() a marqué settled + acquire() le slot.
      } else {
        acquire(key);
      }

      try {
        return await fn(signal ?? undefined);
      } finally {
        release(key); // slot rendu exactement une fois
      }
    },
  };
}
