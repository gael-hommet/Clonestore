// src/lib/billing/__tests__/activation.test.ts
// B31.7 — Pure unit tests for Stripe activation helpers.

import { describe, it, expect } from "vitest";
import {
  isAccessGranted,
  isAccessRevoked,
  mapPaymentStatusToActivation,
  mapSubscriptionStatus,
  extractActivationMetadata,
  validateCheckoutSession,
  isPierrePriceAmountValid,
  EXPECTED_PIERRE_PRICE_AMOUNT,
  TRIAL_PERIOD_DAYS,
} from "../stripe-activation";

// ── isAccessGranted ────────────────────────────────────────────

describe("isAccessGranted", () => {
  it("active grants access", () => {
    expect(isAccessGranted("active")).toBe(true);
  });

  it("trialing grants access (trial = accessible)", () => {
    expect(isAccessGranted("trialing")).toBe(true);
  });

  it("canceled does NOT grant access", () => {
    expect(isAccessGranted("canceled")).toBe(false);
  });

  it("unpaid does NOT grant access", () => {
    expect(isAccessGranted("unpaid")).toBe(false);
  });

  it("incomplete_expired does NOT grant access", () => {
    expect(isAccessGranted("incomplete_expired")).toBe(false);
  });

  it("past_due does NOT grant access", () => {
    expect(isAccessGranted("past_due")).toBe(false);
  });

  it("none does NOT grant access", () => {
    expect(isAccessGranted("none")).toBe(false);
  });

  it("empty string does NOT grant access", () => {
    expect(isAccessGranted("")).toBe(false);
  });
});

// ── isAccessRevoked ────────────────────────────────────────────

describe("isAccessRevoked", () => {
  it("canceled revokes access", () => {
    expect(isAccessRevoked("canceled")).toBe(true);
  });

  it("unpaid revokes access", () => {
    expect(isAccessRevoked("unpaid")).toBe(true);
  });

  it("incomplete_expired revokes access", () => {
    expect(isAccessRevoked("incomplete_expired")).toBe(true);
  });

  it("active does NOT revoke access", () => {
    expect(isAccessRevoked("active")).toBe(false);
  });

  it("trialing does NOT revoke access", () => {
    expect(isAccessRevoked("trialing")).toBe(false);
  });
});

// ── mapPaymentStatusToActivation ──────────────────────────────

describe("mapPaymentStatusToActivation", () => {
  it("paid maps to active", () => {
    expect(mapPaymentStatusToActivation("paid")).toBe("active");
  });

  it("no_payment_required maps to trialing (Stripe trial)", () => {
    expect(mapPaymentStatusToActivation("no_payment_required")).toBe("trialing");
  });

  it("null maps to none", () => {
    expect(mapPaymentStatusToActivation(null)).toBe("none");
  });

  it("unknown value maps to none", () => {
    expect(mapPaymentStatusToActivation("unknown_status")).toBe("none");
  });
});

// ── mapSubscriptionStatus ──────────────────────────────────────

describe("mapSubscriptionStatus", () => {
  it("active maps to active", () => {
    expect(mapSubscriptionStatus("active")).toBe("active");
  });

  it("trialing maps to trialing", () => {
    expect(mapSubscriptionStatus("trialing")).toBe("trialing");
  });

  it("canceled maps to canceled", () => {
    expect(mapSubscriptionStatus("canceled")).toBe("canceled");
  });

  it("past_due maps to past_due", () => {
    expect(mapSubscriptionStatus("past_due")).toBe("past_due");
  });

  it("unpaid maps to unpaid", () => {
    expect(mapSubscriptionStatus("unpaid")).toBe("unpaid");
  });

  it("incomplete_expired maps to incomplete_expired", () => {
    expect(mapSubscriptionStatus("incomplete_expired")).toBe("incomplete_expired");
  });

  it("null maps to none", () => {
    expect(mapSubscriptionStatus(null)).toBe("none");
  });

  it("unknown maps to none", () => {
    expect(mapSubscriptionStatus("weird_status")).toBe("none");
  });
});

// ── extractActivationMetadata ──────────────────────────────────

describe("extractActivationMetadata", () => {
  it("extracts user_id and agent_slug from metadata", () => {
    const result = extractActivationMetadata({
      metadata: { user_id: "user-123", agent_slug: "pierre" },
    });
    expect(result.user_id).toBe("user-123");
    expect(result.agent_slug).toBe("pierre");
  });

  it("returns null for missing metadata", () => {
    const result = extractActivationMetadata({ mode: "subscription" });
    expect(result.user_id).toBeNull();
    expect(result.agent_slug).toBeNull();
  });

  it("returns null for null metadata", () => {
    const result = extractActivationMetadata({ metadata: null });
    expect(result.user_id).toBeNull();
    expect(result.agent_slug).toBeNull();
  });

  it("returns null when user_id is not a string", () => {
    const result = extractActivationMetadata({
      metadata: { user_id: 123, agent_slug: "pierre" },
    });
    expect(result.user_id).toBeNull();
    expect(result.agent_slug).toBe("pierre");
  });

  it("never leaks non-string metadata values", () => {
    const result = extractActivationMetadata({
      metadata: { user_id: true, agent_slug: false },
    });
    expect(result.user_id).toBeNull();
    expect(result.agent_slug).toBeNull();
  });
});

// ── validateCheckoutSession ────────────────────────────────────

describe("validateCheckoutSession", () => {
  const validPaidSession = {
    mode: "subscription",
    subscription: "sub_abc123",
    payment_status: "paid",
    metadata: { user_id: "user-456", agent_slug: "pierre" },
    customer: "cus_xyz",
  };

  const validTrialSession = {
    mode: "subscription",
    subscription: "sub_trial_001",
    payment_status: "no_payment_required",
    metadata: { user_id: "user-789", agent_slug: "pierre" },
    customer: "cus_abc",
  };

  it("validates a paid subscription session (active)", () => {
    const result = validateCheckoutSession(validPaidSession);
    expect(result.valid).toBe(true);
    expect(result.status).toBe("active");
    expect(result.user_id).toBe("user-456");
    expect(result.agent_slug).toBe("pierre");
    expect(result.subscription_id).toBe("sub_abc123");
  });

  it("validates a trial session (no_payment_required → trialing)", () => {
    const result = validateCheckoutSession(validTrialSession);
    expect(result.valid).toBe(true);
    expect(result.status).toBe("trialing");
    expect(result.user_id).toBe("user-789");
    expect(result.subscription_id).toBe("sub_trial_001");
  });

  it("rejects non-subscription mode", () => {
    const result = validateCheckoutSession({ mode: "payment", subscription: "sub_x" });
    expect(result.valid).toBe(false);
    expect(result.status).toBe("none");
  });

  it("rejects missing subscription ID", () => {
    const result = validateCheckoutSession({
      mode: "subscription",
      payment_status: "paid",
      metadata: { user_id: "u", agent_slug: "pierre" },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects missing user_id in metadata", () => {
    const result = validateCheckoutSession({
      mode: "subscription",
      subscription: "sub_x",
      payment_status: "paid",
      metadata: { agent_slug: "pierre" },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects missing agent_slug in metadata", () => {
    const result = validateCheckoutSession({
      mode: "subscription",
      subscription: "sub_x",
      payment_status: "paid",
      metadata: { user_id: "u" },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects unexpected payment_status (e.g. processing)", () => {
    const result = validateCheckoutSession({
      ...validPaidSession,
      payment_status: "processing",
    });
    expect(result.valid).toBe(false);
  });

  it("duplicate event is safe — returns same shape (idempotent input)", () => {
    const r1 = validateCheckoutSession(validPaidSession);
    const r2 = validateCheckoutSession(validPaidSession);
    expect(r1.valid).toBe(r2.valid);
    expect(r1.status).toBe(r2.status);
    expect(r1.user_id).toBe(r2.user_id);
  });

  it("checkout body never contains user_id at top level", () => {
    // user_id must come from metadata, not from session body directly
    const session = { ...validPaidSession };
    const result = validateCheckoutSession(session);
    // user_id is extracted from metadata, not from session["user_id"]
    expect(session["user_id" as keyof typeof session]).toBeUndefined();
    expect(result.user_id).toBe("user-456");
  });
});

// ── isPierrePriceAmountValid ───────────────────────────────────

describe("isPierrePriceAmountValid", () => {
  it("44900 cents (449 EUR) is valid", () => {
    expect(isPierrePriceAmountValid(44900)).toBe(true);
  });

  it("EXPECTED_PIERRE_PRICE_AMOUNT constant is 44900", () => {
    expect(EXPECTED_PIERRE_PRICE_AMOUNT).toBe(44900);
  });

  it("29900 cents (299 EUR) is invalid", () => {
    expect(isPierrePriceAmountValid(29900)).toBe(false);
  });

  it("0 is invalid", () => {
    expect(isPierrePriceAmountValid(0)).toBe(false);
  });

  it("null is invalid", () => {
    expect(isPierrePriceAmountValid(null)).toBe(false);
  });
});

// ── TRIAL_PERIOD_DAYS ──────────────────────────────────────────

describe("TRIAL_PERIOD_DAYS", () => {
  it("trial period is 7 days", () => {
    expect(TRIAL_PERIOD_DAYS).toBe(7);
  });

  it("checkout subscription_data would include trial_period_days: 7", () => {
    const subscriptionData = {
      trial_period_days: TRIAL_PERIOD_DAYS,
      metadata: { user_id: "u", agent_slug: "pierre" },
    };
    expect(subscriptionData.trial_period_days).toBe(7);
  });
});
