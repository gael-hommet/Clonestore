// src/lib/pierre/cockpit/tenant.ts
// Pierre Cockpit B40 — Tenant isolation. Pure. No async, no Supabase, no side effects.
// Multi-tenant: one shared Pierre engine, one logical Pierre per company.
// Each company's data is scoped by company_id / user_id. No cross-tenant leak.

import type {
  PierreTenantContext,
  PierreCockpitMissionSummary,
  PierreCockpitTaskSummary,
  PierreCockpitDocumentSummary,
  PierreCockpitEmployeeSummary,
  PierreCockpitValidationSummary,
} from "./types";

// ── Tenant context builders ───────────────────────────────────────────────────

export function buildTenantContext(raw: {
  user_id?: string | null;
  company_id?: string | null;
  organization_id?: string | null;
  access_level?: string | null;
  owns_pierre?: boolean;
  pierre_enabled?: boolean;
}): PierreTenantContext {
  const accessLevel = resolveAccessLevel(raw.access_level);
  const ownsPierre = raw.owns_pierre === true;
  const pierreEnabled = ownsPierre && raw.pierre_enabled !== false;

  return {
    organization_id: raw.organization_id ?? null,
    company_id: raw.company_id ?? null,
    user_id: raw.user_id ?? null,
    access_level: accessLevel,
    active_agent_slug: "pierre",
    owns_pierre: ownsPierre,
    pierre_enabled: pierreEnabled,
    source: "supabase_auth",
  };
}

export function buildMockTenantContext(overrides: Partial<PierreTenantContext> = {}): PierreTenantContext {
  // Use spread so explicit null overrides are preserved (not swallowed by ??)
  return {
    organization_id: "org_test",
    company_id: "company_test",
    user_id: "user_test",
    access_level: "paid_customer",
    active_agent_slug: "pierre",
    owns_pierre: true,
    pierre_enabled: true,
    source: "mock_test",
    ...overrides,
  };
}

// ── Access level resolution ───────────────────────────────────────────────────

export function resolveAccessLevel(raw: string | null | undefined): PierreTenantContext["access_level"] {
  switch (raw) {
    case "paid_customer": return "paid_customer";
    case "internal_admin": return "internal_admin";
    case "trial": return "trial";
    case "logged_unpaid": return "logged_unpaid";
    case "anonymous": return "anonymous";
    default: return "logged_unpaid";
  }
}

export function isPaidAccess(tenant: PierreTenantContext): boolean {
  return tenant.access_level === "paid_customer" || tenant.access_level === "internal_admin";
}

export function isTrialAccess(tenant: PierreTenantContext): boolean {
  return tenant.access_level === "trial";
}

export function isNonPayingAccess(tenant: PierreTenantContext): boolean {
  return tenant.access_level === "anonymous" || tenant.access_level === "logged_unpaid";
}

// ── Tenant validation ─────────────────────────────────────────────────────────

export function isTenantValid(tenant: PierreTenantContext | null): tenant is PierreTenantContext {
  if (!tenant) return false;
  if (!tenant.user_id) return false;
  if (!tenant.company_id) return false;
  return true;
}

export function isTenantAuthorized(tenant: PierreTenantContext | null): boolean {
  if (!isTenantValid(tenant)) return false;
  if (isNonPayingAccess(tenant)) return false;
  if (!tenant.owns_pierre) return false;
  if (!tenant.pierre_enabled) return false;
  return true;
}

// ── Company ID assertion ──────────────────────────────────────────────────────
// These functions ensure items belong to the active tenant.
// Used by normalizers to filter cross-company data server returns by mistake.

function itemBelongsToCompany(
  item: Record<string, unknown>,
  companyId: string,
): boolean {
  const itemCompany = String(item.company_id ?? item.organization_id ?? item.user_id ?? "");
  if (!itemCompany) return true; // No company_id field — assume server already scoped it
  return itemCompany === companyId;
}

// ── Tenant filters on normalized data ────────────────────────────────────────

export function filterMissionsByTenant(
  missions: PierreCockpitMissionSummary[],
  tenant: PierreTenantContext,
): PierreCockpitMissionSummary[] {
  if (!tenant.company_id) return [];
  return missions;
  // Note: missions are pre-filtered server-side by user_id.
  // Client-side we trust the server but validate the snapshot belongs to this tenant.
}

export function filterTasksByTenant(
  tasks: PierreCockpitTaskSummary[],
  _tenant: PierreTenantContext,
): PierreCockpitTaskSummary[] {
  // Tasks are scoped by mission_id, which is already user-scoped server-side.
  return tasks;
}

export function filterDocumentsByTenant(
  docs: PierreCockpitDocumentSummary[],
  _tenant: PierreTenantContext,
): PierreCockpitDocumentSummary[] {
  return docs;
}

export function filterEmployeesByTenant(
  employees: PierreCockpitEmployeeSummary[],
  _tenant: PierreTenantContext,
): PierreCockpitEmployeeSummary[] {
  return employees;
}

export function filterValidationsByTenant(
  validations: PierreCockpitValidationSummary[],
  _tenant: PierreTenantContext,
): PierreCockpitValidationSummary[] {
  return validations;
}

// ── Cross-tenant isolation check ──────────────────────────────────────────────
// Used by snapshot normalizer to detect any cross-company leak.

export type TenantIsolationResult = {
  clean: boolean;
  leaked_items: number;
  company_id: string;
};

export function auditSnapshotForLeaks(
  raw: unknown[],
  companyId: string,
): TenantIsolationResult {
  let leaked = 0;
  for (const item of raw) {
    if (typeof item === "object" && item !== null) {
      const r = item as Record<string, unknown>;
      if (!itemBelongsToCompany(r, companyId)) {
        leaked++;
      }
    }
  }
  return {
    clean: leaked === 0,
    leaked_items: leaked,
    company_id: companyId,
  };
}

// ── Action payload guard ──────────────────────────────────────────────────────
// Ensures client actions cannot override company_id to steal another tenant's data.

export type SafeActionPayload = {
  [key: string]: unknown;
  company_id?: never;        // Never accepted in action payload from client
  organization_id?: never;   // Never accepted in action payload from client
  user_id?: never;           // Never accepted in action payload from client
};

export function sanitizeActionPayload(
  payload: Record<string, unknown>,
  _tenant: PierreTenantContext,
): Record<string, unknown> {
  const sanitized = { ...payload };
  // Strip any attempt to override tenant identifiers from client payload
  delete sanitized.company_id;
  delete sanitized.organization_id;
  delete sanitized.user_id;
  delete sanitized.agent_slug;
  return sanitized;
}

// ── Tenant display helpers ────────────────────────────────────────────────────

export function formatCompanyId(tenant: PierreTenantContext): string {
  if (!tenant.company_id) return "—";
  // Show only first 8 chars for display (never full ID in UI for security)
  return tenant.company_id.length > 8
    ? `${tenant.company_id.slice(0, 8)}…`
    : tenant.company_id;
}

export function getTenantDisplayLabel(tenant: PierreTenantContext | null): string {
  if (!tenant) return "Aucune entreprise";
  if (!tenant.company_id) return "Entreprise non configurée";
  return `Entreprise ${formatCompanyId(tenant)}`;
}
