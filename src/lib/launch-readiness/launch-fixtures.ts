// B48 — Launch Readiness Test Fixtures
// Pure test fixtures. No Supabase, no Next. No throw.

import type { ManualVerificationFlags, LaunchReadinessCheck, LaunchSurface } from "./types";

export const FIXTURE_FLAGS_ALL_FALSE: ManualVerificationFlags = {
  cgu_cgu_validated: false,
  privacy_policy_validated: false,
  legal_review_done: false,
  rls_production_verified: false,
  stripe_production_configured: false,
  domain_dns_configured: false,
  smtp_production_configured: false,
  rgpd_dpa_prepared: false,
  security_audit_done: false,
};

export const FIXTURE_FLAGS_ALL_TRUE: ManualVerificationFlags = {
  cgu_cgu_validated: true,
  privacy_policy_validated: true,
  legal_review_done: true,
  rls_production_verified: true,
  stripe_production_configured: true,
  domain_dns_configured: true,
  smtp_production_configured: true,
  rgpd_dpa_prepared: true,
  security_audit_done: true,
};

export const FIXTURE_FLAGS_BLOCKING_ONLY: ManualVerificationFlags = {
  cgu_cgu_validated: true,
  privacy_policy_validated: true,
  legal_review_done: true,
  rls_production_verified: true,
  stripe_production_configured: true,
  domain_dns_configured: false,
  smtp_production_configured: false,
  rgpd_dpa_prepared: false,
  security_audit_done: false,
};

export const FIXTURE_CHECK_READY: LaunchReadinessCheck = {
  id: "FIXTURE_READY",
  surface: "pierre",
  label: "Test check — ready",
  description: "Fixture check in ready state.",
  status: "ready",
  severity: "info",
  is_manual: false,
  manual_verified: true,
  blocking_public_launch: false,
  notes: null,
  remediation: null,
};

export const FIXTURE_CHECK_BLOCKED: LaunchReadinessCheck = {
  id: "FIXTURE_BLOCKED",
  surface: "legal",
  label: "Test check — blocked",
  description: "Fixture check in blocked state.",
  status: "blocked",
  severity: "critical",
  is_manual: true,
  manual_verified: false,
  blocking_public_launch: true,
  notes: "Not verified.",
  remediation: "Fix the blocker.",
};

export const FIXTURE_CHECK_WARNING: LaunchReadinessCheck = {
  id: "FIXTURE_WARNING",
  surface: "security",
  label: "Test check — warning",
  description: "Fixture check in ready_with_warnings state.",
  status: "ready_with_warnings",
  severity: "warning",
  is_manual: true,
  manual_verified: false,
  blocking_public_launch: false,
  notes: "Needs manual verification.",
  remediation: "Verify manually.",
};

export const FIXTURE_SURFACES: LaunchSurface[] = [
  "public_site",
  "checkout",
  "billing",
  "auth",
  "cockpit",
  "pierre",
  "demo",
  "documents",
  "email",
  "security",
  "rgpd",
  "observability",
  "technologies",
  "legal",
  "operations",
];

export const FIXTURE_BLOCKING_FLAG_KEYS: Array<keyof ManualVerificationFlags> = [
  "cgu_cgu_validated",
  "privacy_policy_validated",
  "legal_review_done",
  "rls_production_verified",
  "stripe_production_configured",
];
