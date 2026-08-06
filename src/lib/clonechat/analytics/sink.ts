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

/** Sink no-op (NON capable) : aucune destination. Le collecteur ne présentera jamais un envoi. */
export function createNoopSink(id = "noop"): AnalyticsSink {
  return { id, capable: false, deliver: (batch) => ({ status: "ok", delivered: 0, failed: batch.length ? 0 : 0 }) };
}

/** Sink en échec (tests, CAPABLE mais échoue honnêtement) : ne lève jamais. */
export function createFailingSink(id = "failing"): AnalyticsSink {
  return { id, capable: true, deliver: (batch) => ({ status: "failed", delivered: 0, failed: batch.length }) };
}

/** Sink timeout (tests) : simule un dépassement, résultat honnête. */
export function createTimeoutSink(id = "timeout"): AnalyticsSink {
  return { id, capable: true, deliver: (batch) => ({ status: "timeout", delivered: 0, failed: batch.length }) };
}

/** Sink partiel (tests) : livre une partie, échoue l'autre — jamais présenté comme complet. */
export function createPartialSink(id = "partial"): AnalyticsSink {
  return {
    id,
    capable: true,
    deliver(batch): SinkDeliveryResult {
      const delivered = Math.max(1, Math.floor(batch.length / 2));
      const failed = Math.max(1, batch.length - delivered);
      return { status: "partial", delivered, failed };
    },
  };
}
