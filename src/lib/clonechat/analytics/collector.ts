// src/lib/clonechat/analytics/collector.ts
//
// Collecteur CloneAnalytics : valide → (sink capable ?) → consentement → échantillonnage →
// déduplication → buffer borné (backpressure, priorité opérationnel/sécurité) → sink (retry BORNÉ).
// Résultat d'émission HONNÊTE, jamais un faux succès, avec des COMPTES DE LIVRAISON valides :
//   - accepted  : sink CAPABLE, livraison COMPLÈTE (mode immédiat : delivered 1 / failed 0) ;
//   - failed    : pas de livraison complète (mode immédiat : delivered 0 / failed 1) ;
//   - buffered  : validé et mis en file (mode manuel), livraison NON tentée (delivered/failed null) ;
//   - partial   : livraison RÉELLEMENT partielle d'un lot ≥ 2 (via flush) — jamais un lot d'un seul ;
//   - disabled  : aucun sink capable (sink_noop) OU analytics produit sans consentement ;
//   - sampled_out / duplicate / rejected : livraison NON tentée (delivered/failed null).
// Le collecteur ne fait JAMAIS confiance aux comptes du sink : isValidSinkResult impose delivered+failed
// === taille du lot (et la cohérence statut/comptes) ; un résultat impossible est requalifié en `failed`
// (invalid_sink_result). Une panne analytics ne casse JAMAIS CloneChat : toute erreur est absorbée.

import { hash } from "@/lib/clonechat/actions/keys";
import { getEventSpec } from "./registry";
import { buildEnvelope, type EmitInput } from "./envelope";
import { createNoopSink } from "./sink";
import type { Pseudonymizer } from "./privacy";
import {
  type AnalyticsEnvelope, type AnalyticsSink, type ConsentMode, type EmitResult,
  type SinkDeliveryResult, type SinkDeliveryStatus,
} from "./types";

export type Sampler = (rate: number, key: string) => boolean;

function defaultSampler(rate: number, key: string): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  const n = parseInt(hash(key).slice(0, 8), 16) % 100;
  return n < Math.floor(rate * 100);
}

const SINK_STATUSES: ReadonlySet<string> = new Set(["ok", "partial", "failed", "timeout"]);

/**
 * Validation DÉTERMINISTE et DÉFENSIVE d'un résultat de sink. Le collecteur ne fait JAMAIS confiance aux
 * comptes annoncés : un résultat aux nombres non entiers / non finis / négatifs, dont la somme ≠ taille du
 * lot, ou dont le statut est incohérent avec les comptes, est REJETÉ (puis requalifié en `failed` avec le
 * code `invalid_sink_result`). Aucun sink, pas même un mock de test, ne peut faire passer un faux succès.
 *
 * Invariants imposés (pour un lot de taille `batchLen`) :
 *   - delivered, failed : entiers finis ≥ 0, chacun ≤ batchLen ;
 *   - delivered + failed === batchLen ;
 *   - "ok"              ⇒ delivered === batchLen ET failed === 0 (livraison COMPLÈTE) ;
 *   - "failed"/"timeout"⇒ delivered < batchLen (AUCUNE livraison complète) ;
 *   - "partial"         ⇒ 0 < delivered < batchLen ET 0 < failed < batchLen (vraie livraison partielle).
 */
export function isValidSinkResult(res: unknown, batchLen: number): res is SinkDeliveryResult {
  if (!res || typeof res !== "object") return false;
  const r = res as { status?: unknown; delivered?: unknown; failed?: unknown };
  if (typeof r.status !== "string" || !SINK_STATUSES.has(r.status)) return false;
  const d = r.delivered, f = r.failed;
  if (typeof d !== "number" || typeof f !== "number") return false;
  if (!Number.isFinite(d) || !Number.isFinite(f)) return false;
  if (!Number.isInteger(d) || !Number.isInteger(f)) return false;
  if (d < 0 || f < 0) return false;
  if (d > batchLen || f > batchLen) return false;
  if (d + f !== batchLen) return false;
  if (r.status === "ok" && !(d === batchLen && f === 0)) return false;
  if ((r.status === "failed" || r.status === "timeout") && d >= batchLen) return false;
  if (r.status === "partial" && !(d > 0 && d < batchLen && f > 0 && f < batchLen)) return false;
  return true;
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

  // Résultat de livraison NORMALISÉ en interne : toujours des comptes cohérents (invariant garanti par
  // isValidSinkResult) + un drapeau `invalid` quand le sink a renvoyé un résultat impossible (requalifié).
  function safeDeliver(batch: readonly AnalyticsEnvelope[]): { status: SinkDeliveryStatus; delivered: number; failed: number; invalid: boolean } {
    try {
      const r = sink.deliver(batch);
      if (!isValidSinkResult(r, batch.length)) {
        // Comptes impossibles / incohérents → JAMAIS un faux succès : requalifié en échec honnête.
        return { status: "failed", delivered: 0, failed: batch.length, invalid: true };
      }
      return { status: r.status, delivered: r.delivered, failed: r.failed, invalid: false };
    } catch {
      // Un sink ne devrait jamais lever ; s'il le fait, on absorbe (CloneChat n'est jamais cassé).
      return { status: "failed", delivered: 0, failed: batch.length, invalid: true };
    }
  }

  function deliverWithRetry(batch: readonly AnalyticsEnvelope[]): FlushResult & { invalid: boolean } {
    if (batch.length === 0) return { delivered: 0, failed: 0, status: "ok", retries: 0, invalid: false };
    let retries = 0;
    let res = safeDeliver(batch);
    while ((res.status === "failed" || res.status === "timeout") && retries < maxRetries) { retries++; res = safeDeliver(batch); }
    return { delivered: res.delivered, failed: res.failed, status: res.status, retries, invalid: res.invalid };
  }

  /** ok complet | partial | failed — classification honnête (les comptes sont déjà validés en amont). */
  function classify(status: SinkDeliveryStatus, batchLen: number): "ok" | "partial" | "failed" {
    if (batchLen === 0) return "ok";
    if (status === "ok") return "ok"; // validé ⇒ livraison COMPLÈTE
    if (status === "partial") return "partial"; // validé ⇒ 0 < delivered < batchLen
    return "failed"; // failed | timeout
  }

  function remember(env: AnalyticsEnvelope): void {
    acceptedStore.push(env);
    if (acceptedStore.length > maxAccepted) acceptedStore.shift();
  }

  function flush(): FlushResult {
    const batch = buffer.splice(0, buffer.length);
    const res = deliverWithRetry(batch);
    const cls = classify(res.status, batch.length);
    if (cls === "ok") { for (const e of batch) remember(e); c.accepted += batch.length; }
    else if (cls === "partial") { c.partial += 1; c.failedDeliveries += res.failed; /* buffer: on ne peut pas attribuer quel événement a échoué → aucun n'est présenté comme livré */ }
    else if (batch.length > 0) { c.failedDeliveries += batch.length; }
    return { delivered: res.delivered, failed: res.failed, status: res.status, retries: res.retries };
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
        return { status: "rejected", eventName: input.eventName, eventId: null, reason: built.ok ? "unknown_event" : built.reason, correlationId: input.correlationId ?? null, delivered: null, failed: null };
      }
      const env = built.envelope;

      // Statuts AVANT livraison (livraison NON tentée) : delivered/failed = null (jamais de compte inventé).
      const notDelivered = (status: EmitResult["status"], reason: string | null): EmitResult =>
        ({ status, eventName: env.eventName, eventId: env.eventId, reason, correlationId: env.correlationId, delivered: null, failed: null });

      // Aucun sink CAPABLE → rien n'est livré. Jamais présenté comme accepté ; non conservé.
      if (!sink.capable) { c.disabled++; return notDelivered("disabled", "sink_noop"); }

      // Consentement : analytics PRODUIT désactivée sans consentement (jamais faussement envoyée).
      if (spec.basis === "product" && consent !== "product_enabled") { c.disabled++; return notDelivered("disabled", "product_consent_absent"); }

      // Échantillonnage (opérationnels/sécurité = ALWAYS, jamais échantillonnés).
      if (spec.sampling.kind === "rate" && !sampler(spec.sampling.rate, env.dedupKey)) { c.sampledOut++; return notDelivered("sampled_out", "sampled_out"); }

      // Déduplication.
      if (spec.dedup !== "none") {
        if (seenDedup.has(env.dedupKey)) { c.duplicate++; return notDelivered("duplicate", "duplicate"); }
        seenDedup.add(env.dedupKey);
      }

      if (flushMode === "immediate") {
        // Mode immédiat : un SEUL événement (indivisible) est envoyé. Il n'existe donc que deux issues
        // honnêtes : livraison COMPLÈTE (accepted, 1/0) ou pas de livraison complète (failed, 0/1). Un
        // « partial » sur un lot d'un événement est IMPOSSIBLE : isValidSinkResult le requalifie en failed
        // en amont ⇒ classify ne renvoie jamais "partial" ici. Aucun nombre impossible n'est produit.
        const res = deliverWithRetry([env]);
        const cls = classify(res.status, 1);
        if (cls === "ok") {
          c.accepted++; remember(env);
          return { status: "accepted", eventName: env.eventName, eventId: env.eventId, reason: null, correlationId: env.correlationId, delivered: 1, failed: 0 };
        }
        c.failedDeliveries += 1;
        const reason = res.invalid ? "invalid_sink_result" : `sink_${res.status}`;
        return { status: "failed", eventName: env.eventName, eventId: env.eventId, reason, correlationId: env.correlationId, delivered: 0, failed: 1 };
      }

      // flush "manual" : buffer borné + backpressure (priorité opérationnel/sécurité). Livraison NON tentée
      // à l'émission (elle aura lieu à flush()) ⇒ delivered/failed = null.
      const essential = ESSENTIAL.has(spec.nature);
      if (buffer.length >= maxBuffer) {
        if (!essential) { c.rejected++; return notDelivered("rejected", "backpressure"); }
        flush(); // événement essentiel : on vide le buffer pour faire de la place (jamais perdu).
      }
      buffer.push(env);
      c.buffered++;
      return notDelivered("buffered", null);
    },
  };
}
