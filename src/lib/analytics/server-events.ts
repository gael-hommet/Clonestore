// Canonical Analytics Runtime Wiring Closure — API serveur UNIQUE pour les vérités du funnel.
// Un seul point d'écriture des événements server-authoritative, jamais accepté du navigateur.
// Best-effort : n'échoue jamais jusqu'au chemin métier appelant ; retourne un résultat
// observable. Ne lit jamais d'email comme identité, ne crée jamais d'ordre/paiement/partenaire.
//
// Voir audit-20260723-full/ANALYTICS_SERVER_EVENT_ADAPTER_SPEC.md.

import { createHash } from "node:crypto";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import { insertAnalyticsEvent } from "./store";
import {
  type CanonicalAnalyticsEventName,
  type AnalyticsTrustLevel,
  type AnalyticsEnvironment,
  type CanonicalAnalyticsProperties,
  isServerOnlyCanonicalEvent,
  sanitizeCanonicalProperties,
  isUuid,
} from "./schema";

/** Résout l'environnement analytics à partir de NODE_ENV/VERCEL_ENV. */
export function resolveAnalyticsEnvironment(): AnalyticsEnvironment {
  if (process.env.NODE_ENV === "production") {
    return process.env.VERCEL_ENV === "preview" ? "preview" : "production";
  }
  if (process.env.NODE_ENV === "test") return "test";
  return "development";
}

/**
 * event_id déterministe en forme UUID à partir d'une clé stable (ex:
 * `payment-succeeded:<stripe_event_id>`). Jamais aléatoire — un rejeu produit le même id, donc
 * la contrainte unique DB absorbe le doublon. Hache l'identifiant brut : sa valeur n'est jamais
 * stockée en clair, seule sa forme UUID dérivée l'est.
 */
export function deterministicEventId(stableKey: string): string {
  const h = createHash("sha256").update(stableKey, "utf8").digest("hex").slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Tranche de montant bornée — jamais le montant exact, jamais une valeur saisie par
 * l'utilisateur. Utilisée pour les événements de paiement/checkout afin de ne pas exposer le
 * montant précis dans un événement analytique. Buckets alignés sur les prix pays connus
 * (449 EUR / 499 CHF) sans jamais coder le prix lui-même comme donnée analytique.
 */
export function amountBucket(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined || !Number.isFinite(minorUnits)) return "unknown";
  if (minorUnits <= 0) return "zero";
  if (minorUnits < 10000) return "lt_100";
  if (minorUnits < 50000) return "100_to_500";
  if (minorUnits < 100000) return "500_to_1000";
  return "gte_1000";
}

const CURRENCY_RE = /^[A-Za-z]{3}$/;
const COUNTRY_RE = /^[A-Za-z]{2}$/;

export interface ServerEventInput {
  eventName: CanonicalAnalyticsEventName;
  /** Clé stable pour l'idempotence (sera hachée en event_id). */
  stableKey: string;
  trustLevel: Extract<AnalyticsTrustLevel, "SERVER_ACCEPTED" | "SERVER_PERSISTED" | "SERVER_CONFIRMED" | "PAYMENT_PROVIDER_CONFIRMED">;
  occurredAtIso?: string;
  countryCode?: string | null;
  currency?: string | null;
  amountMinor?: number | null;
  /** Attribution Partner DÉJÀ résolue côté serveur — jamais un partner_id client. */
  partnerAttributionId?: string | null;
  authenticatedUserId?: string | null; // uuid uniquement ; jamais un email
  // Corrélation : visitor/session D'ORIGINE résolus serveur (cookies signés ou table de liaison),
  // jamais un id libre client. Permettent d'attribuer la vérité serveur au parcours visiteur.
  visitorId?: string | null;
  sessionId?: string | null;
  extraProperties?: CanonicalAnalyticsProperties;
}

const UUID_ANY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ServerEventResult {
  ok: boolean;
  outcome?: "inserted" | "duplicate";
  reason?: string;
}

/**
 * Persiste UN événement de vérité serveur, de façon idempotente et best-effort.
 * - Rejette (sans jeter) tout événement non server-only : un événement client-émissible ne doit
 *   jamais être créé par cette voie serveur (séparation stricte des sources de vérité).
 * - N'inclut jamais de PII : les propriétés passent par l'allowlist stricte du schéma.
 * - N'écrit jamais de montant exact : seul `amountBucket` (tranche) entre dans les propriétés.
 */
export async function recordCanonicalServerEvent(
  db: SqlExecutor,
  input: ServerEventInput,
): Promise<ServerEventResult> {
  // Seuls les événements server-only OU les conversions serveur-authoritative passent ici.
  // (checkout_session_created est SERVER_CONFIRMED et server-only ; les paiements aussi.)
  if (!isServerOnlyCanonicalEvent(input.eventName)) {
    return { ok: false, reason: "NOT_A_SERVER_EVENT" };
  }

  const authUser = input.authenticatedUserId && isUuid(input.authenticatedUserId) ? input.authenticatedUserId : null;
  const country = input.countryCode && COUNTRY_RE.test(input.countryCode) ? input.countryCode.toUpperCase() : null;

  const props: CanonicalAnalyticsProperties = { ...(input.extraProperties ?? {}) };
  if (input.currency && CURRENCY_RE.test(input.currency)) props.currency = input.currency.toUpperCase();
  if (input.amountMinor !== undefined) props.amountBucket = amountBucket(input.amountMinor);
  if (country) props.country = country;

  try {
    const outcome = await insertAnalyticsEvent(db, {
      schemaVersion: 1,
      eventId: deterministicEventId(input.stableKey),
      eventName: input.eventName,
      occurredAt: input.occurredAtIso ?? new Date().toISOString(),
      source: input.trustLevel === "PAYMENT_PROVIDER_CONFIRMED" ? "stripe" : "server",
      trustLevel: input.trustLevel,
      visitorId: input.visitorId && UUID_ANY_RE.test(input.visitorId) ? input.visitorId : null,
      sessionId: input.sessionId && UUID_ANY_RE.test(input.sessionId) ? input.sessionId : null,
      receivedAt: new Date().toISOString(),
      environment: resolveAnalyticsEnvironment(),
      trafficClass: "external",
      authenticatedUserId: authUser,
      countryCode: country,
      sourceChannel: input.partnerAttributionId ? "partner" : null,
      campaignKey: null,
      partnerAttributionId: input.partnerAttributionId ?? null,
      consentState: "unknown",
      properties: sanitizeCanonicalProperties(props),
    });
    return { ok: true, outcome };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.name : "unknown" };
  }
}

// ── Écriture best-effort STRICTEMENT BORNÉE dans le temps (Phase E) ────────────
// Garantit qu'une écriture analytics ne peut JAMAIS retarder indéfiniment le chemin métier :
// l'opération est bornée par un timeout (défaut configurable). Ne jette jamais. En serverless,
// on n'utilise PAS un fire-and-forget non garanti : on attend, mais avec une borne dure.

export type BestEffortOutcome = "inserted" | "duplicate" | "unavailable" | "timeout" | "rejected";

/** Délai maximal d'une écriture analytics avant abandon (ms), configurable. */
export function analyticsWriteTimeoutMs(): number {
  const raw = Number(process.env.ANALYTICS_WRITE_TIMEOUT_MS ?? 500);
  return Number.isFinite(raw) && raw > 0 ? raw : 500;
}

/**
 * Exécute une opération d'écriture analytics avec une durée maximale bornée. Retourne un résultat
 * fermé et observable, jamais une exception. Un dépassement de délai rend `"timeout"` immédiatement
 * (l'opération sous-jacente peut continuer en arrière-plan sans jamais bloquer l'appelant).
 */
export async function boundedAnalyticsWrite(
  op: () => Promise<{ ok: boolean; outcome?: "inserted" | "duplicate"; reason?: string }>,
  timeoutMs: number = analyticsWriteTimeoutMs(),
): Promise<BestEffortOutcome> {
  const TIMEOUT = Symbol("analytics_timeout");
  let timer: ReturnType<typeof setTimeout> | undefined;
  // L'opération est toujours gérée (try/catch interne) — jamais de rejet non capturé même si le
  // timeout gagne la course. Un throw/reject est marqué distinctement de "storage unavailable".
  const guarded = (async () => {
    try {
      return await op();
    } catch {
      return { ok: false as const, reason: "THREW" };
    }
  })();
  try {
    const timeoutP = new Promise<typeof TIMEOUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
      if (typeof timer === "object" && timer && "unref" in timer) (timer as { unref: () => void }).unref();
    });
    const result = await Promise.race([guarded, timeoutP]);
    if (result === TIMEOUT) return "timeout";
    if (result.ok) return result.outcome === "duplicate" ? "duplicate" : "inserted";
    if (result.reason === "THREW" || result.reason === "NOT_A_SERVER_EVENT") return "rejected";
    return "unavailable";
  } catch {
    return "rejected";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Écrit un événement de vérité serveur canonique, borné dans le temps et best-effort.
 * Acquiert la DB analytics ET écrit, le tout sous une seule borne de temps — de sorte qu'une
 * base injoignable ou lente ne puisse jamais retarder le métier au-delà du timeout.
 */
export async function recordCanonicalServerEventBestEffort(
  getDb: () => Promise<SqlExecutor | null>,
  input: ServerEventInput,
  timeoutMs?: number,
): Promise<BestEffortOutcome> {
  return boundedAnalyticsWrite(async () => {
    const db = await getDb();
    if (!db) return { ok: false, reason: "STORAGE_UNAVAILABLE" };
    return recordCanonicalServerEvent(db, input);
  }, timeoutMs);
}
