// B48 — Final Launch Readiness 100% — Types
// Pure: no Supabase, no Next, no async, no side effects. No throw.

export type LaunchReadinessStatus =
  | "ready"
  | "ready_with_warnings"
  | "blocked"
  | "disabled"
  | "not_applicable";

export type LaunchSurface =
  | "public_site"
  | "checkout"
  | "billing"
  | "auth"
  | "cockpit"
  | "pierre"
  | "demo"
  | "documents"
  | "email"
  | "security"
  | "rgpd"
  | "observability"
  | "technologies"
  | "legal"
  | "operations";

export type LaunchSeverity = "info" | "warning" | "blocking" | "critical";

export type LaunchReadinessCheck = {
  id: string;
  surface: LaunchSurface;
  label: string;
  description: string;
  status: LaunchReadinessStatus;
  severity: LaunchSeverity;
  is_manual: boolean;
  manual_verified: boolean;
  blocking_public_launch: boolean;
  notes: string | null;
  remediation: string | null;
};

export type LaunchReadinessReport = {
  surface: LaunchSurface;
  checks: LaunchReadinessCheck[];
  status: LaunchReadinessStatus;
  blocking_count: number;
  warning_count: number;
  ready_count: number;
};

export type B48FinalVerdict = {
  status:
    | "public_launch_ready"
    | "technical_ready_public_blocked"
    | "launch_blocked"
    | "not_evaluated";
  score_0_to_100: number;
  is_technically_complete: boolean;
  is_publicly_launchable: boolean;
  blocking_items: string[];
  manual_items_pending: string[];
  warnings: string[];
  surfaces_ready: LaunchSurface[];
  surfaces_blocked: LaunchSurface[];
  evaluated_at: string;
};

export type PierreLaunchVerdict = {
  status: "pierre_launch_ready" | "pierre_blocked" | "pierre_internal_only";
  is_safe_for_paid_customers: boolean;
  is_safe_for_demo: boolean;
  legal_review_complete: boolean;
  legal_review_required: boolean;
  hard_limits_ok: boolean;
  blocking_items: string[];
  warnings: string[];
  notes: string;
};

export type ManualVerificationFlags = {
  cgu_cgu_validated: boolean;
  privacy_policy_validated: boolean;
  legal_review_done: boolean;
  rls_production_verified: boolean;
  stripe_production_configured: boolean;
  domain_dns_configured: boolean;
  smtp_production_configured: boolean;
  rgpd_dpa_prepared: boolean;
  security_audit_done: boolean;
};
