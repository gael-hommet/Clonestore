// P-FINAL 01 — Phase 7 — Paid customer proof evaluator.
// Pure: no Supabase, no Next, no async, no throw.

import type { AccountState, PaidCustomerProof } from "./paid-customer-types";
import { PAID_CUSTOMER_CHECKLIST, runChecklist } from "./paid-customer-checklist";

export function buildPaidCustomerProof(state: AccountState): PaidCustomerProof {
  const { passed, failed_critical, failed_non_critical } = runChecklist(state);

  const blockers: string[] = failed_critical.map((id) => {
    const item = PAID_CUSTOMER_CHECKLIST.find((i) => i.id === id);
    return item ? item.failure_message : `Check failed: ${id}`;
  });

  const warnings: string[] = failed_non_critical.map((id) => {
    const item = PAID_CUSTOMER_CHECKLIST.find((i) => i.id === id);
    return item ? item.failure_message : `Warning: ${id}`;
  });

  const has_active_subscription =
    state.subscription_status === "active" || state.subscription_status === "trialing";

  const is_paid_customer =
    has_active_subscription &&
    state.is_payment_current &&
    !!state.stripe_customer_id &&
    !!state.stripe_subscription_id;

  const has_access_to_pierre = state.pierre_access_level === "full" && is_paid_customer;

  return {
    is_paid_customer,
    has_active_subscription,
    has_access_to_pierre,
    has_valid_company: state.has_company_record,
    has_valid_profile: state.has_user_profile,
    is_payment_current: state.is_payment_current,
    blockers,
    warnings,
    proof_evaluated_at: new Date().toISOString(),
  };
}

export function isPaidCustomerReady(state: AccountState): boolean {
  return buildPaidCustomerProof(state).has_access_to_pierre;
}

export function getBlockingReasons(state: AccountState): string[] {
  return buildPaidCustomerProof(state).blockers;
}
