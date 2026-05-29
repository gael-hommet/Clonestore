// P-FINAL 01 — Phase 5 — Stripe live readiness types.
// Pure types only. No imports, no side effects.

export type StripeEnvironment = "test" | "live" | "unknown";
export type StripeCheckStatus = "ok" | "warning" | "blocking";

export interface StripeReadinessCheck {
  id: string;
  label: string;
  description: string;
  status: StripeCheckStatus;
  passes: boolean;
  is_manual: boolean;
  detail?: string;
}

export interface StripeEnvAnalysis {
  environment: StripeEnvironment;
  has_secret_key: boolean;
  has_publishable_key: boolean;
  has_webhook_secret: boolean;
  has_price_id: boolean;
  secret_key_is_live: boolean;
  publishable_key_is_live: boolean;
  all_live_keys: boolean;
  all_test_keys: boolean;
  key_mismatch: boolean;
}

export interface StripeReadinessReport {
  env_analysis: StripeEnvAnalysis;
  checks: StripeReadinessCheck[];
  blocking_count: number;
  warning_count: number;
  is_production_ready: boolean;
  blocking_reason: string | null;
}

export interface StripeManualVerification {
  webhook_endpoint_created: boolean;
  live_payment_tested: boolean;
  subscription_flow_verified: boolean;
  stripe_dashboard_reviewed: boolean;
}
