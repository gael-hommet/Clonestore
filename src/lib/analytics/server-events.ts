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
  extraProperties?: CanonicalAnalyticsProperties;
}

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
      visitorId: null,
      sessionId: null,
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
