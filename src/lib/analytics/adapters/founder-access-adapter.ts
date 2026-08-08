// Adaptateur additif : traduit les vérités serveur déjà durables de founder-access
// (clonestore_founder_funnel_events, SERVER_FUNNEL_EVENTS) vers le contrat canonique.
// Ne modifie, ne lit, ni n'écrit jamais dans les tables founder-access existantes — prend en
// entrée les données déjà résolues par ce système, ne duplique aucune logique métier.
//
// STATUT : construit et testé isolément dans ce bloc. PAS ENCORE appelé depuis
// src/app/api/webhooks/stripe/route.ts (fichier protégé, "correction minimale nécessitant
// preuve + tests Payment Path complets + nouveau build + justification" — reporté à un futur
// bloc dédié à cette intégration spécifique plutôt que risqué dans cette fermeture déjà très
// large). Voir ANALYTICS_LEGACY_MIGRATION_MATRIX.md et ANALYTICS_REMAINING_RISKS.md.

import { createHash } from "node:crypto";
import type { SqlExecutor } from "@/lib/pierre/v1/sql";
import type { CanonicalAnalyticsEventName, AnalyticsTrustLevel, AnalyticsEnvironment, AnalyticsTrafficClass } from "../schema";
import { insertAnalyticsEvent } from "../store";

const FOUNDER_TO_CANONICAL: Partial<Record<string, CanonicalAnalyticsEventName>> = {
  founder_reservation_created: "reservation_created",
  founder_email_verified: "reservation_email_confirmed",
  founder_payment_completed: "payment_succeeded",
  founder_subscription_active: "activation_completed",
};

// Niveau de confiance canonique par événement founder (aligné sur CANONICAL_FUNNEL_DEFINITION) :
// une réservation écrite en base = SERVER_PERSISTED ; un email confirmé = SERVER_CONFIRMED ;
// paiement/activation confirmés par Stripe = PAYMENT_PROVIDER_CONFIRMED.
const FOUNDER_TRUST: Record<string, AnalyticsTrustLevel> = {
  founder_reservation_created: "SERVER_PERSISTED",
  founder_email_verified: "SERVER_CONFIRMED",
  founder_payment_completed: "PAYMENT_PROVIDER_CONFIRMED",
  founder_subscription_active: "PAYMENT_PROVIDER_CONFIRMED",
};

export interface FounderServerEventInput {
  eventId: string; // déterministe, dérivé de l'identifiant founder-access (ex: `founder:${reservationId}:${eventName}`), jamais aléatoire — un rejeu ne doit jamais créer un doublon
  founderEventName: keyof typeof FOUNDER_TO_CANONICAL;
  occurredAtIso: string;
  reservationId: string;
  environment: AnalyticsEnvironment;
  stripeEventId?: string | null; // présent pour les événements PAYMENT_PROVIDER_CONFIRMED
  // Corrélation d'origine (résolue serveur : cookies signés ou table de liaison), jamais client.
  visitorId?: string | null;
  sessionId?: string | null;
  authenticatedUserId?: string | null;
  partnerAttributionId?: string | null;
  // Classification du trafic pour la vérité serveur émise. Défaut "external" (vraie conversion).
  // "test" UNIQUEMENT pour un parcours QA authentifié serveur (jamais dérivé d'un signal client) —
  // permet d'isoler une réservation QA synthétique du funnel propriétaire.
  trafficClass?: AnalyticsTrafficClass;
}

const CORR_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asCorrUuid = (v: string | null | undefined): string | null => (v && CORR_UUID_RE.test(v) ? v : null);

/**
 * Traduit et persiste un événement founder-access déjà confirmé serveur vers la table
 * canonique. Best-effort : toute erreur est avalée (ne doit jamais casser le chemin d'appel
 * founder-access qui l'invoquerait), retournée pour observabilité plutôt que jetée.
 */
export async function bridgeFounderServerEvent(
  db: SqlExecutor,
  input: FounderServerEventInput,
): Promise<{ ok: boolean; outcome?: "inserted" | "duplicate"; reason?: string }> {
  const canonicalName = FOUNDER_TO_CANONICAL[input.founderEventName];
  if (!canonicalName) return { ok: false, reason: "NOT_MAPPED" };

  // Confiance par événement (contrat) ; un stripeEventId force PAYMENT_PROVIDER_CONFIRMED.
  const trustLevel: AnalyticsTrustLevel = input.stripeEventId
    ? "PAYMENT_PROVIDER_CONFIRMED"
    : (FOUNDER_TRUST[input.founderEventName] ?? "SERVER_CONFIRMED");

  try {
    const outcome = await insertAnalyticsEvent(db, {
      schemaVersion: 1,
      eventId: input.eventId,
      eventName: canonicalName,
      occurredAt: input.occurredAtIso,
      source: "server",
      trustLevel,
      visitorId: asCorrUuid(input.visitorId),
      sessionId: asCorrUuid(input.sessionId),
      receivedAt: new Date().toISOString(),
      environment: input.environment,
      trafficClass: input.trafficClass ?? "external",
      authenticatedUserId: asCorrUuid(input.authenticatedUserId),
      countryCode: null,
      sourceChannel: input.partnerAttributionId ? "partner" : null,
      campaignKey: null,
      partnerAttributionId: input.partnerAttributionId ?? null,
      consentState: "unknown",
      properties: {},
    });
    return { ok: true, outcome };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.name : "unknown" };
  }
}

/**
 * Classe de trafic SERVEUR-AUTORITAIRE pour les événements AVAL d'une réservation (email confirmé,
 * activation…). Dérivée de la vérité `reservation_created` DÉJÀ persistée : une réservation QA
 * synthétique (créée via le secret QA serveur) a son `reservation_created` classé `test` ; une vraie
 * réservation `external`. Le client ne peut JAMAIS transformer son trafic — la valeur est lue depuis
 * une ligne écrite par le serveur, jamais depuis un signal de requête. Fail-open vers `external`
 * (ne jamais masquer par accident une vraie conversion).
 */
export async function resolveReservationTrafficClass(
  db: SqlExecutor,
  reservationId: string,
  environment: AnalyticsEnvironment,
): Promise<AnalyticsTrafficClass> {
  try {
    const eventId = founderEventIdFor(reservationId, "founder_reservation_created");
    const { rows } = await db.query<{ traffic_class: string }>(
      "select traffic_class from clonestore_analytics_events_v1 where event_id = $1 and environment = $2 and event_name = 'reservation_created' limit 1",
      [eventId, environment],
    );
    return rows[0]?.traffic_class === "test" ? "test" : "external";
  } catch {
    return "external";
  }
}

/** Construit un event_id déterministe (UUID-v4-forme) pour un événement founder-access donné —
 *  jamais aléatoire, garantit qu'un rejeu de la même écriture founder-access ne crée jamais un
 *  doublon canonique (même entrée ⇒ même event_id ⇒ conflit unique absorbé par la DB). */
export function founderEventIdFor(reservationId: string, founderEventName: string): string {
  const digest = createHash("sha256").update(`${reservationId}:${founderEventName}`, "utf8").digest("hex");
  // 32 hex digits nécessaires pour un UUID (8-4-4-4-12) ; sha256 en fournit 64, on prend les 32
  // premiers et on force les nibbles de version/variante pour rester un UUID valide au sens de
  // notre propre validateur (isUuid), sans prétendre à une vraie conformité RFC4122 v4 aléatoire
  // (déterministe par construction, ce qui est l'exigence ici, pas l'aléa).
  const h = digest.slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
