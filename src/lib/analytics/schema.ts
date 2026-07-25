// Analytics, Funnel and Launch Measurement Closure — contrat canonique d'événement v1.
// Enveloppe fermée, versionnée. Toute évolution future crée v2 ; ce fichier ne change jamais
// de sémantique une fois publié. Voir audit-20260723-full/ANALYTICS_EVENT_SCHEMA_V1.md et
// audit-20260723-full/CANONICAL_FUNNEL_DEFINITION.md.

export const SCHEMA_VERSION = 1 as const;

export const CANONICAL_EVENT_NAMES = [
  "visitor_created",
  "session_started",
  "page_viewed",
  "homepage_demo_prompt_seen",
  "homepage_demo_prompt_clicked",
  "homepage_demo_prompt_dismissed",
  "demo_started",
  "demo_completed",
  "demo_pierre_reveal_viewed",
  "discover_pierre_clicked",
  "product_demo_clicked",
  "pierre_demo_started",
  "pierre_demo_step_completed",
  "pierre_demo_completed",
  "reservation_cta_clicked",
  "reservation_form_started",
  "reservation_submitted",
  "reservation_created",
  "reservation_email_confirmed",
  "activation_started",
  "activation_completed",
  "checkout_started",
  "checkout_session_created",
  "checkout_failed",
  "payment_succeeded",
  "payment_failed",
  "payment_refunded",
  "guided_tour_started",
  "guided_tour_step_completed",
  "guided_tour_completed",
  "guided_tour_skipped",
] as const;
export type CanonicalAnalyticsEventName = (typeof CANONICAL_EVENT_NAMES)[number];

export function isCanonicalEventName(value: string): value is CanonicalAnalyticsEventName {
  return (CANONICAL_EVENT_NAMES as readonly string[]).includes(value);
}

// Événements qu'un client ne peut JAMAIS créer comme vérité finale — le serveur les rejette
// s'ils arrivent sur l'endpoint public d'ingestion. Insérés uniquement par du code serveur
// (adaptateurs, webhook Stripe signé).
export const SERVER_ONLY_CANONICAL_EVENTS = [
  "visitor_created",
  "session_started",
  "reservation_created",
  "reservation_email_confirmed",
  "checkout_session_created",
  "activation_completed",
  "payment_succeeded",
  "payment_failed",
  "payment_refunded",
] as const satisfies readonly CanonicalAnalyticsEventName[];
const SERVER_ONLY_SET: ReadonlySet<string> = new Set(SERVER_ONLY_CANONICAL_EVENTS);
export function isServerOnlyCanonicalEvent(name: string): boolean {
  return SERVER_ONLY_SET.has(name);
}

export const TRUST_LEVELS = [
  "CLIENT_OBSERVED",
  "SERVER_ACCEPTED",
  "SERVER_PERSISTED",
  "SERVER_CONFIRMED",
  "PAYMENT_PROVIDER_CONFIRMED",
] as const;
export type AnalyticsTrustLevel = (typeof TRUST_LEVELS)[number];
export function isTrustLevel(value: string): value is AnalyticsTrustLevel {
  return (TRUST_LEVELS as readonly string[]).includes(value);
}

export const EVENT_SOURCES = ["web", "server", "stripe", "system"] as const;
export type AnalyticsEventSource = (typeof EVENT_SOURCES)[number];

export const ENVIRONMENTS = ["production", "preview", "development", "test"] as const;
export type AnalyticsEnvironment = (typeof ENVIRONMENTS)[number];

export const TRAFFIC_CLASSES = ["external", "internal", "test", "automated", "unknown"] as const;
export type AnalyticsTrafficClass = (typeof TRAFFIC_CLASSES)[number];

export const CONSENT_STATES = ["unknown", "necessary_only", "all"] as const;
export type AnalyticsConsentState = (typeof CONSENT_STATES)[number];

// Routes canoniques normalisées — jamais une URL brute avec query string libre.
export const CANONICAL_ROUTE_KEYS = [
  "/",
  "/demo",
  "/demo/pierre",
  "/agents/pierre",
  "/reserver/pierre",
  "/activate/pierre",
  "/checkout",
  "/signup",
  "/questions",
  "/partenaires",
  "/paiement/success",
  "PRIVATE_ROUTE_REDACTED",
] as const;
export type CanonicalRouteKey = (typeof CANONICAL_ROUTE_KEYS)[number];

// Propriétés fermées — allowlist stricte, jamais Record<string, unknown> public.
// Chaque clé a un type et, si applicable, un ensemble de valeurs bornées.
export const CANONICAL_PROPERTY_KEYS = [
  "demoType", // "demo" | "demo_pierre"
  "sectionKey", // section de démo bornée (ex: "problem" | "category" | "cost" ...)
  "ctaKey", // identifiant fermé de CTA
  "tourId", // identifiant fermé de tour guidé
  "failureReason", // raison d'échec bornée, jamais un message libre
  "amountBucket", // tranche de montant bornée, jamais un montant exact saisi par l'utilisateur
  "currency", // ISO 4217, 3 lettres
  "country", // ISO 3166-1 alpha-2
  "device", // "mobile" | "tablet" | "desktop"
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
] as const;
export type CanonicalPropertyKey = (typeof CANONICAL_PROPERTY_KEYS)[number];
const PROPERTY_KEY_SET: ReadonlySet<string> = new Set(CANONICAL_PROPERTY_KEYS);

export type CanonicalAnalyticsProperties = Partial<Record<CanonicalPropertyKey, string | number | boolean>>;

const MAX_PROPERTY_STRING_LENGTH = 64;
const MAX_PROPERTIES_COUNT = 15;

/**
 * Filtre un objet de propriétés candidat vers uniquement les clés/valeurs autorisées.
 * Toute clé non allowlistée est silencieusement retirée (jamais rejetée en bloquant l'appelant,
 * cohérent avec le principe "l'analytics ne doit jamais casser l'expérience" déjà établi par
 * founder-access). Les valeurs texte trop longues sont tronquées, jamais stockées en clair au-delà
 * de la borne — défense contre l'injection de texte libre/PII dans une propriété autorisée.
 */
export function sanitizeCanonicalProperties(input: unknown): CanonicalAnalyticsProperties {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return {};
  const out: CanonicalAnalyticsProperties = {};
  let count = 0;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_PROPERTIES_COUNT) break;
    if (!PROPERTY_KEY_SET.has(key)) continue;
    if (typeof value === "string") {
      if (value.length === 0) continue;
      out[key as CanonicalPropertyKey] = value.slice(0, MAX_PROPERTY_STRING_LENGTH);
      count++;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key as CanonicalPropertyKey] = value;
      count++;
    } else if (typeof value === "boolean") {
      out[key as CanonicalPropertyKey] = value;
      count++;
    }
  }
  return out;
}

/** Enveloppe canonique v1 telle que produite/acceptée côté client, avant enrichissement serveur. */
export interface AnalyticsEventEnvelopeV1 {
  schemaVersion: 1;
  eventId: string;
  eventName: CanonicalAnalyticsEventName;
  occurredAt: string;
  source: AnalyticsEventSource;
  pageViewId?: string;
  demoRunId?: string;
  routeKey?: CanonicalRouteKey;
  stepId?: string;
  properties?: CanonicalAnalyticsProperties;
}

/** Enveloppe enrichie côté serveur — jamais construite ni acceptée depuis le client. */
export interface AnalyticsServerEnrichedEvent extends AnalyticsEventEnvelopeV1 {
  trustLevel: AnalyticsTrustLevel;
  visitorId: string | null;
  sessionId: string | null;
  receivedAt: string;
  environment: AnalyticsEnvironment;
  trafficClass: AnalyticsTrafficClass;
  authenticatedUserId: string | null;
  countryCode: string | null;
  sourceChannel: string | null;
  campaignKey: string | null;
  partnerAttributionId: string | null;
  consentState: AnalyticsConsentState;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const MAX_STEP_ID_LENGTH = 64;
const STEP_ID_RE = /^[a-zA-Z0-9_:.-]{1,64}$/;

export type EnvelopeValidationError =
  | "INVALID_SCHEMA_VERSION"
  | "INVALID_EVENT_ID"
  | "UNKNOWN_EVENT_NAME"
  | "SERVER_ONLY_EVENT_REJECTED"
  | "INVALID_OCCURRED_AT"
  | "INVALID_SOURCE"
  | "INVALID_PAGE_VIEW_ID"
  | "INVALID_DEMO_RUN_ID"
  | "INVALID_ROUTE_KEY"
  | "INVALID_STEP_ID";

export interface EnvelopeValidationResult {
  ok: boolean;
  error?: EnvelopeValidationError;
  envelope?: AnalyticsEventEnvelopeV1;
}

/**
 * Valide un événement soumis par le client à l'endpoint canonique d'ingestion.
 * Rejette activement (pas de silencieux) tout ce qui sort du contrat fermé : nom inconnu,
 * événement server-only, identifiants mal formés, date implausible, route non normalisée.
 */
export function validateClientEnvelope(input: unknown): EnvelopeValidationResult {
  if (input === null || typeof input !== "object") return { ok: false, error: "INVALID_EVENT_ID" };
  const body = input as Record<string, unknown>;

  if (body.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: "INVALID_SCHEMA_VERSION" };
  if (!isUuid(body.eventId)) return { ok: false, error: "INVALID_EVENT_ID" };
  if (typeof body.eventName !== "string" || !isCanonicalEventName(body.eventName)) {
    return { ok: false, error: "UNKNOWN_EVENT_NAME" };
  }
  if (isServerOnlyCanonicalEvent(body.eventName)) return { ok: false, error: "SERVER_ONLY_EVENT_REJECTED" };
  if (typeof body.occurredAt !== "string" || Number.isNaN(Date.parse(body.occurredAt))) {
    return { ok: false, error: "INVALID_OCCURRED_AT" };
  }
  if (body.source !== "web") return { ok: false, error: "INVALID_SOURCE" }; // le client ne peut prétendre être autre chose que "web"
  if (body.pageViewId !== undefined && !isUuid(body.pageViewId)) return { ok: false, error: "INVALID_PAGE_VIEW_ID" };
  if (body.demoRunId !== undefined && !isUuid(body.demoRunId)) return { ok: false, error: "INVALID_DEMO_RUN_ID" };
  if (body.routeKey !== undefined && !(CANONICAL_ROUTE_KEYS as readonly string[]).includes(body.routeKey as string)) {
    return { ok: false, error: "INVALID_ROUTE_KEY" };
  }
  if (body.stepId !== undefined && (typeof body.stepId !== "string" || !STEP_ID_RE.test(body.stepId) || body.stepId.length > MAX_STEP_ID_LENGTH)) {
    return { ok: false, error: "INVALID_STEP_ID" };
  }

  const envelope: AnalyticsEventEnvelopeV1 = {
    schemaVersion: SCHEMA_VERSION,
    eventId: body.eventId as string,
    eventName: body.eventName as CanonicalAnalyticsEventName,
    occurredAt: body.occurredAt as string,
    source: "web",
    pageViewId: body.pageViewId as string | undefined,
    demoRunId: body.demoRunId as string | undefined,
    routeKey: body.routeKey as CanonicalRouteKey | undefined,
    stepId: body.stepId as string | undefined,
    properties: sanitizeCanonicalProperties(body.properties),
  };
  return { ok: true, envelope };
}
