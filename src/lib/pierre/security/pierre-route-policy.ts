// src/lib/pierre/security/pierre-route-policy.ts
// B41 — Pierre route security policies. Pure map, no side effects.

import type { SecurityRoutePolicy } from "@/lib/security/types";

export const PIERRE_ROUTE_POLICIES: SecurityRoutePolicy[] = [
  // ── Cockpit ──────────────────────────────────────────────────────────────
  {
    route_id: "pierre.cockpit.snapshot",
    path_pattern: "/api/pierre/cockpit/snapshot",
    method: "GET",
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_minute",
    audit_required: false,
    no_store_required: true,
  },

  // ── Mission submission ────────────────────────────────────────────────────
  {
    route_id: "pierre.use.submit",
    path_pattern: "/api/pierre/use/submit",
    method: "POST",
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_minute",
    audit_required: true,
    no_store_required: true,
  },

  // ── Mission read ─────────────────────────────────────────────────────────
  {
    route_id: "pierre.use.mission",
    path_pattern: "/api/pierre/use/mission/*",
    method: ["GET", "POST"],
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_minute",
    audit_required: false,
    no_store_required: true,
  },

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  {
    route_id: "pierre.use.task",
    path_pattern: "/api/pierre/use/task/*",
    method: ["GET", "POST"],
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_minute",
    audit_required: true,
    no_store_required: true,
  },

  // ── History / continuity ──────────────────────────────────────────────────
  {
    route_id: "pierre.use.continuity",
    path_pattern: "/api/pierre/use/continuity",
    method: ["GET", "POST"],
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_minute",
    audit_required: false,
    no_store_required: true,
  },

  // ── Company memory / CloneADN ─────────────────────────────────────────────
  {
    route_id: "pierre.use.cloneadn",
    path_pattern: "/api/pierre/use/cloneadn",
    method: ["GET", "PATCH"],
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_minute",
    audit_required: true,
    no_store_required: true,
  },

  // ── Employees ─────────────────────────────────────────────────────────────
  {
    route_id: "pierre.use.employees",
    path_pattern: "/api/pierre/use/employees*",
    method: ["GET", "POST", "PUT", "PATCH"],
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_minute",
    audit_required: true,
    no_store_required: true,
  },

  // ── Documents ─────────────────────────────────────────────────────────────
  {
    route_id: "pierre.use.doc",
    path_pattern: "/api/pierre/use/doc*",
    method: ["GET", "POST"],
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_minute",
    audit_required: false,
    no_store_required: true,
  },

  // ── Email routes ──────────────────────────────────────────────────────────
  {
    route_id: "pierre.use.email",
    path_pattern: "/api/pierre/use/email*",
    method: ["GET", "POST"],
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "personal",
    rate_limit_key: "user_per_minute",
    audit_required: true,
    no_store_required: true,
  },

  // ── PDF generation ────────────────────────────────────────────────────────
  {
    route_id: "pierre.use.pdf",
    path_pattern: "/api/pierre/use/pdf*",
    method: ["GET", "POST"],
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_minute",
    audit_required: false,
    no_store_required: true,
  },

  // ── Audit trail ───────────────────────────────────────────────────────────
  {
    route_id: "pierre.use.audit-trail",
    path_pattern: "/api/pierre/use/audit-trail*",
    method: "GET",
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: false,
    data_sensitivity: "internal",
    rate_limit_key: "user_per_hour",
    audit_required: false,
    no_store_required: true,
  },

  // ── RGPD Export ───────────────────────────────────────────────────────────
  {
    route_id: "pierre.security.export",
    path_pattern: "/api/pierre/security/export",
    method: ["GET", "POST"],
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: true,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_hour",
    audit_required: true,
    no_store_required: true,
  },

  // ── RGPD Purge ────────────────────────────────────────────────────────────
  {
    route_id: "pierre.security.purge",
    path_pattern: "/api/pierre/security/purge",
    method: "POST",
    required_access_level: "internal_admin",
    requires_pierre_access: false,
    requires_company_scope: true,
    allows_service_role: true,
    data_sensitivity: "hr_sensitive",
    rate_limit_key: "user_per_hour",
    audit_required: true,
    no_store_required: true,
  },

  // ── Security Audit ────────────────────────────────────────────────────────
  {
    route_id: "pierre.security.audit",
    path_pattern: "/api/pierre/security/audit",
    method: "GET",
    required_access_level: "paid_customer",
    requires_pierre_access: true,
    requires_company_scope: true,
    allows_service_role: true,
    data_sensitivity: "internal",
    rate_limit_key: "user_per_hour",
    audit_required: false,
    no_store_required: true,
  },

  // ── Cron / internal workers ───────────────────────────────────────────────
  {
    route_id: "pierre.cron",
    path_pattern: "/api/cron/pierre*",
    method: "POST",
    required_access_level: "service_role",
    requires_pierre_access: false,
    requires_company_scope: false,
    allows_service_role: true,
    data_sensitivity: "internal",
    rate_limit_key: null,
    audit_required: false,
    no_store_required: false,
  },

  // ── Execute (HMAC-authenticated) ──────────────────────────────────────────
  {
    route_id: "pierre.execute",
    path_pattern: "/api/pierre/execute",
    method: "POST",
    required_access_level: "service_role",
    requires_pierre_access: false,
    requires_company_scope: false,
    allows_service_role: true,
    data_sensitivity: "internal",
    rate_limit_key: null,
    audit_required: false,
    no_store_required: false,
  },
];

// ── Lookup ────────────────────────────────────────────────────────────────────

export function getPierreRoutePolicy(routeId: string): SecurityRoutePolicy | null {
  return PIERRE_ROUTE_POLICIES.find((p) => p.route_id === routeId) ?? null;
}

export function getPierreRoutePoliciesByMethod(method: string): SecurityRoutePolicy[] {
  return PIERRE_ROUTE_POLICIES.filter((p) =>
    Array.isArray(p.method) ? p.method.includes(method) : p.method === method,
  );
}

export function getPierreHighSensitivityPolicies(): SecurityRoutePolicy[] {
  return PIERRE_ROUTE_POLICIES.filter(
    (p) => p.data_sensitivity === "hr_sensitive" || p.data_sensitivity === "legal_sensitive",
  );
}

export function getPierreCronPolicies(): SecurityRoutePolicy[] {
  return PIERRE_ROUTE_POLICIES.filter((p) => p.route_id.startsWith("pierre.cron"));
}
