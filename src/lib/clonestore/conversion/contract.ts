// BLOC 3 — Snapshot du contrat LeadForge à db9b166 (RÉEL).
//
// Source vérifiée par clone du commit `db9b166` dans
// `services/conversion/{contracts,clonestore_contract,events,claims,diagnostic,attribution}.py`.
// La fixture `fixtures/leadforge-contract-db9b166.json` a été générée DIRECTEMENT
// depuis ce code Python (script `export_fixture.py`) et sert de source indépendante
// pour le test de parité (cf. `__tests__/bloc3-contract.test.ts`).
//
// Tout drift fait échouer la parité — interdit de modifier ce fichier sans :
//   1) re-générer la fixture depuis LeadForge,
//   2) mettre à jour CONTRACT_FINGERPRINT_EXPECTED en valeur LITTÉRALE,
//   3) faire passer le test de parité.
//
// Le runtime prix Pierre = `EXPECTED_PIERRE_PRICE_AMOUNT` (44900) défini dans
// `src/lib/billing/stripe-activation.ts` — seule source canonique en runtime.

import { createHash } from "node:crypto";

// ── Identité contractuelle figée ───────────────────────────────────────────
export const LEADFORGE_COMMIT = "db9b166" as const;
export const FUNNEL_VERSION = "v0.1" as const;
export const LANDING_VERSION = "pierre-landing-v0.1" as const;
export const DEMO_VERSION = "pierre-demo-v0.1" as const;
export const DIAGNOSTIC_VERSION = "pierre-diagnostic-v0.1" as const;

// ── Prix Pierre (vérité = stripe-activation.ts) ────────────────────────────
export const PIERRE_PRICE_EUR = 449 as const;
export const PIERRE_PRICE_AMOUNT_CENTS = 44900 as const;
export const PIERRE_PRICE_LABEL = "449 €/mois" as const;
export const PIERRE_PRICE_CURRENCY = "eur" as const;
export const PIERRE_PRICE_INTERVAL = "month" as const;
export const CHECKOUT_MODE = "subscription" as const;

// ── Variantes (LeadForge `Variant` enum) ───────────────────────────────────
export const VARIANT_IDS = [
  "VARIANT_DEPARTMENT_OUTCOME",
  "VARIANT_PROOF_FIRST",
] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

// Variante neutre côté CloneStore pour visiteurs sans token — n'apparaît
// JAMAIS dans le contrat LeadForge. Seulement utilisée pour les sessions
// organiques côté serveur.
export const ORGANIC_VARIANT_ID = "VARIANT_ORGANIC" as const;

// Mapping variante → hero id (cf. clonestore_contract.py:VARIANT_HERO).
export const VARIANT_HERO: Record<VariantId, string> = {
  VARIANT_DEPARTMENT_OUTCOME: "hero_department_outcome",
  VARIANT_PROOF_FIRST: "hero_proof_first",
};

// ── ContactKind (LeadForge `ContactKind` enum) ─────────────────────────────
export const CONTACT_KINDS = ["DIRECT", "GATEWAY"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

// ── Claim ids (cf. claims.py:_SEED_CLAIMS) ─────────────────────────────────
export const CLAIM_IDS = [
  "company_adaptation",
  "demo_timing",
  "human_validation",
  "pierre_is_role",
  "price_monthly",
  "recurring_work",
  "traceability",
  "volume_estimate",
] as const;
export type ClaimId = (typeof CLAIM_IDS)[number];

// ── Claim statuses (cf. contracts.py:ClaimStatus) ──────────────────────────
export const CLAIM_STATUSES = [
  "ASSUMPTION_REQUIRES_DISCLOSURE",
  "CUSTOMER_PROOF_REQUIRED",
  "FORBIDDEN",
  "LEGAL_REVIEW_REQUIRED",
  "PENDING_CLONESTORE_PRODUCT_VERIFICATION",
  "PENDING_DEMO_TIMING_MEASUREMENT",
  "SUPPORTED_ESTIMATE",
  "VERIFIED_PRICE",
  "VERIFIED_PRODUCT_FACT",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// Statuts autorisés en activation réelle (cf. REAL_ACTIVATABLE_CLAIM_STATUSES).
export const REAL_ACTIVATABLE_CLAIM_STATUSES: ReadonlySet<ClaimStatus> = new Set<ClaimStatus>([
  "ASSUMPTION_REQUIRES_DISCLOSURE",
  "SUPPORTED_ESTIMATE",
  "VERIFIED_PRICE",
  "VERIFIED_PRODUCT_FACT",
]);

// Statuts autorisés en SHADOW previews uniquement (incl. pending).
export const SHADOW_ALLOWED_CLAIM_STATUSES: ReadonlySet<ClaimStatus> = new Set<ClaimStatus>([
  "ASSUMPTION_REQUIRES_DISCLOSURE",
  "PENDING_CLONESTORE_PRODUCT_VERIFICATION",
  "PENDING_DEMO_TIMING_MEASUREMENT",
  "SUPPORTED_ESTIMATE",
  "VERIFIED_PRICE",
  "VERIFIED_PRODUCT_FACT",
]);

// Surfaces autorisées (cf. clonestore_contract.py:SURFACE_ALLOWED_CLAIMS).
export const SURFACE_ALLOWED_CLAIMS: Readonly<Record<string, readonly string[]>> = {
  landing: ["company_adaptation", "human_validation", "pierre_is_role", "price_monthly", "recurring_work", "traceability"],
  demo: ["company_adaptation", "human_validation", "pierre_is_role", "traceability"],
  diagnostic: ["human_validation", "price_monthly", "traceability", "volume_estimate"],
  pricing: ["human_validation", "price_monthly", "traceability"],
  email: ["company_adaptation", "human_validation", "pierre_is_role", "price_monthly", "recurring_work", "traceability"],
};
export type Surface = keyof typeof SURFACE_ALLOWED_CLAIMS;

// ── Event types (cf. contracts.py:ConversionEventType) ─────────────────────
export const EVENT_TYPES = [
  "assistance_cta_clicked",
  "checkout_completed",
  "checkout_failed",
  "checkout_started",
  "demo_completed",
  "demo_started",
  "demo_step_viewed",
  "diagnostic_completed",
  "diagnostic_started",
  "diagnostic_step_completed",
  "landing_viewed",
  "meeting_booked",
  "meeting_started",
  "message_preview_generated",
  "onboarding_completed",
  "onboarding_started",
  "pierre_activated",
  "positive_reply",
  "purchase_cta_clicked",
  "reply_received",
  "result_viewed",
  "unsubscribe",
  "variant_assigned",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// Événements émis UNIQUEMENT par le serveur (jamais acceptés du navigateur).
// Décision conservatrice CloneStore : tout ce qui touche au paiement,
// activation, onboarding, booking ou attribution serveur reste interdit côté
// client. Les events 'reply_*' / 'unsubscribe' / 'message_preview_generated'
// proviennent du serveur LeadForge — refusés côté CloneStore client.
export const SERVER_ONLY_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "checkout_completed",
  "checkout_failed",
  "checkout_started",
  "meeting_booked",
  "message_preview_generated",
  "onboarding_completed",
  "onboarding_started",
  "pierre_activated",
  "positive_reply",
  "reply_received",
  "unsubscribe",
  "variant_assigned",
]);

// Événements client autorisés (allowlist stricte pour /api/conversion/events).
export const CLIENT_ALLOWED_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>(
  EVENT_TYPES.filter((id) => !SERVER_ONLY_EVENT_TYPES.has(id)),
);

// ── Metadata allowlist/forbidden (cf. events.py:ALLOWED_META/FORBIDDEN_META) ─
export const EVENT_METADATA_ALLOWED = [
  "amount_eur",
  "branch",
  "claim_ids",
  "compatibility",
  "contact_kind",
  "cta",
  "decision",
  "demo_step",
  "email_tier",
  "missions_count",
  "reason",
  "segment",
  "stage",
  "status",
  "step",
] as const;
export type EventMetadataKey = (typeof EVENT_METADATA_ALLOWED)[number];

export const EVENT_METADATA_FORBIDDEN: readonly string[] = [
  "api_key",
  "body",
  "candidate",
  "card",
  "cvv",
  "email",
  "email_body",
  "employee",
  "html_body",
  "iban",
  "ip",
  "name",
  "password",
  "salary",
  "secret",
  "siren",
  "text_body",
  "token",
  "user_agent",
];

// ── Checkout metadata (cf. clonestore_contract.py:CHECKOUT_METADATA_FIELDS) ─
export const CHECKOUT_METADATA_FIELDS = [
  "prospect_token",
  "campaign",
  "cohort",
  "variant",
  "funnel_version",
] as const;
export type CheckoutMetadataKey = (typeof CHECKOUT_METADATA_FIELDS)[number];

// Clés CloneStore additionnelles permises côté metadata Stripe (réutilisent
// l'auth/order existant — ne CHANGENT PAS le contrat LeadForge, mais sont
// nécessaires au pont avec Phase E).
export const CHECKOUT_METADATA_ADDITIONAL_ALLOWED = [
  "user_id",
  "agent_slug",
  "order_id",
  "tenant_id",
  "founder_reservation_id",
] as const;

// ── Démo (cf. clonestore_contract.py) ──────────────────────────────────────
export const DEMO_BEHAVIORS = ["CloneOS", "CloneADN", "CloneGuard", "CloneTrace"] as const;
export type DemoBehavior = (typeof DEMO_BEHAVIORS)[number];
export const DEMO_STEP_RANGE: readonly [number, number] = [6, 9];

// ── Diagnostic (cf. diagnostic.py + clonestore_contract.py) ────────────────
export const DIAGNOSTIC_MAX_QUESTIONS = 8 as const;

// Schéma des 8 questions diagnostic (id + type — strict ordre LeadForge).
export interface DiagnosticQuestionSchema {
  id: DiagnosticQuestionId;
  type: "int" | "text" | "enum" | "bool";
}

export const DIAGNOSTIC_QUESTION_IDS = [
  "headcount",
  "hr_team_size",
  "monthly_hires",
  "monthly_on_offboardings",
  "monthly_docs_emails_ops",
  "current_tools",
  "autonomy_level",
  "validation_required",
] as const;
export type DiagnosticQuestionId = (typeof DIAGNOSTIC_QUESTION_IDS)[number];

export const DIAGNOSTIC_QUESTIONS: readonly DiagnosticQuestionSchema[] = [
  { id: "headcount", type: "int" },
  { id: "hr_team_size", type: "int" },
  { id: "monthly_hires", type: "int" },
  { id: "monthly_on_offboardings", type: "int" },
  { id: "monthly_docs_emails_ops", type: "int" },
  { id: "current_tools", type: "text" },
  { id: "autonomy_level", type: "enum" },
  { id: "validation_required", type: "bool" },
];

// Inputs interdits (cf. diagnostic.py:FORBIDDEN_INPUT_KEYS — FRANÇAIS).
export const DIAGNOSTIC_FORBIDDEN_INPUT_KEYS = [
  "absence_individuelle",
  "cv",
  "dossier_disciplinaire",
  "employee_name",
  "health",
  "nom_salarié",
  "salaire_individuel",
  "salary",
  "sanction",
  "santé",
] as const;

// Hypothèses par défaut visibles (cf. diagnostic.py:DEFAULT_ASSUMPTIONS).
export const DIAGNOSTIC_DEFAULT_ASSUMPTIONS = {
  automatable_share_central: 0.45,
  automatable_share_high: 0.6,
  automatable_share_low: 0.3,
  minutes_per_operation: 8,
  ops_per_hire: 6,
  ops_per_on_offboarding: 5,
} as const;

// ── Attribution token (cf. attribution.py) ─────────────────────────────────
export const ATTRIBUTION_KEY_VERSION = "a1" as const;
export const ATTRIBUTION_DEFAULT_TTL_DAYS = 45 as const;
export const ATTRIBUTION_TOKEN_ID_LENGTH = 40 as const; // uuid.hex + uuid.hex[:8]
export const ATTRIBUTION_SIGNATURE_LENGTH = 64 as const; // sha256 hex
export const ATTRIBUTION_TOKEN_FORMAT = "{token_id}.{signature_hex}" as const;
export const ATTRIBUTION_URL_PATTERN = "/p/{token_id}.{signature}" as const;
export const ATTRIBUTION_KEY_ENV = "LEADFORGE_ATTRIBUTION_SIGNING_KEY" as const;

// ── Errors ─────────────────────────────────────────────────────────────────
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

export function assertEventType(id: string): asserts id is EventType {
  if (!(EVENT_TYPES as readonly string[]).includes(id)) {
    throw new ContractParityError("EVENT_UNKNOWN", `Évènement inconnu: ${id}`);
  }
}

export function assertClaimId(id: string): asserts id is ClaimId {
  if (!(CLAIM_IDS as readonly string[]).includes(id)) {
    throw new ContractParityError("CLAIM_UNKNOWN", `Claim inconnue: ${id}`);
  }
}

export function assertPriceParity(stripeActivationAmount: number): void {
  if (stripeActivationAmount !== PIERRE_PRICE_AMOUNT_CENTS) {
    throw new ContractParityError(
      "PRICE_MISMATCH",
      `Prix Pierre divergent : contrat=${PIERRE_PRICE_AMOUNT_CENTS} runtime=${stripeActivationAmount}`,
    );
  }
}

// ── Snapshot canonique (utilisé par la parité interne) ─────────────────────
//
// IMPORTANT : la PARITÉ avec LeadForge est testée contre la FIXTURE JSON
// indépendante (cf. fixtures/leadforge-contract-db9b166.json). Cette fonction
// rend un objet purement déclaratif — elle ne doit pas servir à "valider"
// son propre fingerprint (interdiction de tautologie).
export interface ContractSnapshot {
  leadforge_commit: string;
  funnel_version: string;
  landing_version: string;
  demo_version: string;
  diagnostic_version: string;
  price_eur: number;
  price_amount_cents: number;
  price_currency: string;
  price_interval: string;
  checkout_mode: string;
  variants: readonly string[];
  contact_kinds: readonly string[];
  variant_hero: Readonly<Record<string, string>>;
  claim_ids: readonly string[];
  claim_status_enum: readonly string[];
  real_activatable_claim_statuses: readonly string[];
  shadow_allowed_claim_statuses: readonly string[];
  surface_allowed_claims: Readonly<Record<string, readonly string[]>>;
  event_types: readonly string[];
  event_metadata_allowed: readonly string[];
  event_metadata_forbidden: readonly string[];
  checkout_metadata_fields: readonly string[];
  demo_behaviors: readonly string[];
  demo_step_range: readonly [number, number];
  diagnostic: {
    max_questions: number;
    questions: readonly { id: string; type: string }[];
    forbidden_input_keys: readonly string[];
    default_assumptions: Readonly<Record<string, number>>;
  };
  attribution_token: {
    format: string;
    key_version: string;
    default_ttl_days: number;
    token_id_length: number;
    signature_length: number;
    signature_encoding: "hex";
    key_env: string;
  };
}

export function buildContractSnapshot(): ContractSnapshot {
  return {
    leadforge_commit: LEADFORGE_COMMIT,
    funnel_version: FUNNEL_VERSION,
    landing_version: LANDING_VERSION,
    demo_version: DEMO_VERSION,
    diagnostic_version: DIAGNOSTIC_VERSION,
    price_eur: PIERRE_PRICE_EUR,
    price_amount_cents: PIERRE_PRICE_AMOUNT_CENTS,
    price_currency: PIERRE_PRICE_CURRENCY,
    price_interval: PIERRE_PRICE_INTERVAL,
    checkout_mode: CHECKOUT_MODE,
    variants: [...VARIANT_IDS].sort(),
    contact_kinds: [...CONTACT_KINDS].sort(),
    variant_hero: Object.fromEntries(Object.entries(VARIANT_HERO).sort()),
    claim_ids: [...CLAIM_IDS].sort(),
    claim_status_enum: [...CLAIM_STATUSES].sort(),
    real_activatable_claim_statuses: [...REAL_ACTIVATABLE_CLAIM_STATUSES].sort(),
    shadow_allowed_claim_statuses: [...SHADOW_ALLOWED_CLAIM_STATUSES].sort(),
    surface_allowed_claims: Object.fromEntries(
      Object.entries(SURFACE_ALLOWED_CLAIMS).map(([k, v]) => [k, [...v].sort()]).sort(),
    ),
    event_types: [...EVENT_TYPES].sort(),
    event_metadata_allowed: [...EVENT_METADATA_ALLOWED].sort(),
    event_metadata_forbidden: [...EVENT_METADATA_FORBIDDEN].sort(),
    checkout_metadata_fields: [...CHECKOUT_METADATA_FIELDS],
    demo_behaviors: [...DEMO_BEHAVIORS],
    demo_step_range: [DEMO_STEP_RANGE[0], DEMO_STEP_RANGE[1]],
    diagnostic: {
      max_questions: DIAGNOSTIC_MAX_QUESTIONS,
      questions: DIAGNOSTIC_QUESTIONS.map((q) => ({ id: q.id, type: q.type })),
      forbidden_input_keys: [...DIAGNOSTIC_FORBIDDEN_INPUT_KEYS].sort(),
      default_assumptions: Object.fromEntries(
        Object.entries(DIAGNOSTIC_DEFAULT_ASSUMPTIONS).sort(),
      ) as Record<string, number>,
    },
    attribution_token: {
      format: ATTRIBUTION_TOKEN_FORMAT,
      key_version: ATTRIBUTION_KEY_VERSION,
      default_ttl_days: ATTRIBUTION_DEFAULT_TTL_DAYS,
      token_id_length: ATTRIBUTION_TOKEN_ID_LENGTH,
      signature_length: ATTRIBUTION_SIGNATURE_LENGTH,
      signature_encoding: "hex",
      key_env: ATTRIBUTION_KEY_ENV,
    },
  };
}

/**
 * Empreinte SHA-256 du snapshot CloneStore — sert UNIQUEMENT à détecter une
 * dérive interne. La parité réelle avec LeadForge db9b166 est testée par le
 * test `bloc3-parity.test.ts` contre la fixture indépendante.
 */
export function computeInternalSnapshotFingerprint(snapshot: ContractSnapshot = buildContractSnapshot()): string {
  // JSON.stringify avec replacer trié sur TOUTES les clés (profond).
  const canonical = canonicalJson(snapshot);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson((value as Record<string, unknown>)[k])).join(",") + "}";
}

/**
 * Fingerprint LeadForge réel — VALEUR LITTÉRALE générée depuis le code Python
 * db9b166 par `export_fixture.py`. Ne PAS recalculer depuis le code TypeScript :
 * la fixture est la source autoritaire.
 */
export const LEADFORGE_FIXTURE_FINGERPRINT =
  "04e34646f17dcdf614b077a128f5891226c1b6f0f50a8bb92bebfbdfa9140948" as const;
