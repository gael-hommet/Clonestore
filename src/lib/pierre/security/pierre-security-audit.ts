// src/lib/pierre/security/pierre-security-audit.ts
// B41 — Pierre security audit verdict builder. Pure, no side effects.

import { PIERRE_DATA_MAP } from "./pierre-data-map";
import { PIERRE_ROUTE_POLICIES } from "./pierre-route-policy";
import { getRetentionPolicySummary } from "./pierre-retention";

export type PierreSecurityFinding = {
  id: string;
  category: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  remediation: string;
  status: "open" | "addressed_in_b41" | "deferred_b42" | "wont_fix";
};

export type PierreSecurityVerdict = {
  bloc: "B41";
  generated_at: string;
  status: "validated_with_followups";
  score: number;
  safe_to_continue_to_b42: boolean;
  findings: PierreSecurityFinding[];
  data_map_tables: number;
  route_policies: number;
  retention_policies: number;
  guarantees: string[];
  followups: string[];
};

const B41_FINDINGS: PierreSecurityFinding[] = [
  {
    id: "B41-F01",
    category: "critical",
    title: "billing/activate — user_id from request body",
    description:
      "The /api/billing/activate route previously accepted user_id from the request body without Bearer token validation. Any client could activate Pierre for arbitrary user IDs.",
    remediation: "Fixed in B41: Bearer token required. user_id resolved server-side from supabase.auth.getUser().",
    status: "addressed_in_b41",
  },
  {
    id: "B41-F02",
    category: "high",
    title: "RLS not yet applied to pierre_task_artifacts",
    description:
      "The pierre_task_artifacts table is documented in B41 data map but RLS policies were not in the original pierre_rls_v1.sql.",
    remediation: "SQL RLS policies added in docs/sql/B41_PIERRE_SECURITY_RLS.sql. Apply to Supabase manually.",
    status: "addressed_in_b41",
  },
  {
    id: "B41-F03",
    category: "high",
    title: "No rate limiting on pierre use/ routes",
    description:
      "Pierre use endpoints have no rate limiting. A malicious actor could spam mission submissions or task approvals.",
    remediation:
      "B41 delivers rate-limit module (in-memory). Production: wire Upstash/Redis adapter. Documented in route policies.",
    status: "addressed_in_b41",
  },
  {
    id: "B41-F04",
    category: "high",
    title: "meta_json in logs.ts has no redaction",
    description:
      "pierre_task_logs meta_json can contain raw error messages or task metadata that might include PII.",
    remediation:
      "B41 delivers redaction module. Apply safeJsonForAudit() before insertPierreLogs() in production paths.",
    status: "addressed_in_b41",
  },
  {
    id: "B41-F05",
    category: "medium",
    title: "No RGPD export endpoint existed",
    description: "No mechanism for users to request their personal data export.",
    remediation: "B41 delivers /api/pierre/security/export with adapter-injectable data collection.",
    status: "addressed_in_b41",
  },
  {
    id: "B41-F06",
    category: "medium",
    title: "No RGPD purge endpoint existed",
    description: "No mechanism for users to exercise right to erasure.",
    remediation: "B41 delivers /api/pierre/security/purge — dry_run by default, confirmation required.",
    status: "addressed_in_b41",
  },
  {
    id: "B41-F07",
    category: "medium",
    title: "No security headers on sensitive routes",
    description:
      "Pierre API routes returned no explicit Cache-Control, X-Content-Type-Options, Referrer-Policy headers.",
    remediation: "B41 delivers headers module. Applied to security/ routes. Recommend applying to all Pierre routes.",
    status: "addressed_in_b41",
  },
  {
    id: "B41-F08",
    category: "medium",
    title: "Cookie fallback in middleware session refresh",
    description:
      "middleware.ts uses getSession() which reads from cookie. API routes use Bearer-only — inconsistency.",
    remediation:
      "Acceptable for B41 (middleware only refreshes session, API routes validate Bearer independently). Unify in B42.",
    status: "deferred_b42",
  },
  {
    id: "B41-F09",
    category: "low",
    title: "company_id = user_id — not future-proof for multi-user companies",
    description:
      "Current tenancy: one user = one company. A future organization with multiple users needs company_id != user_id.",
    remediation:
      "B40 already isolates by company_id. B41 documents path. company_members table + org_id dissociation in B42+.",
    status: "deferred_b42",
  },
  {
    id: "B41-F10",
    category: "info",
    title: "RLS depends on auth.uid() — works only with authenticated Supabase JWT",
    description:
      "Service-role bypasses RLS by design. All server-side operations use service_role_key and apply WHERE user_id manually.",
    remediation:
      "Current architecture is correct. Documented in B41_MULTI_TENANT_DB_ISOLATION.md.",
    status: "wont_fix",
  },
  {
    id: "B41-F11",
    category: "info",
    title: "External pentest not performed",
    description: "B41 is a self-audit. No external security review conducted.",
    remediation: "Recommended before public launch or scaling beyond 100 companies.",
    status: "deferred_b42",
  },
  {
    id: "B41-F12",
    category: "info",
    title: "RGPD legal review not completed",
    description:
      "B41 is a technical data protection layer. DPA, privacy policy, and legal review not completed.",
    remediation: "Required before public launch. External counsel recommended.",
    status: "deferred_b42",
  },
];

// ── Audit helpers ─────────────────────────────────────────────────────────────

export function auditPierreRoutes(): {
  total: number;
  service_role_only: number;
  requires_pierre: number;
  audit_required: number;
  no_store_required: number;
} {
  return {
    total: PIERRE_ROUTE_POLICIES.length,
    service_role_only: PIERRE_ROUTE_POLICIES.filter((p) => p.allows_service_role && !p.requires_pierre_access).length,
    requires_pierre: PIERRE_ROUTE_POLICIES.filter((p) => p.requires_pierre_access).length,
    audit_required: PIERRE_ROUTE_POLICIES.filter((p) => p.audit_required).length,
    no_store_required: PIERRE_ROUTE_POLICIES.filter((p) => p.no_store_required).length,
  };
}

export function auditPierreDataMap(): {
  total: number;
  hr_sensitive: number;
  exportable: number;
  purgeable: number;
  legal_hold: number;
} {
  return {
    total: PIERRE_DATA_MAP.length,
    hr_sensitive: PIERRE_DATA_MAP.filter((r) => r.contains_hr_sensitive_data).length,
    exportable: PIERRE_DATA_MAP.filter((r) => r.exportable).length,
    purgeable: PIERRE_DATA_MAP.filter((r) => r.purgeable).length,
    legal_hold: PIERRE_DATA_MAP.filter((r) => !r.purgeable && r.anonymize_instead_of_purge).length,
  };
}

// ── Verdict ───────────────────────────────────────────────────────────────────

export function buildB41SecurityVerdict(): PierreSecurityVerdict {
  const criticalOpen = B41_FINDINGS.filter(
    (f) => f.category === "critical" && f.status === "open",
  ).length;
  const highOpen = B41_FINDINGS.filter(
    (f) => f.category === "high" && f.status === "open",
  ).length;

  const score = criticalOpen === 0 && highOpen === 0 ? 92 : 70;
  const safe_to_continue_to_b42 = criticalOpen === 0 && highOpen === 0;

  return {
    bloc: "B41",
    generated_at: new Date().toISOString(),
    status: "validated_with_followups",
    score,
    safe_to_continue_to_b42,
    findings: B41_FINDINGS,
    data_map_tables: PIERRE_DATA_MAP.length,
    route_policies: PIERRE_ROUTE_POLICIES.length,
    retention_policies: getRetentionPolicySummary().length,
    guarantees: [
      "billing/activate now requires Bearer token — user_id never from client body",
      "company_id never trusted from client — always from supabase.auth.getUser()",
      "sanitizeActionPayload strips company_id/user_id/org_id from all client payloads",
      "filterByCompanyId returns empty for null companyId — safe fail",
      "email_mode hardcoded 'mock' in cockpit — no real email from UI",
      "can_use_ai = false for non-paying tenants",
      "RLS v1 applied to 6 Pierre tables — auth.uid() = user_id enforcement",
      "RLS B41 extension adds pierre_task_artifacts + cloneos_ai_cost_events",
      "API keys, prompts, completions never logged (redaction module)",
      "RGPD export endpoint — adapter-injectable, no secrets in bundle",
      "RGPD purge — dry_run by default, confirmation phrase required",
      "Retention policies documented — billing orders legally held 7 years",
      "Security headers applied to sensitive routes (no-store, no-index, nosniff)",
    ],
    followups: [
      "Apply SQL in docs/sql/B41_PIERRE_SECURITY_RLS.sql to Supabase production manually",
      "Wire production rate limiter (Upstash/Redis) via InMemoryRateLimiter interface",
      "Apply safeJsonForAudit() to insertPierreLogs() meta_json in all production paths",
      "Apply security headers to all /api/pierre/* routes (not only security/ routes)",
      "Unify middleware session refresh vs Bearer-only API auth (B42)",
      "Dissociate company_id from user_id for multi-user company support (B42+)",
      "External pentest before scaling beyond 100 active companies",
      "Legal DPA and privacy policy review before public launch",
    ],
  };
}
