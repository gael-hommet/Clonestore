// P-FINAL 01 — Phase 7 — Paid customer E2E proof types.
// Pure types only. No imports, no side effects.

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "none";

export type PierreAccessLevel = "full" | "limited" | "none";

export interface AccountState {
  company_id: string;
  has_company_record: boolean;
  has_user_profile: boolean;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  pierre_access_level: PierreAccessLevel;
  is_payment_current: boolean;
  last_payment_date: string | null;
}

export interface PaidCustomerProof {
  is_paid_customer: boolean;
  has_active_subscription: boolean;
  has_access_to_pierre: boolean;
  has_valid_company: boolean;
  has_valid_profile: boolean;
  is_payment_current: boolean;
  blockers: string[];
  warnings: string[];
  proof_evaluated_at: string;
}

export interface PaidCustomerChecklistItem {
  id: string;
  label: string;
  description: string;
  critical: boolean;
  check: (state: AccountState) => boolean;
  failure_message: string;
}
