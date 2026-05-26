// src/lib/security/route-guard.ts
// B41 — Route security policy evaluation. Pure, no async.

import type {
  SecurityRoutePolicy,
  SecurityTenantScope,
  SecurityDecision,
  SecurityDecisionStatus,
} from "./types";
import {
  isScopeValid,
  isScopeAuthorizedForPierre,
  isScopeServiceRole,
} from "./tenant-scope";

// ── Access level ordering ─────────────────────────────────────────────────────

const ACCESS_LEVEL_RANK: Record<string, number> = {
  anonymous: 0,
  logged_unpaid: 1,
  trial: 2,
  paid_customer: 3,
  internal_admin: 4,
  service_role: 5,
};

function meetsAccessLevel(
  actual: string,
  required: string,
): boolean {
  const actualRank = ACCESS_LEVEL_RANK[actual] ?? 0;
  const requiredRank = ACCESS_LEVEL_RANK[required] ?? 99;
  return actualRank >= requiredRank;
}

// ── Policy evaluator ──────────────────────────────────────────────────────────

export function evaluateRouteSecurityPolicy(
  policy: SecurityRoutePolicy,
  scope: SecurityTenantScope | null,
): SecurityDecision {
  // Service-role shortcut: if scope is service_role and route allows it → allow immediately
  if (policy.allows_service_role && isScopeServiceRole(scope)) {
    return allow(policy.route_id);
  }

  // Service-role-only routes (required_access_level = service_role)
  if (policy.required_access_level === "service_role") {
    return block("block_service_role_required", policy.route_id, "Route réservée au service interne.");
  }

  // Auth required
  if (!isScopeValid(scope)) {
    return block("block_auth_required", policy.route_id, "Authentification et compte requis.");
  }

  if (!scope) {
    return block("block_auth_required", policy.route_id, "Scope absent.");
  }

  // Access level check
  if (!meetsAccessLevel(scope.access_level, policy.required_access_level)) {
    if (scope.access_level === "anonymous" || scope.access_level === "logged_unpaid") {
      return block("block_not_paid", policy.route_id, "Abonnement actif requis.");
    }
    return block("block_not_paid", policy.route_id, `Niveau d'accès insuffisant : ${scope.access_level} < ${policy.required_access_level}.`);
  }

  // Pierre access check
  if (policy.requires_pierre_access && !isScopeAuthorizedForPierre(scope)) {
    if (!scope.owns_pierre) {
      return block("block_no_agent_access", policy.route_id, "Accès Pierre requis.");
    }
    if (!scope.pierre_enabled) {
      return block("block_no_agent_access", policy.route_id, "Pierre désactivé pour ce compte.");
    }
    return block("block_no_agent_access", policy.route_id, "Accès Pierre non autorisé.");
  }

  // Company scope check
  if (policy.requires_company_scope && !scope.company_id) {
    return block("block_no_company", policy.route_id, "Aucune entreprise associée à ce compte.");
  }

  return allow(policy.route_id);
}

function allow(policyId: string): SecurityDecision {
  return { status: "allow", allowed: true, reason: null, policy_id: policyId };
}

function block(
  status: SecurityDecisionStatus,
  policyId: string,
  reason: string,
): SecurityDecision {
  return { status, allowed: false, reason, policy_id: policyId };
}

// ── Guard builder ─────────────────────────────────────────────────────────────

export function requireRouteAccess(
  policy: SecurityRoutePolicy,
  scope: SecurityTenantScope | null,
): { ok: true } | { ok: false; decision: SecurityDecision } {
  const decision = evaluateRouteSecurityPolicy(policy, scope);
  if (decision.allowed) return { ok: true };
  return { ok: false, decision };
}

export function buildBlockedSecurityResponse(decision: SecurityDecision): {
  body: { ok: false; error: string; code: string };
  status: number;
} {
  const STATUS_MAP: Record<SecurityDecisionStatus, number> = {
    allow: 200,
    block_auth_required: 401,
    block_not_paid: 403,
    block_no_company: 403,
    block_no_agent_access: 403,
    block_tenant_mismatch: 403,
    block_sensitive_scope: 403,
    block_rate_limited: 429,
    block_service_role_required: 403,
    block_invalid_payload: 400,
    block_emergency_shutdown: 503,
  };

  return {
    body: {
      ok: false,
      error: decision.reason ?? "Accès refusé.",
      code: decision.status,
    },
    status: STATUS_MAP[decision.status] ?? 403,
  };
}

// ── Convenience wrapper ───────────────────────────────────────────────────────

export type SecurityGuardedHandler<T> = (scope: SecurityTenantScope) => Promise<T>;

export async function withSecurityGuard<T>(
  policy: SecurityRoutePolicy,
  scope: SecurityTenantScope | null,
  handler: SecurityGuardedHandler<T>,
): Promise<{ ok: true; data: T } | { ok: false; decision: SecurityDecision }> {
  const guard = requireRouteAccess(policy, scope);
  if (!guard.ok) return guard;
  const data = await handler(scope as SecurityTenantScope);
  return { ok: true, data };
}
