// src/lib/clonechat/hardening/concurrency.ts
//
// Contrôle de concurrence + backpressure DÉTERMINISTE. Empêche la saturation : concurrence globale
// bornée, file d'attente bornée, plafond PAR TENANT (aucune fuite/famine entre tenants), rejet SÛR
// au-delà du budget (HardeningError "concurrency_limited") — jamais d'attente infinie. Nettoyage
// systématique après résolution, rejet, timeout ou abort (le slot est TOUJOURS rendu).

import { HardeningError } from "./errors";
import type { ConcurrencyPolicy } from "./types";

interface Waiter { readonly tenantKey: string; resolve: () => void; reject: (e: unknown) => void; released: boolean; }

export interface ConcurrencyLimiter {
  run<T>(tenantKey: string, fn: () => Promise<T>): Promise<T>;
  snapshot(): { active: number; queued: number; perTenantActive: Record<string, number> };
}

export function createConcurrencyLimiter(policy: ConcurrencyPolicy): ConcurrencyLimiter {
  let active = 0;
  const queue: Waiter[] = [];
  const perTenantActive = new Map<string, number>();

  const tenantCount = (k: string) => perTenantActive.get(k) ?? 0;

  function tryStartFromQueue(): void {
    // Cherche le prochain waiter éligible (respecte le plafond par tenant) sans affamer : parcours FIFO.
    for (let i = 0; i < queue.length; i++) {
      const w = queue[i];
      if (active >= policy.maxConcurrent) return;
      if (tenantCount(w.tenantKey) >= policy.perTenantMaxConcurrent) continue;
      queue.splice(i, 1);
      acquire(w.tenantKey);
      w.resolve();
      return;
    }
  }

  function acquire(tenantKey: string): void {
    active += 1;
    perTenantActive.set(tenantKey, tenantCount(tenantKey) + 1);
  }

  function release(tenantKey: string): void {
    active = Math.max(0, active - 1);
    const n = tenantCount(tenantKey) - 1;
    if (n <= 0) perTenantActive.delete(tenantKey); else perTenantActive.set(tenantKey, n);
    tryStartFromQueue();
  }

  return {
    snapshot: () => ({ active, queued: queue.length, perTenantActive: Object.fromEntries(perTenantActive) }),
    async run<T>(tenantKey: string, fn: () => Promise<T>): Promise<T> {
      const key = tenantKey || "anon";
      const canStartNow = active < policy.maxConcurrent && tenantCount(key) < policy.perTenantMaxConcurrent;
      if (!canStartNow) {
        if (queue.length >= policy.maxQueue) throw new HardeningError("concurrency_limited", "queue full");
        await new Promise<void>((resolve, reject) => { queue.push({ tenantKey: key, resolve, reject, released: false }); });
      } else {
        acquire(key);
      }
      try {
        return await fn();
      } finally {
        release(key); // slot TOUJOURS rendu (résolution, rejet, timeout ou abort)
      }
    },
  };
}
