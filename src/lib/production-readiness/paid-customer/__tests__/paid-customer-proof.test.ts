// P-FINAL 01 — Phase 7 — Tests for paid customer E2E proof.
// All simulate-route: pure functions only, no Supabase, no Next, no async.

import { describe, it, expect } from "vitest";
import {
  PAID_CUSTOMER_CHECKLIST,
  getCriticalChecklistItems,
  runChecklist,
} from "../paid-customer-checklist";
import {
  buildPaidCustomerProof,
  isPaidCustomerReady,
  getBlockingReasons,
} from "../paid-customer-proof";
import {
  FIXTURE_FULL_PAID_CUSTOMER,
  FIXTURE_NO_SUBSCRIPTION,
  FIXTURE_PAST_DUE,
  FIXTURE_CANCELED,
  FIXTURE_TRIALING,
  FIXTURE_MISSING_COMPANY,
} from "../paid-customer-fixtures";

// ── Checklist ─────────────────────────────────────────────────────────────────

describe("paid-customer-checklist", () => {
  it("checklist has at least 7 items", () => {
    expect(PAID_CUSTOMER_CHECKLIST.length).toBeGreaterThanOrEqual(7);
  });

  it("all items have required fields", () => {
    for (const item of PAID_CUSTOMER_CHECKLIST) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(typeof item.critical).toBe("boolean");
      expect(typeof item.check).toBe("function");
      expect(item.failure_message).toBeTruthy();
    }
  });

  it("checklist ids are unique", () => {
    const ids = PAID_CUSTOMER_CHECKLIST.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getCriticalChecklistItems returns only critical items", () => {
    for (const item of getCriticalChecklistItems()) {
      expect(item.critical).toBe(true);
    }
  });

  it("subscription_active item is critical", () => {
    const item = PAID_CUSTOMER_CHECKLIST.find((i) => i.id === "subscription_active");
    expect(item!.critical).toBe(true);
  });

  it("has_stripe_customer_id item is critical", () => {
    const item = PAID_CUSTOMER_CHECKLIST.find((i) => i.id === "has_stripe_customer_id");
    expect(item!.critical).toBe(true);
  });

  it("runChecklist: full paid customer → no critical failures", () => {
    const result = runChecklist(FIXTURE_FULL_PAID_CUSTOMER);
    expect(result.failed_critical).toHaveLength(0);
  });

  it("runChecklist: no subscription → critical failures", () => {
    const result = runChecklist(FIXTURE_NO_SUBSCRIPTION);
    expect(result.failed_critical.length).toBeGreaterThan(0);
  });

  it("runChecklist: trialing → no critical failures", () => {
    const result = runChecklist(FIXTURE_TRIALING);
    expect(result.failed_critical).toHaveLength(0);
  });

  it("runChecklist: canceled → critical failures", () => {
    const result = runChecklist(FIXTURE_CANCELED);
    expect(result.failed_critical.length).toBeGreaterThan(0);
  });

  it("runChecklist: missing company → critical failures", () => {
    const result = runChecklist(FIXTURE_MISSING_COMPANY);
    expect(result.failed_critical.length).toBeGreaterThan(0);
  });
});

// ── Proof ─────────────────────────────────────────────────────────────────────

describe("buildPaidCustomerProof", () => {
  it("full paid customer → is_paid_customer: true", () => {
    const proof = buildPaidCustomerProof(FIXTURE_FULL_PAID_CUSTOMER);
    expect(proof.is_paid_customer).toBe(true);
    expect(proof.has_access_to_pierre).toBe(true);
    expect(proof.has_active_subscription).toBe(true);
    expect(proof.blockers).toHaveLength(0);
  });

  it("no subscription → is_paid_customer: false", () => {
    const proof = buildPaidCustomerProof(FIXTURE_NO_SUBSCRIPTION);
    expect(proof.is_paid_customer).toBe(false);
    expect(proof.has_access_to_pierre).toBe(false);
    expect(proof.blockers.length).toBeGreaterThan(0);
  });

  it("past_due → has_active_subscription: false, is_payment_current: false", () => {
    const proof = buildPaidCustomerProof(FIXTURE_PAST_DUE);
    expect(proof.has_active_subscription).toBe(false);
    expect(proof.is_payment_current).toBe(false);
    expect(proof.is_paid_customer).toBe(false);
  });

  it("canceled → has_active_subscription: false", () => {
    const proof = buildPaidCustomerProof(FIXTURE_CANCELED);
    expect(proof.has_active_subscription).toBe(false);
    expect(proof.is_paid_customer).toBe(false);
  });

  it("trialing → is_paid_customer: true, has_access_to_pierre: true", () => {
    const proof = buildPaidCustomerProof(FIXTURE_TRIALING);
    expect(proof.has_active_subscription).toBe(true);
    expect(proof.is_paid_customer).toBe(true);
    expect(proof.has_access_to_pierre).toBe(true);
  });

  it("missing company → has_valid_company: false, blockers not empty", () => {
    const proof = buildPaidCustomerProof(FIXTURE_MISSING_COMPANY);
    expect(proof.has_valid_company).toBe(false);
    expect(proof.blockers.length).toBeGreaterThan(0);
  });

  it("proof has proof_evaluated_at timestamp", () => {
    const proof = buildPaidCustomerProof(FIXTURE_FULL_PAID_CUSTOMER);
    expect(proof.proof_evaluated_at).toBeTruthy();
    expect(() => new Date(proof.proof_evaluated_at)).not.toThrow();
  });

  it("isPaidCustomerReady: true for full paid customer", () => {
    expect(isPaidCustomerReady(FIXTURE_FULL_PAID_CUSTOMER)).toBe(true);
  });

  it("isPaidCustomerReady: false for no subscription", () => {
    expect(isPaidCustomerReady(FIXTURE_NO_SUBSCRIPTION)).toBe(false);
  });

  it("isPaidCustomerReady: true for trialing", () => {
    expect(isPaidCustomerReady(FIXTURE_TRIALING)).toBe(true);
  });

  it("getBlockingReasons: empty for full paid customer", () => {
    expect(getBlockingReasons(FIXTURE_FULL_PAID_CUSTOMER)).toHaveLength(0);
  });

  it("getBlockingReasons: non-empty for no subscription", () => {
    const reasons = getBlockingReasons(FIXTURE_NO_SUBSCRIPTION);
    expect(reasons.length).toBeGreaterThan(0);
  });

  it("blockers are strings", () => {
    const proof = buildPaidCustomerProof(FIXTURE_NO_SUBSCRIPTION);
    for (const b of proof.blockers) {
      expect(typeof b).toBe("string");
      expect(b.length).toBeGreaterThan(0);
    }
  });

  it("warnings are strings", () => {
    const proof = buildPaidCustomerProof(FIXTURE_CANCELED);
    for (const w of proof.warnings) {
      expect(typeof w).toBe("string");
    }
  });

  it("full paid customer has has_valid_company: true", () => {
    expect(buildPaidCustomerProof(FIXTURE_FULL_PAID_CUSTOMER).has_valid_company).toBe(true);
  });

  it("full paid customer has has_valid_profile: true", () => {
    expect(buildPaidCustomerProof(FIXTURE_FULL_PAID_CUSTOMER).has_valid_profile).toBe(true);
  });

  it("past_due has is_payment_current: false", () => {
    expect(buildPaidCustomerProof(FIXTURE_PAST_DUE).is_payment_current).toBe(false);
  });

  it("incomplete subscription → is_paid_customer: false", () => {
    const incompleteState = { ...FIXTURE_NO_SUBSCRIPTION, subscription_status: "incomplete" as const };
    const proof = buildPaidCustomerProof(incompleteState);
    expect(proof.is_paid_customer).toBe(false);
  });

  it("unpaid subscription → is_paid_customer: false", () => {
    const unpaidState = { ...FIXTURE_PAST_DUE, subscription_status: "unpaid" as const };
    const proof = buildPaidCustomerProof(unpaidState);
    expect(proof.is_paid_customer).toBe(false);
  });
});

// ── Fixtures validation ───────────────────────────────────────────────────────

describe("paid-customer-fixtures", () => {
  it("FIXTURE_FULL_PAID_CUSTOMER has all required fields", () => {
    expect(FIXTURE_FULL_PAID_CUSTOMER.company_id).toBeTruthy();
    expect(FIXTURE_FULL_PAID_CUSTOMER.stripe_customer_id).toBeTruthy();
    expect(FIXTURE_FULL_PAID_CUSTOMER.stripe_subscription_id).toBeTruthy();
  });

  it("FIXTURE_NO_SUBSCRIPTION has no stripe ids", () => {
    expect(FIXTURE_NO_SUBSCRIPTION.stripe_customer_id).toBeNull();
    expect(FIXTURE_NO_SUBSCRIPTION.stripe_subscription_id).toBeNull();
  });

  it("FIXTURE_TRIALING has subscription_status trialing", () => {
    expect(FIXTURE_TRIALING.subscription_status).toBe("trialing");
  });

  it("FIXTURE_PAST_DUE has is_payment_current: false", () => {
    expect(FIXTURE_PAST_DUE.is_payment_current).toBe(false);
  });

  it("FIXTURE_CANCELED has subscription_status canceled", () => {
    expect(FIXTURE_CANCELED.subscription_status).toBe("canceled");
  });

  it("FIXTURE_MISSING_COMPANY has has_company_record: false", () => {
    expect(FIXTURE_MISSING_COMPANY.has_company_record).toBe(false);
  });
});

// ── Cross-cutting invariants ──────────────────────────────────────────────────

describe("paid-customer cross-cutting invariants", () => {
  it("is_paid_customer implies has_active_subscription", () => {
    for (const fixture of [FIXTURE_FULL_PAID_CUSTOMER, FIXTURE_TRIALING]) {
      const proof = buildPaidCustomerProof(fixture);
      if (proof.is_paid_customer) {
        expect(proof.has_active_subscription).toBe(true);
      }
    }
  });

  it("has_access_to_pierre implies is_paid_customer", () => {
    for (const fixture of [FIXTURE_FULL_PAID_CUSTOMER, FIXTURE_TRIALING]) {
      const proof = buildPaidCustomerProof(fixture);
      if (proof.has_access_to_pierre) {
        expect(proof.is_paid_customer).toBe(true);
      }
    }
  });

  it("no blockers when full paid customer", () => {
    const proof = buildPaidCustomerProof(FIXTURE_FULL_PAID_CUSTOMER);
    expect(proof.blockers).toHaveLength(0);
  });

  it("blockers present for any non-paying state", () => {
    for (const fixture of [FIXTURE_NO_SUBSCRIPTION, FIXTURE_CANCELED, FIXTURE_MISSING_COMPANY]) {
      const proof = buildPaidCustomerProof(fixture);
      expect(proof.blockers.length).toBeGreaterThan(0);
    }
  });

  it("all checklist check functions are callable with any fixture", () => {
    const fixtures = [FIXTURE_FULL_PAID_CUSTOMER, FIXTURE_NO_SUBSCRIPTION, FIXTURE_PAST_DUE];
    for (const fixture of fixtures) {
      for (const item of PAID_CUSTOMER_CHECKLIST) {
        expect(() => item.check(fixture)).not.toThrow();
      }
    }
  });
});
