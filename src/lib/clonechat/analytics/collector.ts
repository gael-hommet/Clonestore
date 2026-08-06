// src/lib/clonechat/analytics/collector.ts
//
// Collecteur CloneAnalytics : valide → consentement → échantillonnage → déduplication → buffer borné
// (backpressure avec priorité aux événements opérationnels/sécurité) → sink (retry borné). Résultat
// d'émission HONNÊTE (jamais un faux succès). Une panne analytics ne casse jamais CloneChat : toute
// erreur est absorbée en un statut typé, aucune exception ne remonte.

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

export interface CloneAnalytics {
  emit(input: EmitInput & { readonly nowMs: number }): EmitResult;
  flush(): FlushResult;
  setConsent(consent: ConsentMode): void;
  getConsent(): ConsentMode;
  accepted(): readonly AnalyticsEnvelope[];
  counters(): Readonly<{ accepted: number; rejected: number; duplicate: number; sampledOut: number; disabled: number; failedDeliveries: number; bufferSize: number; maxBuffer: number }>;
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
  const c = { accepted: 0, rejected: 0, duplicate: 0, sampledOut: 0, disabled: 0, failedDeliveries: 0 };

  function deliver(batch: readonly AnalyticsEnvelope[]): FlushResult {
    if (batch.length === 0) return { delivered: 0, failed: 0, status: "ok", retries: 0 };
    let retries = 0;
    let res = safeDeliver(batch);
    while ((res.status === "failed" || res.status === "timeout") && retries < maxRetries) {
      retries++;
      res = safeDeliver(batch); // retry BORNÉ (jamais infini)
    }
    if (res.status === "failed" || res.status === "timeout") c.failedDeliveries += batch.length;
    else if (res.status === "partial") c.failedDeliveries += res.failed;
    return { delivered: res.delivered, failed: res.failed, status: res.status, retries };
  }

  function safeDeliver(batch: readonly AnalyticsEnvelope[]) {
    try {
      const r = sink.deliver(batch);
      return { status: r.status, delivered: r.delivered ?? 0, failed: r.failed ?? 0 };
    } catch {
      // Un sink ne devrait jamais lever ; s'il le fait, on absorbe (CloneChat n'est jamais cassé).
      return { status: "failed" as SinkDeliveryStatus, delivered: 0, failed: batch.length };
    }
  }

  function remember(env: AnalyticsEnvelope): void {
    acceptedStore.push(env);
    if (acceptedStore.length > maxAccepted) acceptedStore.shift();
  }

  return {
    getConsent: () => consent,
    setConsent(next) { consent = next; },
    accepted: () => acceptedStore,
    counters: () => ({ ...c, bufferSize: buffer.length, maxBuffer }),

    emit(input) {
      const spec = getEventSpec(input.eventName);
      // 1) Validation structurelle STRICTE (un événement invalide est toujours rejeté).
      const built = buildEnvelope(input, {
        nowMs: input.nowMs, environment: config.environment, pseudonymizer: config.pseudonymizer,
        consent, idFactory: config.idFactory,
      });
      if (!built.ok || !spec) {
        c.rejected++;
        return { status: "rejected", eventName: input.eventName, eventId: null, reason: built.ok ? "unknown_event" : built.reason, correlationId: input.correlationId ?? null };
      }
      const env = built.envelope;

      // 2) Consentement : les analytics PRODUIT sont désactivées sans consentement (jamais faussement envoyées).
      if (spec.basis === "product" && consent !== "product_enabled") {
        c.disabled++;
        return { status: "disabled", eventName: env.eventName, eventId: env.eventId, reason: "product_consent_absent", correlationId: env.correlationId };
      }

      // 3) Échantillonnage (les opérationnels "always" ne sont jamais écartés).
      if (spec.sampling.kind === "rate" && !sampler(spec.sampling.rate, env.dedupKey)) {
        c.sampledOut++;
        return { status: "sampled_out", eventName: env.eventName, eventId: env.eventId, reason: "sampled_out", correlationId: env.correlationId };
      }

      // 4) Déduplication.
      if (spec.dedup !== "none") {
        if (seenDedup.has(env.dedupKey)) {
          c.duplicate++;
          return { status: "duplicate", eventName: env.eventName, eventId: env.eventId, reason: "duplicate", correlationId: env.correlationId };
        }
        seenDedup.add(env.dedupKey);
      }

      // 5) Livraison / buffer.
      const essential = ESSENTIAL.has(spec.nature);
      if (flushMode === "immediate") {
        const r = deliver([env]);
        if (r.status === "failed" || r.status === "timeout") {
          return { status: "failed", eventName: env.eventName, eventId: env.eventId, reason: "sink_" + r.status, correlationId: env.correlationId };
        }
        c.accepted++; remember(env);
        return { status: "accepted", eventName: env.eventName, eventId: env.eventId, reason: null, correlationId: env.correlationId };
      }

      // flush "manual" : buffer borné + backpressure (priorité opérationnel/sécurité).
      if (buffer.length >= maxBuffer) {
        if (!essential) {
          c.rejected++;
          return { status: "rejected", eventName: env.eventName, eventId: env.eventId, reason: "backpressure", correlationId: env.correlationId };
        }
        // Événement essentiel : on vide le buffer (flush) pour faire de la place, jamais on ne le perd.
        this.flush();
      }
      buffer.push(env);
      c.accepted++; remember(env);
      return { status: "buffered", eventName: env.eventName, eventId: env.eventId, reason: null, correlationId: env.correlationId };
    },

    flush() {
      const batch = buffer.splice(0, buffer.length);
      return deliver(batch);
    },
  };
}
