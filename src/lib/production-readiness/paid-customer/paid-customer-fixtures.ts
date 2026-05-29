// P-FINAL 01 — Phase 7 — Paid customer test fixtures.
// Pure: no Supabase, no Next, no async, no throw.

import type { AccountState } from "./paid-customer-types";

// Fully qualified paid customer — everything correct
export const FIXTURE_FULL_PAID_CUSTOMER: AccountState = {
  company_id: "co_demo_123",
  has_company_record: true,
  has_user_profile: true,
  subscription_status: "active",
  stripe_customer_id: "cus_demo_456",
  stripe_subscription_id: "sub_demo_789",
  subscription_start_date: "2026-05-01T00:00:00.000Z",
  subscription_end_date: null,
  pierre_access_level: "full",
  is_payment_current: true,
  last_payment_date: "2026-05-01T00:00:00.000Z",
};

// No subscription at all
export const FIXTURE_NO_SUBSCRIPTION: AccountState = {
  company_id: "co_new_123",
  has_company_record: true,
  has_user_profile: true,
  subscription_status: "none",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_start_date: null,
  subscription_end_date: null,
  pierre_access_level: "none",
  is_payment_current: false,
  last_payment_date: null,
};

// Past due — payment failed
export const FIXTURE_PAST_DUE: AccountState = {
  company_id: "co_past_due",
  has_company_record: true,
  has_user_profile: true,
  subscription_status: "past_due",
  stripe_customer_id: "cus_past_due_456",
  stripe_subscription_id: "sub_past_due_789",
  subscription_start_date: "2026-04-01T00:00:00.000Z",
  subscription_end_date: null,
  pierre_access_level: "limited",
  is_payment_current: false,
  last_payment_date: "2026-04-01T00:00:00.000Z",
};

// Canceled subscription
export const FIXTURE_CANCELED: AccountState = {
  company_id: "co_canceled",
  has_company_record: true,
  has_user_profile: true,
  subscription_status: "canceled",
  stripe_customer_id: "cus_canceled_456",
  stripe_subscription_id: "sub_canceled_789",
  subscription_start_date: "2026-01-01T00:00:00.000Z",
  subscription_end_date: "2026-04-30T00:00:00.000Z",
  pierre_access_level: "none",
  is_payment_current: false,
  last_payment_date: "2026-04-01T00:00:00.000Z",
};

// Trialing (still valid)
export const FIXTURE_TRIALING: AccountState = {
  company_id: "co_trial",
  has_company_record: true,
  has_user_profile: true,
  subscription_status: "trialing",
  stripe_customer_id: "cus_trial_456",
  stripe_subscription_id: "sub_trial_789",
  subscription_start_date: "2026-05-20T00:00:00.000Z",
  subscription_end_date: null,
  pierre_access_level: "full",
  is_payment_current: true,
  last_payment_date: null,
};

// Missing company record
export const FIXTURE_MISSING_COMPANY: AccountState = {
  company_id: "co_missing",
  has_company_record: false,
  has_user_profile: false,
  subscription_status: "active",
  stripe_customer_id: "cus_missing_456",
  stripe_subscription_id: "sub_missing_789",
  subscription_start_date: "2026-05-01T00:00:00.000Z",
  subscription_end_date: null,
  pierre_access_level: "none",
  is_payment_current: true,
  last_payment_date: "2026-05-01T00:00:00.000Z",
};
