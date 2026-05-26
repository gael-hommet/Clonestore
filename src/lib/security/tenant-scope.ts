// src/lib/security/tenant-scope.ts
// B41 — Tenant scope validation. Pure, no async.
// Rule: company_id/user_id client = NEVER source of truth.

import type { SecurityTenantScope, SecurityDecision } from "./types";

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildSecurityTenantScope(raw: {
  user_id?: string | null;
  company_id?: string | null;
  organization_id?: string | null;
  agent_slug?: string | null;
  access_level?: string | null;
  owns_pierre?: boolean;
  pierre_enabled?: boolean;
  source?: string;
}): SecurityTenantScope {
  const access = normalizeAccessLevel(raw.access_level);
  return {
    user_id: raw.user_id ?? null,
    company_id: raw.company_id ?? null,
    organization_id: raw.organization_id ?? null,
    agent_slug: raw.agent_slug ?? null,
    access_level: access,
    owns_pierre: raw.owns_pierre === true,
    pierre_enabled: raw.pierre_enabled !== false && raw.owns_pierre === true,
    source: (raw.source as SecurityTenantScope["source"]) ?? "unknown",
  };
}

function normalizeAccessLevel(raw: string | null | undefined): SecurityTenantScope["access_level"] {
  switch (raw) {
    case "paid_customer": return "paid_customer";
    case "internal_admin": return "internal_admin";
    case "trial": return "trial";
    case "service_role": return "service_role";
    case "logged_unpaid": return "logged_unpaid";
    case "anonymous": return "anonymous";
    default: return "logged_unpaid";
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

export function isScopeValid(scope: SecurityTenantScope | null): boolean {
  if (!scope) return false;
  if (!scope.user_id) return false;
  if (!scope.company_id) return false;
  return true;
}

export function isScopeAuthorizedForPierre(scope: SecurityTenantScope | null): boolean {
  if (!isScopeValid(scope)) return false;
  if (!scope) return false;
  if (scope.access_level === "anonymous" || scope.access_level === "logged_unpaid") return false;
  if (!scope.owns_pierre) return false;
  if (!scope.pierre_enabled) return false;
  return true;
}

export function isScopeServiceRole(scope: SecurityTenantScope | null): boolean {
  return scope?.access_level === "service_role";
}

// ── Tenant match assertion ────────────────────────────────────────────────────

export type TenantMatchResult = {
  match: boolean;
  reason: string | null;
};

export function assertTenantMatch(
  requestedUserId: string | null,
  scope: SecurityTenantScope | null,
): TenantMatchResult {
  if (!scope?.user_id) {
    return { match: false, reason: "Tenant scope has no user_id." };
  }
  if (!requestedUserId) {
    return { match: false, reason: "Requested user_id is empty." };
  }
  if (requestedUserId !== scope.user_id) {
    return {
      match: false,
      reason: `Tenant mismatch: requested ${requestedUserId} but scope is ${scope.user_id}.`,
    };
  }
  return { match: true, reason: null };
}

// ── Spoofing field stripping ──────────────────────────────────────────────────

const SPOOFABLE_FIELDS = [
  "company_id",
  "organization_id",
  "user_id",
  "agent_slug",
  "access_level",
  "owns_pierre",
  "pierre_enabled",
  "source",
];

export function stripTenantSpoofingFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...payload };
  for (const field of SPOOFABLE_FIELDS) {
    delete result[field];
  }
  return result;
}

// ── WHERE clause builder (for documentation — not executed here) ──────────────

export function applyTenantWhereClause(
  scope: SecurityTenantScope,
): { user_id: string; company_id: string } {
  return {
    user_id: scope.user_id ?? "",
    company_id: scope.company_id ?? "",
  };
}

// ── Resource ownership validation ─────────────────────────────────────────────

export function validateResourceOwnership(
  resource: unknown,
  scope: SecurityTenantScope,
): SecurityDecision {
  if (!resource || typeof resource !== "object") {
    return { status: "block_invalid_payload", allowed: false, reason: "Invalid resource.", policy_id: null };
  }

  const r = resource as Record<string, unknown>;
  const resourceUserId = typeof r.user_id === "string" ? r.user_id : null;
  const resourceCompanyId = typeof r.company_id === "string" ? r.company_id : null;

  if (resourceUserId && scope.user_id && resourceUserId !== scope.user_id) {
    return {
      status: "block_tenant_mismatch",
      allowed: false,
      reason: `Resource belongs to user ${resourceUserId}, not ${scope.user_id}.`,
      policy_id: null,
    };
  }

  if (resourceCompanyId && scope.company_id && resourceCompanyId !== scope.company_id) {
    return {
      status: "block_tenant_mismatch",
      allowed: false,
      reason: `Resource belongs to company ${resourceCompanyId}, not ${scope.company_id}.`,
      policy_id: null,
    };
  }

  return { status: "allow", allowed: true, reason: null, policy_id: null };
}
