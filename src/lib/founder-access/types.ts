// Phase E — Founder Access : types du domaine commercial.

export const COMPANY_SIZES = ["1-49", "50-249", "250-999", "1000+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

/** Nature du domaine email — non bloquante, sert à la qualification interne. */
export type EmailDomainType = "professional" | "personal" | "role_based" | "disposable" | "unknown";

/** Machine d'état stricte de la réservation. */
export const RESERVATION_STATUSES = [
  "started",
  "email_to_confirm",
  "confirmed",
  "qualified",
  "strong_intent",
  "activation_sent",
  "activation_started",
  "active_client",
  "expired",
  "unsubscribed",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Relation commerciale persistée (§3.5) — distincte de la machine d'état réservation. */
export const CONTACT_STATUSES = [
  "not_requested",
  "requested",
  "to_contact",
  "contacted",
  "follow_up",
  "converted",
  "closed",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export interface ReservationStep1 {
  email: string;
  company_name: string;
  company_size: CompanySize;
  /** Honeypot — doit rester vide. */
  website_hp?: string;
}

export interface ReservationStep2 {
  full_name?: string;
  role?: string;
  primary_hr_need?: string;
  sector?: string;
  website?: string;
  phone?: string;
  contact_requested?: boolean;
}

// ── Séparation stricte des taxonomies (E-R1 §3) ─────────────────────────────
// Ce que le NAVIGATEUR a le droit d'émettre (ingestion publique). Aucun événement
// de vérité serveur ici : réservation, confirmation, paiement, abonnement sont
// exclusivement produits côté serveur (store / webhook Stripe).
export const CLIENT_ANALYTICS_EVENTS = [
  "site_viewed",
  "demo_viewed",
  "demo_started",
  "demo_scene_viewed",
  "demo_completed",
  "pierre_demo_started",
  "pierre_demo_completed",
  "founder_cta_viewed",
  "founder_cta_clicked",
  "founder_form_viewed",
  "founder_form_step1_started",
  "founder_form_step1_completed",
  "founder_form_step2_viewed",
  "founder_form_step2_completed",
  "founder_form_step2_failed",
  "founder_activation_viewed",
  "founder_activation_started",
  "founder_checkout_started",
  "founder_checkout_failed",
] as const;
export type ClientAnalyticsEvent = (typeof CLIENT_ANALYTICS_EVENTS)[number];

// Événements de VÉRITÉ SERVEUR uniquement. Une route publique doit les REFUSER ;
// ils ne sont insérés que par le code serveur (store, worker, webhook Stripe).
export const SERVER_FUNNEL_EVENTS = [
  "founder_reservation_created",
  "founder_qualification_completed",
  "founder_qualification_partial_failed",
  "founder_verification_sent",
  "founder_verification_resent",
  "founder_email_verified",
  "founder_unsubscribed",
  "founder_contact_requested",
  "founder_payment_completed",
  "founder_subscription_active",
  "founder_subscription_canceled",
  "founder_subscription_past_due",
] as const;
export type ServerFunnelEvent = (typeof SERVER_FUNNEL_EVENTS)[number];

/** Union (lecture seule : funnel agrégé). Jamais utilisée pour valider une ingestion. */
export const FOUNDER_FUNNEL_EVENTS = [...CLIENT_ANALYTICS_EVENTS, ...SERVER_FUNNEL_EVENTS] as const;
export type FounderFunnelEvent = ClientAnalyticsEvent | ServerFunnelEvent;

/** Alias historique : la liste blanche d'ingestion web = événements CLIENT uniquement. */
export const ANALYTICS_EVENTS = CLIENT_ANALYTICS_EVENTS;
export type AnalyticsEvent = ClientAnalyticsEvent;

export const DEVICE_CATEGORIES = ["mobile", "tablet", "desktop", "unknown"] as const;
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];
