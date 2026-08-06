// src/lib/clonechat/analytics/sink.ts
//
// Sinks abstraits et injectables. Un sink ne DOIT jamais lever : il renvoie un résultat honnête. Aucun
// provider externe n'est requis pour le gate. Le sink mémoire (capable) sert aux tests ; le no-op
// (capable:false) est le défaut sûr : aucune destination ⇒ rien n'est « livré », et l'émetteur le dit
// honnêtement (statut disabled, raison sink_noop) — jamais un faux succès d'envoi.

import type { AnalyticsEnvelope, AnalyticsSink, SinkDeliveryResult } from "./types";

/** Sink mémoire déterministe (CAPABLE) : conserve les enveloppes pour l'agrégation/les tests. */
export interface MemoryAnalyticsSink extends AnalyticsSink {
  readonly events: readonly AnalyticsEnvelope[];
  clear(): void;
}
export function createMemorySink(id = "memory"): MemoryAnalyticsSink {
  const events: AnalyticsEnvelope[] = [];
  return {
    id,
    capable: true,
    get events() { return events; },
    deliver(batch) {
      for (const e of batch) events.push(e);
      return { status: "ok", delivered: batch.length, failed: 0 };
    },
    clear() { events.length = 0; },
  };
}

/** Sink no-op (NON capable) : aucune destination. Le collecteur court-circuite en `disabled` avant toute
 *  livraison (capable:false) ; deliver() n'est donc jamais atteint via le collecteur. S'il était appelé
 *  directement, il déclare HONNÊTEMENT n'avoir rien livré (jamais un faux succès, comptes cohérents). */
export function createNoopSink(id = "noop"): AnalyticsSink {
  return { id, capable: false, deliver: (batch) => ({ status: "failed", delivered: 0, failed: batch.length }) };
}

/** Sink en échec (tests, CAPABLE mais échoue honnêtement) : ne lève jamais. */
export function createFailingSink(id = "failing"): AnalyticsSink {
  return { id, capable: true, deliver: (batch) => ({ status: "failed", delivered: 0, failed: batch.length }) };
}

/** Sink timeout (tests) : simule un dépassement, résultat honnête. */
export function createTimeoutSink(id = "timeout"): AnalyticsSink {
  return { id, capable: true, deliver: (batch) => ({ status: "timeout", delivered: 0, failed: batch.length }) };
}

/**
 * Sink partiel (tests) : livre une partie, échoue l'autre — jamais présenté comme complet, jamais des
 * comptes impossibles. Une livraison PARTIELLE n'a de sens qu'à partir de DEUX événements : pour un lot
 * d'un seul événement (indivisible) le sink renvoie honnêtement `failed` (0/1), et pour un lot vide `ok`
 * (0/0). Invariant garanti dans tous les cas : delivered ≥ 0, failed ≥ 0, delivered + failed === batch.length.
 */
export function createPartialSink(id = "partial"): AnalyticsSink {
  return {
    id,
    capable: true,
    deliver(batch): SinkDeliveryResult {
      const n = batch.length;
      if (n === 0) return { status: "ok", delivered: 0, failed: 0 };
      if (n < 2) return { status: "failed", delivered: 0, failed: n }; // 1 événement ⇒ jamais partiel
      const delivered = Math.floor(n / 2); // ≥ 1 pour n ≥ 2
      const failed = n - delivered; // ≥ 1 pour n ≥ 2
      return { status: "partial", delivered, failed };
    },
  };
}
