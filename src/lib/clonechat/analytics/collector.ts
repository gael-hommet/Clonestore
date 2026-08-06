// src/lib/clonechat/analytics/collector.ts
//
// Collecteur CloneAnalytics : valide → (sink capable ?) → consentement → échantillonnage →
// déduplication → buffer borné (backpressure, priorité opérationnel/sécurité) → sink (retry BORNÉ).
// Résultat d'émission HONNÊTE, jamais un faux succès :
//   - accepted  : remis à un sink CAPABLE qui a confirmé la livraison COMPLÈTE ;
//   - buffered  : validé et mis en file (mode manuel), PAS encore livré ;
//   - partial   : le sink a confirmé une livraison PARTIELLE (jamais présentée comme complète) ;
//   - disabled  : aucun sink capable (sink_noop) OU analytics produit sans consentement ;
//   - sampled_out / duplicate / rejected / failed.
// Une panne analytics ne casse JAMAIS CloneChat : toute erreur est absorbée en un statut typé.

import { hash } from "@/lib/clonechat/actions/keys";
import { getEventSpec } from "./registry";
import { buildEnvelope, type EmitInput } from "./envelope";
import { createNoopSink } from "./sink";
import type { Pseudonymizer } from "./privacy";
import {
  type AnalyticsEnvelope, type AnalyticsSink, type ConsentMode, type EmitResult, type SinkDeliveryStatus,
} from "./types";

export type Sampler = (rate: number, key: string) => boolean;

function defaultSampler(rate: number, key: string): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  const n = parseInt(hash(key).slice(0, 8), 16) % 100;
  return n < Math.floor(rate * 100);
}

export interface CloneAnalyticsConfig {
  readonly environment: string;
  readonly pseudonymizer: Pseudonymizer;
  readonly sink?: AnalyticsSink;
  readonly consent?: ConsentMode;
  readonly sampler?: Sampler;
  readonly idFactory?: (m: string) => string;
  readonly maxBuffer?: number;
  readonly flush?: "immediate" | "manual";
  readonly maxRetries?: number;
  readonly maxAccepted?: number;
}

export interface FlushResult {
  readonly delivered: number;
  readonly failed: number;
  readonly status: SinkDeliveryStatus;
  readonly retries: number;
}

export interface AnalyticsCounters {
  readonly accepted: number; readonly buffered: number; readonly partial: number; readonly rejected: number;
  readonly duplicate: number; readonly sampledOut: number; readonly disabled: number; readonly failedDeliveries: number;
  readonly bufferSize: number; readonly maxBuffer: number;
}

export interface CloneAnalytics {
  emit(input: EmitInput & { readonly nowMs: number }): EmitResult;
  flush(): FlushResult;
  setConsent(consent: ConsentMode): void;
  getConsent(): ConsentMode;
  accepted(): readonly AnalyticsEnvelope[];
  counters(): AnalyticsCounters;
}

const ESSENTIAL = new Set(["operational", "security"]);

export function createCloneAnalytics(config: CloneAnalyticsConfig): CloneAnalytics {
  const sink = config.sink ?? createNoopSink();
  const sampler = config.sampler ?? defaultSampler;
  const maxBuffer = config.maxBuffer ?? 1000;
  const flushMode = config.flush ?? "immediate";
  const maxRetries = config.maxRetries ?? 1;
  const maxAccepted = config.maxAccepted ?? 5000;

  let consent: ConsentMode = config.consent ?? "operational_only";
  const buffer: AnalyticsEnvelope[] = [];
  const seenDedup = new Set<string>();
  const acceptedStore: AnalyticsEnvelope[] = [];
  const c = { accepted: 0, buffered: 0, partial: 0, rejected: 0, duplicate: 0, sampledOut: 0, disabled: 0, failedDeliveries: 0 };

  function safeDeliver(batch: readonly AnalyticsEnvelope[]) {
    try {
      const r = sink.deliver(batch);
      return { status: r.status, delivered: r.delivered ?? 0, failed: r.failed ?? 0 };
    } catch {
      // Un sink ne devrait jamais lever ; s'il le fait, on absorbe (CloneChat n'est jamais cassé).
      return { status: "failed" as SinkDeliveryStatus, delivered: 0, failed: batch.length };
    }
  }

  function deliverWithRetry(batch: readonly AnalyticsEnvelope[]): FlushResult {
    if (batch.length === 0) return { delivered: 0, failed: 0, status: "ok", retries: 0 };
    let retries = 0;
    let res = safeDeliver(batch);
    while ((res.status === "failed" || res.status === "timeout") && retries < maxRetries) { retries++; res = safeDeliver(batch); }
    return { delivered: res.delivered, failed: res.failed, status: res.status, retries };
  }

  /** ok complet | partial | failed — classification honnête d'une livraison. */
  function classify(res: FlushResult, batchLen: number): "ok" | "partial" | "failed" {
    if (res.status === "ok" && res.delivered >= batchLen && res.failed === 0) return "ok";
    if (res.status === "partial" || (res.delivered > 0 && res.failed > 0)) return "partial";
    return "failed";
  }

  function remember(env: AnalyticsEnvelope): void {
    acceptedStore.push(env);
    if (acceptedStore.length > maxAccepted) acceptedStore.shift();
  }

  function flush(): FlushResult {
    const batch = buffer.splice(0, buffer.length);
    const res = deliverWithRetry(batch);
    const cls = classify(res, batch.length);
    if (cls === "ok") { for (const e of batch) remember(e); c.accepted += batch.length; }
    else if (cls === "partial") { c.partial += 1; c.failedDeliveries += res.failed; /* buffer: on ne peut pas attribuer quel événement a échoué → aucun n'est présenté comme livré */ }
    else if (batch.length > 0) { c.failedDeliveries += batch.length; }
    return res;
  }

  return {
    getConsent: () => consent,
    setConsent(next) { consent = next; },
    accepted: () => acceptedStore,
    counters: () => ({ ...c, bufferSize: buffer.length, maxBuffer }),
    flush,

    emit(input) {
      const spec = getEventSpec(input.eventName);
      const built = buildEnvelope(input, {
        nowMs: input.nowMs, environment: config.environment, pseudonymizer: config.pseudonymizer,
        consent, idFactory: config.idFactory,
      });
      if (!built.ok || !spec) {
        c.rejected++;
        return { status: "rejected", eventName: input.eventName, eventId: null, reason: built.ok ? "unknown_event" : built.reason, correlationId: input.correlationId ?? null };
      }
      const env = built.envelope;

      // Aucun sink CAPABLE → rien n'est livré. Jamais présenté comme accepté ; non conservé.
      if (!sink.capable) {
        c.disabled++;
        return { status: "disabled", eventName: env.eventName, eventId: env.eventId, reason: "sink_noop", correlationId: env.correlationId };
      }

      // Consentement : analytics PRODUIT désactivée sans consentement (jamais faussement envoyée).
      if (spec.basis === "product" && consent !== "product_enabled") {
        c.disabled++;
        return { status: "disabled", eventName: env.eventName, eventId: env.eventId, reason: "product_consent_absent", correlationId: env.correlationId };
      }

      // Échantillonnage (opérationnels/sécurité = ALWAYS, jamais échantillonnés).
      if (spec.sampling.kind === "rate" && !sampler(spec.sampling.rate, env.dedupKey)) {
        c.sampledOut++;
        return { status: "sampled_out", eventName: env.eventName, eventId: env.eventId, reason: "sampled_out", correlationId: env.correlationId };
      }

      // Déduplication.
      if (spec.dedup !== "none") {
        if (seenDedup.has(env.dedupKey)) {
          c.duplicate++;
          return { status: "duplicate", eventName: env.eventName, eventId: env.eventId, reason: "duplicate", correlationId: env.correlationId };
        }
        seenDedup.add(env.dedupKey);
      }

      if (flushMode === "immediate") {
        const res = deliverWithRetry([env]);
        const cls = classify(res, 1);
        if (cls === "ok") { c.accepted++; remember(env); return { status: "accepted", eventName: env.eventName, eventId: env.eventId, reason: null, correlationId: env.correlationId }; }
        if (cls === "partial") { c.partial++; c.failedDeliveries += Math.max(1, res.failed); return { status: "partial", eventName: env.eventName, eventId: env.eventId, reason: "sink_partial", correlationId: env.correlationId }; }
        c.failedDeliveries += Math.max(1, res.failed); return { status: "failed", eventName: env.eventName, eventId: env.eventId, reason: "sink_" + res.status, correlationId: env.correlationId };
      }

      // flush "manual" : buffer borné + backpressure (priorité opérationnel/sécurité).
      const essential = ESSENTIAL.has(spec.nature);
      if (buffer.length >= maxBuffer) {
        if (!essential) {
          c.rejected++;
          return { status: "rejected", eventName: env.eventName, eventId: env.eventId, reason: "backpressure", correlationId: env.correlationId };
        }
        flush(); // événement essentiel : on vide le buffer pour faire de la place (jamais perdu).
      }
      buffer.push(env);
      c.buffered++;
      return { status: "buffered", eventName: env.eventName, eventId: env.eventId, reason: null, correlationId: env.correlationId };
    },
  };
}
