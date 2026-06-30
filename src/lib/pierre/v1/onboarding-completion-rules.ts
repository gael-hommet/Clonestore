// src/lib/pierre/v1/onboarding-completion-rules.ts
// PHASE 8.6 — server-authoritative onboarding COMPLETION RULES (spec §6/§21).
//
// A step is NOT complete because the client called PATCH /steps/{step}. Each step has a real verification
// that queries PERSISTED tenant data; the server decides completeness and computes the evidence hash from
// the verified facts (the client never supplies completed=true, progress_percent, nor an authoritative
// evidence_hash). Dependencies are enforced. An unknown product is refused (never defaults to Pierre).

import { createHash } from "crypto";
import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";
import { getOnboardingRegistry, getOnboardingStep } from "./onboarding-registry";

export type CompletionVerdict = { ok: boolean; reason?: string; evidence?: Record<string, unknown> };
export type CompletionRule = (db: SqlExecutor, ctx: TenantContext, data: Record<string, unknown>) => Promise<CompletionVerdict>;

async function company(db: SqlExecutor, companyId: string): Promise<Record<string, unknown> | null> {
  const { rows } = await db.query<Record<string, unknown>>(
    `select name, legal_name, display_name, registration_country, registration_number, timezone,
            default_locale, default_currency, default_autonomy_mode, owner_user_id
       from pierre_rt_companies where id=$1`, [companyId]);
  return rows[0] ?? null;
}
async function activeMembersWithAnyRoleKey(db: SqlExecutor, companyId: string, roleKeys: string[]): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(distinct m.id)::int as n
       from pierre_rt_members m
       join pierre_rt_membership_roles mr on mr.company_id = m.company_id and mr.membership_id = m.id
      where m.company_id=$1 and m.status='active' and mr.role_key = any($2)`, [companyId, roleKeys]);
  return rows[0]?.n ?? 0;
}
async function activeMemberCount(db: SqlExecutor, companyId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from pierre_rt_members where company_id=$1 and status='active'`, [companyId]);
  return rows[0]?.n ?? 0;
}
async function employeeCount(db: SqlExecutor, companyId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from pierre_rt_employees where company_id=$1`, [companyId]).catch(() => ({ rows: [{ n: 0 }] }));
  return rows[0]?.n ?? 0;
}
const present = (v: unknown): boolean => typeof v === "string" ? v.trim().length > 0 : v != null;

// Real per-step verification against persisted tenant data. Each returns the evidence the hash is derived from.
const PIERRE_RULES: Record<string, CompletionRule> = {
  company_identity: async (db, ctx) => {
    const c = await company(db, ctx.company_id);
    if (!c) return { ok: false, reason: "company_not_found" };
    const need = ["name", "registration_country", "timezone", "default_locale"];
    const missing = need.filter((k) => !present(c[k]));
    if (missing.length) return { ok: false, reason: `missing:${missing.join(",")}` };
    return { ok: true, evidence: { name: c.name, country: c.registration_country, tz: c.timezone, locale: c.default_locale } };
  },
  company_legal_information: async (db, ctx) => {
    const c = await company(db, ctx.company_id);
    if (!c) return { ok: false, reason: "company_not_found" };
    if (!present(c.legal_name) && !present(c.registration_number)) return { ok: false, reason: "missing_legal_identity" };
    return { ok: true, evidence: { legal_name: c.legal_name ?? null, registration_number: c.registration_number ?? null } };
  },
  hr_contacts: async (db, ctx) => {
    const n = await activeMembersWithAnyRoleKey(db, ctx.company_id, ["OWNER", "ADMIN", "HR_DIRECTOR", "HR_MANAGER"]);
    if (n < 1) return { ok: false, reason: "no_hr_responsible_member" };
    return { ok: true, evidence: { hr_responsible_members: n } };
  },
  approval_responsibilities: async (db, ctx) => {
    const n = await activeMembersWithAnyRoleKey(db, ctx.company_id, ["OWNER", "ADMIN", "HR_DIRECTOR", "HR_MANAGER", "VALIDATOR"]);
    if (n < 1) return { ok: false, reason: "no_approver_configured" };
    return { ok: true, evidence: { approvers: n } };
  },
  signature_configuration: async (db, ctx) => {
    // a real signatory must be an active member who can carry the responsibility (owner/admin/hr_director).
    const n = await activeMembersWithAnyRoleKey(db, ctx.company_id, ["OWNER", "ADMIN", "HR_DIRECTOR"]);
    if (n < 1) return { ok: false, reason: "no_signatory_configured" };
    return { ok: true, evidence: { signatories: n } };
  },
  communication_preferences: async (db, ctx) => {
    const c = await company(db, ctx.company_id);
    if (!c) return { ok: false, reason: "company_not_found" };
    if (!present(c.default_locale) || !present(c.timezone)) return { ok: false, reason: "missing_comm_locale_or_timezone" };
    return { ok: true, evidence: { locale: c.default_locale, tz: c.timezone } };
  },
  team_members: async (db, ctx) => {
    // the owner may assume all roles alone, but at least one active member must exist.
    const n = await activeMemberCount(db, ctx.company_id);
    if (n < 1) return { ok: false, reason: "no_active_member" };
    return { ok: true, evidence: { active_members: n } };
  },
  employee_data: async (db, ctx, data) => {
    // optional step: complete when employees exist OR the owner explicitly decides "none for now".
    const n = await employeeCount(db, ctx.company_id);
    const explicitNone = data?.no_employees_for_now === true;
    if (n < 1 && !explicitNone) return { ok: false, reason: "no_employees_and_no_explicit_skip" };
    return { ok: true, evidence: { employees: n, explicit_none: explicitNone } };
  },
  hr_policies: async (db, ctx) => {
    const c = await company(db, ctx.company_id);
    if (!c) return { ok: false, reason: "company_not_found" };
    if (!present(c.default_autonomy_mode)) return { ok: false, reason: "missing_autonomy_policy" };
    return { ok: true, evidence: { autonomy: c.default_autonomy_mode } };
  },
  first_mission_ready: async (db, ctx) => {
    // all required upstream steps must be completed (dependency-enforced by the service too) AND the
    // tenant must have an active/grace entitlement so a P8.5 mission can actually run.
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from pierre_rt_product_entitlements where company_id=$1 and status in ('active','grace')`, [ctx.company_id]);
    if ((rows[0]?.n ?? 0) < 1) return { ok: false, reason: "no_active_entitlement_for_mission" };
    return { ok: true, evidence: { mission_ready: true } };
  },
};

const RULES_BY_PRODUCT: Record<string, Record<string, CompletionRule>> = { pierre: PIERRE_RULES };

/** Refuse an unknown product (never default to Pierre). */
export function assertKnownProduct(productKey: string): void {
  if (!RULES_BY_PRODUCT[productKey]) {
    const err = new Error(`unknown onboarding product: ${productKey}`);
    (err as Error & { code?: string; status?: number }).code = "unknown_product";
    (err as Error & { code?: string; status?: number }).status = 422;
    throw err;
  }
}

export function getCompletionRule(stepKey: string, productKey = "pierre"): CompletionRule | null {
  assertKnownProduct(productKey);
  return RULES_BY_PRODUCT[productKey][stepKey] ?? null;
}

/** Deterministic server-computed evidence hash (never supplied by the client). */
export function computeEvidenceHash(stepKey: string, productKey: string, evidence: Record<string, unknown> | undefined): string {
  const def = getOnboardingStep(stepKey, productKey);
  const canonical = JSON.stringify({ step: stepKey, product: productKey, v: def?.version ?? "1", evidence: evidence ?? {} }, Object.keys({ step: 0, product: 0, v: 0, evidence: 0 }).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/** Which declared dependencies of a step are NOT yet completed in the session. */
export async function unmetDependencies(
  db: SqlExecutor, companyId: string, sessionId: string, stepKey: string, productKey = "pierre",
): Promise<string[]> {
  const def = getOnboardingStep(stepKey, productKey);
  if (!def || def.dependencies.length === 0) return [];
  const { rows } = await db.query<{ step_key: string; status: string }>(
    `select step_key, status from pierre_rt_onboarding_steps where company_id=$1 and session_id=$2 and step_key = any($3)`,
    [companyId, sessionId, def.dependencies]);
  const completed = new Set(rows.filter((r) => r.status === "completed").map((r) => r.step_key));
  return def.dependencies.filter((d) => !completed.has(d));
}

export { getOnboardingRegistry };
