// src/lib/production-readiness/paid-customer/paid-customer-testmode-e2e.ts
// GO-LIVE 08 — Paid Customer Test Mode E2E Verdict Helper.
//
// Pure function — no Stripe calls, no Supabase calls, no secrets.
// Used by tests to validate the verdict structure.
// For actual E2E verification, use: node scripts/paid-customer-testmode-e2e.mjs
//
// SAFETY:
// - Never contains real secrets.
// - Never calls Stripe live (sk_live_ is blocked at input validation).
// - Never calls OpenAI or Anthropic.
// - Never sends real emails.
// - Never modifies go-live-proofs.local.json.

export type TestModeE2EInput = {
  userEmail?: string;
  checkoutSessionId?: string;
  subscriptionId?: string;
  orderStatus?: string;
  stripeKeyPrefix?: string;
};

export type TestModeE2EVerdictField =
  | boolean
  | "pending"
  | "verified"
  | "not_applicable"
  | "blocked";

export type TestModeE2EVerdict = {
  env_ok: TestModeE2EVerdictField;
  stripe_test_mode_ok: TestModeE2EVerdictField;
  checkout_session_seen: TestModeE2EVerdictField;
  webhook_seen: TestModeE2EVerdictField;
  order_active: TestModeE2EVerdictField;
  pierre_access_active: TestModeE2EVerdictField;
  setup_access_ok: TestModeE2EVerdictField;
  cockpit_access_ok: TestModeE2EVerdictField;
  cancel_seen: TestModeE2EVerdictField;
  access_after_cancel_ok: TestModeE2EVerdictField;
  blockers: string[];
  warnings: string[];
  overall: "go" | "no_go" | "pending";
  evidence_ref: string;
  safety_note: string;
};

const EVIDENCE_REF = "go-live-evidence/paid-customer-testmode/paid-customer-testmode-e2e.txt";
const SAFETY_NOTE =
  "TEST MODE ONLY. No live Stripe calls. No real payments. No OpenAI. No Anthropic. Does not modify go-live-proofs.local.json.";

export function buildTestModeE2EVerdict(
  input: TestModeE2EInput
): TestModeE2EVerdict {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // ── Safety: block sk_live_ ─────────────────────────────────────────────────
  const keyPrefix = input.stripeKeyPrefix ?? "";
  if (keyPrefix.startsWith("sk_live_") || keyPrefix.startsWith("pk_live_")) {
    blockers.push("sk_live_ or pk_live_ detected — test mode E2E blocked");
    return {
      env_ok: false,
      stripe_test_mode_ok: false,
      checkout_session_seen: "blocked",
      webhook_seen: "blocked",
      order_active: "blocked",
      pierre_access_active: "blocked",
      setup_access_ok: "blocked",
      cockpit_access_ok: "blocked",
      cancel_seen: "blocked",
      access_after_cancel_ok: "blocked",
      blockers,
      warnings,
      overall: "no_go",
      evidence_ref: EVIDENCE_REF,
      safety_note: SAFETY_NOTE,
    };
  }

  // ── Stripe test mode ─────────────────────────────────────────────────────
  const stripeTestModeOk = keyPrefix.startsWith("sk_test_");
  if (!stripeTestModeOk) {
    blockers.push("STRIPE_SECRET_KEY is not in sk_test_ format");
  }

  // ── Checkout session ──────────────────────────────────────────────────────
  const checkoutSessionSeen: TestModeE2EVerdictField = input.checkoutSessionId
    ? "pending"
    : "pending";

  // ── Order status ──────────────────────────────────────────────────────────
  const orderActive =
    input.orderStatus === "active" || input.orderStatus === "trialing";
  const orderField: TestModeE2EVerdictField = input.orderStatus
    ? orderActive
    : "pending";

  if (input.orderStatus && !orderActive) {
    blockers.push(`Order status is '${input.orderStatus}' — not active/trialing`);
  }

  // ── Pierre access ─────────────────────────────────────────────────────────
  const pierreAccessActive: TestModeE2EVerdictField = orderActive
    ? true
    : input.orderStatus
    ? false
    : "pending";

  // ── Manual fields (always pending — require browser/Stripe dashboard check) ─
  const setupAccessOk: TestModeE2EVerdictField = "pending";
  const cockpitAccessOk: TestModeE2EVerdictField = "pending";
  const cancelSeen: TestModeE2EVerdictField = "pending";
  const accessAfterCancelOk: TestModeE2EVerdictField = "pending";
  const webhookSeen: TestModeE2EVerdictField = "pending";

  warnings.push("setup_access_ok: manual check required — navigate to /agents/pierre/setup");
  warnings.push("cockpit_access_ok: manual check required — navigate to /agents/pierre/use");
  warnings.push("cancel_seen: manual check required — cancel subscription in Stripe test dashboard");
  warnings.push("access_after_cancel_ok: manual check required — verify orders table + access blocked");

  // ── Overall verdict ───────────────────────────────────────────────────────
  const overall = blockers.length > 0 ? "no_go" : "pending";

  return {
    env_ok: stripeTestModeOk,
    stripe_test_mode_ok: stripeTestModeOk,
    checkout_session_seen: checkoutSessionSeen,
    webhook_seen: webhookSeen,
    order_active: orderField,
    pierre_access_active: pierreAccessActive,
    setup_access_ok: setupAccessOk,
    cockpit_access_ok: cockpitAccessOk,
    cancel_seen: cancelSeen,
    access_after_cancel_ok: accessAfterCancelOk,
    blockers,
    warnings,
    overall,
    evidence_ref: EVIDENCE_REF,
    safety_note: SAFETY_NOTE,
  };
}

// Checks that input is safe for test mode use (no live keys, no production secrets exposed).
export function assertTestModeInputSafe(input: TestModeE2EInput): void {
  const keyPrefix = input.stripeKeyPrefix ?? "";
  if (keyPrefix.startsWith("sk_live_")) {
    throw new Error("[GO-LIVE 08] Live Stripe key detected in test mode helper. Refusing to proceed.");
  }
  if (keyPrefix.startsWith("pk_live_")) {
    throw new Error("[GO-LIVE 08] Live publishable key detected. Refusing to proceed.");
  }
}

// Proof IDs for GO-LIVE 08 test mode.
// These are NOT auto-verified — they must be copied to go-live-proofs.local.json manually.
export const GO_LIVE_08_TEST_PROOF_IDS = [
  "STRIPE_TEST_CHECKOUT_E2E_STARTED",
  "STRIPE_TEST_PAYMENT_SUCCESS_E2E_VERIFIED",
  "STRIPE_TEST_WEBHOOK_RECEIVED",
  "PIERRE_ACCESS_AFTER_TEST_PAYMENT_VERIFIED",
  "PIERRE_SETUP_AFTER_TEST_PAYMENT_VERIFIED",
  "PIERRE_COCKPIT_AFTER_TEST_PAYMENT_VERIFIED",
  "STRIPE_TEST_SUBSCRIPTION_CANCEL_VERIFIED",
  "PIERRE_BLOCK_AFTER_TEST_CANCEL_VERIFIED",
  "PAID_CUSTOMER_TESTMODE_E2E_COMPLETED",
] as const;

export type GoLive08TestProofId = (typeof GO_LIVE_08_TEST_PROOF_IDS)[number];
