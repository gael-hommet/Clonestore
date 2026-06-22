// BLOC 3 — Snapshot du contrat LeadForge.
//
// Ce fichier matérialise dans CloneStore (TypeScript) le contrat de conversion
// défini dans le dépôt LeadForge à l'état FIGÉ ci-dessous. Il NE doit pas être
// modifié sans nouvelle version explicite : un test de parité (`contract.test.ts`)
// échoue dès qu'un champ change sans bumper `contract_version` + recalculer
// `contract_fingerprint`.
//
// Toute évolution amont (LeadForge) doit donc :
//   1) bumper `contract_version`
//   2) recalculer le fingerprint via `computeContractFingerprint()`
//   3) corriger les tests de parité
//
// Le prix Pierre central reste `EXPECTED_PIERRE_PRICE_AMOUNT` (44900 cts) défini
// dans `src/lib/billing/stripe-activation.ts` — seule source canonique en runtime.
// Ce contrat le rappelle uniquement à des fins de parité.

import { createHash } from "node:crypto";

// ── Identité contractuelle ─────────────────────────────────────────────────
export const LEADFORGE_COMMIT = "db9b166" as const;
export const CONTRACT_VERSION = "1.0.0" as const;
export const FUNNEL_VERSION = "v1" as const;
export const LANDING_VERSION = "v1" as const;
export const DEMO_VERSION = "v1" as const;
export const DIAGNOSTIC_VERSION = "v1" as const;
export const CHECKOUT_METADATA_VERSION = "v1" as const;

// ── Prix Pierre (rappel — vérité = stripe-activation.ts) ────────────────────
export const PIERRE_PRICE_EUR = 449 as const;
export const PIERRE_PRICE_AMOUNT_CENTS = 44900 as const;
export const PIERRE_PRICE_CURRENCY = "eur" as const;
export const PIERRE_PRICE_INTERVAL = "month" as const;

// ── Variantes ───────────────────────────────────────────────────────────────
export const VARIANT_IDS = [
  "VARIANT_DEPARTMENT_OUTCOME",
  "VARIANT_PROOF_FIRST",
] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

// Visiteurs organiques (sans token) — variante neutre, jamais inventée.
export const ORGANIC_VARIANT_ID = "VARIANT_ORGANIC" as const;

// ── Cohorts LeadForge ───────────────────────────────────────────────────────
export const COHORT_IDS = [
  "COHORT_DIRECT_A",
  "COHORT_DIRECT_B",
  "COHORT_GATEWAY_A",
  "COHORT_GATEWAY_B",
] as const;
export type CohortId = (typeof COHORT_IDS)[number];

export const CONTACT_KINDS = ["DIRECT", "GATEWAY"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

// ── Claim ids (de LeadForge — statut audité dans claims-registry.ts) ───────
export const CLAIM_IDS = [
  "pierre_is_role",
  "human_validation",
  "traceability",
  "company_adaptation",
  "recurring_work",
  "pierre_price_449",
] as const;
export type ClaimId = (typeof CLAIM_IDS)[number];

// ── Événements (allowlist serveur+client, voir conversion-events.ts) ───────
export const EVENT_IDS = [
  "variant_assigned",
  "landing_viewed",
  "demo_started",
  "demo_step_viewed",
  "demo_completed",
  "diagnostic_started",
  "diagnostic_step_completed",
  "diagnostic_completed",
  "result_viewed",
  "purchase_cta_clicked",
  "assistance_cta_clicked",
  "checkout_started",
  "checkout_completed",
  "checkout_failed",
  "meeting_started",
  "meeting_booked",
  "onboarding_started",
  "onboarding_completed",
  "pierre_activated",
] as const;
export type EventId = (typeof EVENT_IDS)[number];

// Événements émis UNIQUEMENT par le serveur (jamais acceptés depuis le navigateur).
export const SERVER_ONLY_EVENT_IDS: ReadonlySet<EventId> = new Set<EventId>([
  "variant_assigned",
  "checkout_started",
  "checkout_completed",
  "checkout_failed",
  "onboarding_started",
  "onboarding_completed",
  "pierre_activated",
  "meeting_booked",
]);

// Événements client autorisés (allowlist stricte pour /api/conversion/events).
export const CLIENT_ALLOWED_EVENT_IDS: ReadonlySet<EventId> = new Set<EventId>(
  EVENT_IDS.filter((id) => !SERVER_ONLY_EVENT_IDS.has(id)),
);

// ── Metadata Checkout — clés autorisées dans Stripe metadata ────────────────
export const CHECKOUT_METADATA_KEYS = [
  "user_id",
  "agent_slug",
  "order_id",
  "tenant_id",
  "founder_reservation_id",
  "conversion_session_id",
  "conversion_token_id",
  "conversion_variant",
  "conversion_campaign",
  "conversion_cohort",
  "funnel_version",
] as const;
export type CheckoutMetadataKey = (typeof CHECKOUT_METADATA_KEYS)[number];

// Clés serveur autorisées à passer dans la metadata — pas de bearer/PII ici.
export const FORBIDDEN_METADATA_PATTERNS: readonly RegExp[] = [
  /token$/i,
  /secret$/i,
  /password/i,
  /email/i,
  /siren/i,
  /authorization/i,
];

// ── Schéma diagnostic RH (v1) — 8 questions max ─────────────────────────────
export interface DiagnosticQuestionSchema {
  id: string;
  kind: "single" | "number_range" | "multi_chip";
  required: boolean;
}

export const DIAGNOSTIC_QUESTIONS: readonly DiagnosticQuestionSchema[] = [
  { id: "headcount", kind: "single", required: true },
  { id: "rh_team_size", kind: "single", required: true },
  { id: "monthly_hires", kind: "number_range", required: true },
  { id: "monthly_onboardings", kind: "number_range", required: true },
  { id: "recurring_ops_volume", kind: "single", required: true },
  { id: "current_tools", kind: "multi_chip", required: false },
  { id: "autonomy_target", kind: "single", required: true },
  { id: "validation_requirements", kind: "single", required: true },
] as const;

// Aucune donnée sensible — interdites au payload diagnostic (validées côté serveur).
export const DIAGNOSTIC_FORBIDDEN_FIELDS = [
  "name",
  "first_name",
  "last_name",
  "cv",
  "salary",
  "salary_individual",
  "health",
  "absence_individual",
  "disciplinary",
  "sanction",
  "employee_document",
  "siren",
  "email",
] as const;

// ── Empreinte (fingerprint) du contrat ──────────────────────────────────────
//
// Le fingerprint est dérivé déterministiquement d'un objet stable. Toute
// modification d'un champ contractuel change le hash → le test de parité
// échoue → un opérateur doit explicitement bumper la version. C'est le
// "fail loud" cross-repo.

export interface ContractSnapshot {
  leadforge_commit: string;
  contract_version: string;
  funnel_version: string;
  landing_version: string;
  demo_version: string;
  diagnostic_version: string;
  checkout_metadata_version: string;
  price: { eur: number; amount_cents: number; currency: string; interval: string };
  variants: readonly string[];
  cohorts: readonly string[];
  contact_kinds: readonly string[];
  claims: readonly string[];
  events: readonly string[];
  server_only_events: readonly string[];
  client_allowed_events: readonly string[];
  checkout_metadata_keys: readonly string[];
  diagnostic_questions: readonly { id: string; kind: string; required: boolean }[];
  diagnostic_forbidden_fields: readonly string[];
}

export function buildContractSnapshot(): ContractSnapshot {
  return {
    leadforge_commit: LEADFORGE_COMMIT,
    contract_version: CONTRACT_VERSION,
    funnel_version: FUNNEL_VERSION,
    landing_version: LANDING_VERSION,
    demo_version: DEMO_VERSION,
    diagnostic_version: DIAGNOSTIC_VERSION,
    checkout_metadata_version: CHECKOUT_METADATA_VERSION,
    price: {
      eur: PIERRE_PRICE_EUR,
      amount_cents: PIERRE_PRICE_AMOUNT_CENTS,
      currency: PIERRE_PRICE_CURRENCY,
      interval: PIERRE_PRICE_INTERVAL,
    },
    variants: [...VARIANT_IDS, ORGANIC_VARIANT_ID].sort(),
    cohorts: [...COHORT_IDS].sort(),
    contact_kinds: [...CONTACT_KINDS].sort(),
    claims: [...CLAIM_IDS].sort(),
    events: [...EVENT_IDS].sort(),
    server_only_events: [...SERVER_ONLY_EVENT_IDS].sort(),
    client_allowed_events: [...CLIENT_ALLOWED_EVENT_IDS].sort(),
    checkout_metadata_keys: [...CHECKOUT_METADATA_KEYS].sort(),
    diagnostic_questions: DIAGNOSTIC_QUESTIONS.map((q) => ({ id: q.id, kind: q.kind, required: q.required })),
    diagnostic_forbidden_fields: [...DIAGNOSTIC_FORBIDDEN_FIELDS].sort(),
  };
}

// Hash SHA-256 hex stable du snapshot JSON canonique (clés triées).
export function computeContractFingerprint(snapshot: ContractSnapshot = buildContractSnapshot()): string {
  const canonical = JSON.stringify(snapshot, Object.keys(snapshot).sort());
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// Fingerprint figé — recalculé par le test de parité. À mettre à jour
// uniquement lorsqu'un bump de version contractuelle est explicite.
export const CONTRACT_FINGERPRINT_EXPECTED = "AUTO" as const;

// Erreur dédiée pour piloter les rapports adversariaux.
export class ContractParityError extends Error {
  readonly code: "CONTRACT_DRIFT" | "VARIANT_UNKNOWN" | "EVENT_UNKNOWN" | "CLAIM_UNKNOWN" | "PRICE_MISMATCH";
  constructor(code: ContractParityError["code"], message: string) {
    super(message);
    this.name = "ContractParityError";
    this.code = code;
  }
}

export function assertVariantId(id: string): asserts id is VariantId | typeof ORGANIC_VARIANT_ID {
  if (id !== ORGANIC_VARIANT_ID && !(VARIANT_IDS as readonly string[]).includes(id)) {
    throw new ContractParityError("VARIANT_UNKNOWN", `Variante inconnue: ${id}`);
  }
}

export function assertEventId(id: string): asserts id is EventId {
  if (!(EVENT_IDS as readonly string[]).includes(id)) {
    throw new ContractParityError("EVENT_UNKNOWN", `Événement inconnu: ${id}`);
  }
}

export function assertClaimId(id: string): asserts id is ClaimId {
  if (!(CLAIM_IDS as readonly string[]).includes(id)) {
    throw new ContractParityError("CLAIM_UNKNOWN", `Claim inconnue: ${id}`);
  }
}

// Vérité prix : exposée pour les tests de parité — mais le runtime
// (Checkout / webhook / lecture Stripe) lit EXPECTED_PIERRE_PRICE_AMOUNT
// dans src/lib/billing/stripe-activation.ts, et seulement là.
export function assertPriceParity(stripeActivationAmount: number): void {
  if (stripeActivationAmount !== PIERRE_PRICE_AMOUNT_CENTS) {
    throw new ContractParityError(
      "PRICE_MISMATCH",
      `Prix Pierre divergent : contrat=${PIERRE_PRICE_AMOUNT_CENTS} runtime=${stripeActivationAmount}`,
    );
  }
}
