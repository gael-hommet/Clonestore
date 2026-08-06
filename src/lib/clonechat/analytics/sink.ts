// src/lib/clonechat/analytics/sink.ts
//
// Sinks abstraits et injectables. Un sink ne DOIT jamais lever : il renvoie un résultat honnête. Aucun
// provider externe n'est requis pour le gate. Le sink mémoire sert aux tests ; le no-op est le défaut
// sûr (aucune destination configurée ⇒ rien n'est « envoyé », et l'émetteur le dit honnêtement).

import type { AnalyticsEnvelope, AnalyticsSink, SinkDeliveryResult } from "./types";

/** Sink mémoire déterministe : conserve les enveloppes pour l'agrégation/les tests. */
export interface MemoryAnalyticsSink extends AnalyticsSink {
  readonly events: readonly AnalyticsEnvelope[];
  clear(): void;
}
export function createMemorySink(id = "memory"): MemoryAnalyticsSink {
  const events: AnalyticsEnvelope[] = [];
  return {
    id,
    get events() { return events; },
    deliver(batch) {
      for (const e of batch) events.push(e);
      return { status: "ok", delivered: batch.length, failed: 0 };
    },
    clear() { events.length = 0; },
  };
}

/** Sink no-op : n'envoie rien, mais ne prétend PAS un envoi (delivered=0). Défaut sûr. */
export function createNoopSink(id = "noop"): AnalyticsSink {
  return { id, deliver: (batch) => ({ status: "ok", delivered: 0, failed: batch.length ? 0 : 0 }) };
}

/** Sink en échec (tests) : échoue honnêtement, ne lève jamais. */
export function createFailingSink(id = "failing"): AnalyticsSink {
  return { id, deliver: (batch) => ({ status: "failed", delivered: 0, failed: batch.length }) };
}

/** Sink timeout (tests) : simule un dépassement, résultat honnête. */
export function createTimeoutSink(id = "timeout"): AnalyticsSink {
  return { id, deliver: (batch) => ({ status: "timeout", delivered: 0, failed: batch.length }) };
}

/** Sink partiel (tests) : livre la moitié, échoue l'autre. */
export function createPartialSink(id = "partial"): AnalyticsSink {
  return {
    id,
    deliver(batch): SinkDeliveryResult {
      const delivered = Math.floor(batch.length / 2);
      const failed = batch.length - delivered;
      return { status: failed > 0 ? "partial" : "ok", delivered, failed };
    },
  };
}
