// src/lib/pierre/v1/cockpit-snapshot.ts
// PHASE 8.6 — the REAL private cockpit snapshot. A single, server-authoritative aggregation over the
// governed tables (company, membership, entitlement, onboarding, missions/runs, validations, documents,
// signatures, communications, members, employees). Every datum is read from the real source for the
// active tenant — NEVER a mock, a constant, a demo, or localStorage. A failed query PROPAGATES as a
// structured error (the route returns errorBody); it is NEVER swallowed into a zero count or empty list.
// Permission-sensitive sections carry an explicit `permitted` flag instead of a silent empty list.

import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";
import { getEntitlement, getOnboardingSession, type ProductAccess } from "./entitlements";

const has = (ctx: TenantContext, perm: string): boolean => (ctx.permissions ?? []).includes(perm);

export type CockpitOverview = {
  active_missions: number;
  waiting_missions: number;
  required_validations: number;
  pending_documents: number;
  pending_signatures: number;
  blocked_communications: number;
  active_members: number;
  employees_count: number;
};

export type CockpitSnapshot = {
  generated_at: string;
  company: { id: string; name: string | null; status: string | null; onboarding_status: string | null; registration_country: string | null; legal_name: string | null };
  membership: { user_id: string | null; membership_id: string | null; role: string | null };
  role: string | null;
  role_keys: string[];
  permissions: string[];
  product_access: ProductAccess;
  entitlement: { status: string; source_type: string; grace_until: string | null } | null;
  onboarding: { status: string; progress_percent: number; current_step_key: string | null } | null;
  overview: CockpitOverview;
  next_action: string;
  blockers: string[];
  missions: Array<{ run_id: string; mission_id: string; status: string; instruction: string | null; created_at: string }>;
  validations: Array<{ id: string; mission_id: string | null; status: string; created_at: string }>;
  members: Array<{ id: string; user_id: string; role: string; status: string | null }>;
  employees: { permitted: boolean; items: Array<{ id: string; first_name: string | null; last_name: string | null; status: string }> };
  documents: { permitted: boolean; items: Array<{ id: string; title: string | null; status: string; created_at: string }> };
  signatures: { permitted: boolean; items: Array<{ id: string; status: string; created_at: string }> };
  contracts: { permitted: boolean; count: number };
  messages: { permitted: boolean; items: Array<{ id: string; subject: string | null; status: string | null; created_at: string }> };
};

/**
 * Build the cockpit snapshot for the active tenant. `access` is the already-resolved product-access
 * decision (the route gates on READ before calling this). `nowIso` is injected so the route stamps the
 * generation time (keeps this pure/testable). Throws on any data error (never returns degraded zeros).
 */
export async function buildCockpitSnapshot(
  db: SqlExecutor, ctx: TenantContext, access: ProductAccess, nowIso: string,
): Promise<CockpitSnapshot> {
  const companyId = ctx.company_id!;

  const company = (await db.query<{ id: string; name: string | null; status: string | null; onboarding_status: string | null; registration_country: string | null; legal_name: string | null }>(
    `select id, name, status, onboarding_status, registration_country, legal_name from pierre_rt_companies where id=$1`, [companyId])).rows[0];
  if (!company) throw new Error("active company not found");

  const ent = await getEntitlement(db, companyId);
  const onb = await getOnboardingSession(db, companyId);

  const overview = (await db.query<CockpitOverview>(
    `select
       (select count(*) from pierre_rt_mission_runs where company_id=$1 and status in ('queued','running','waiting','paused','blocked'))::int as active_missions,
       (select count(*) from pierre_rt_mission_runs where company_id=$1 and status='waiting')::int as waiting_missions,
       (select count(*) from pierre_rt_validations where company_id=$1 and status='pending')::int as required_validations,
       (select count(*) from pierre_rt_documents where company_id=$1 and status in ('draft','under_review','changes_requested'))::int as pending_documents,
       (select count(*) from pierre_rt_signature_requests where company_id=$1 and status in ('draft','preparing','awaiting_approval','ready','submitted','in_progress','partially_signed'))::int as pending_signatures,
       (select count(*) from pierre_rt_communication_deliveries where company_id=$1 and status in ('dead_letter','failed','bounced','submission_unknown'))::int as blocked_communications,
       (select count(*) from pierre_rt_members where company_id=$1 and (status is null or status='active'))::int as active_members,
       (select count(*) from pierre_rt_employees where company_id=$1 and status <> 'left')::int as employees_count`,
    [companyId])).rows[0];

  const missions = (await db.query<{ run_id: string; mission_id: string; status: string; instruction: string | null; created_at: string }>(
    `select r.id as run_id, r.mission_id, r.status, m.instruction, r.created_at
       from pierre_rt_mission_runs r join pierre_rt_missions m on m.company_id=r.company_id and m.id=r.mission_id
      where r.company_id=$1 order by r.created_at desc limit 20`, [companyId])).rows;

  const validations = (await db.query<{ id: string; mission_id: string | null; status: string; created_at: string }>(
    `select id, mission_id, status, created_at from pierre_rt_validations where company_id=$1 and status='pending' order by created_at desc limit 20`, [companyId])).rows;

  const members = (await db.query<{ id: string; user_id: string; role: string; status: string | null }>(
    `select id, user_id, role, status from pierre_rt_members where company_id=$1 order by created_at asc limit 50`, [companyId])).rows;

  const employees = has(ctx, "employee.read")
    ? { permitted: true, items: (await db.query<{ id: string; first_name: string | null; last_name: string | null; status: string }>(
        `select id, first_name, last_name, status from pierre_rt_employees where company_id=$1 and status <> 'left' order by created_at desc limit 20`, [companyId])).rows }
    : { permitted: false, items: [] };

  const documents = has(ctx, "document.read")
    ? { permitted: true, items: (await db.query<{ id: string; title: string | null; status: string; created_at: string }>(
        `select id, title, status, created_at from pierre_rt_documents where company_id=$1 order by created_at desc limit 20`, [companyId])).rows }
    : { permitted: false, items: [] };

  const signatures = has(ctx, "document.read")
    ? { permitted: true, items: (await db.query<{ id: string; status: string; created_at: string }>(
        `select id, status, created_at from pierre_rt_signature_requests where company_id=$1 order by created_at desc limit 20`, [companyId])).rows }
    : { permitted: false, items: [] };

  const contracts = has(ctx, "document.read")
    ? { permitted: true, count: (await db.query<{ n: number }>(`select count(*)::int n from pierre_rt_employee_contracts where company_id=$1`, [companyId])).rows[0].n }
    : { permitted: false, count: 0 };

  // internal messages = the current user's notifications inbox (real, per-recipient)
  const messages = { permitted: true, items: (await db.query<{ id: string; subject: string | null; status: string | null; created_at: string }>(
    `select id, title as subject, case when read_at is null then 'unread' else 'read' end as status, created_at
       from pierre_rt_notifications where company_id=$1 and recipient_user_id=$2 and archived_at is null order by created_at desc limit 20`, [companyId, ctx.user_id])).rows };

  return {
    generated_at: nowIso,
    company: { id: company.id, name: company.name, status: company.status, onboarding_status: company.onboarding_status, registration_country: company.registration_country, legal_name: company.legal_name },
    membership: { user_id: ctx.user_id, membership_id: ctx.membership_id ?? null, role: ctx.role ?? null },
    role: ctx.role ?? null,
    role_keys: [...(ctx.role_keys ?? [])],
    permissions: [...(ctx.permissions ?? [])],
    product_access: access,
    entitlement: ent ? { status: ent.status, source_type: ent.source_type, grace_until: ent.grace_until } : null,
    onboarding: onb ? { status: onb.status, progress_percent: onb.progress_percent, current_step_key: onb.current_step_key } : null,
    overview,
    next_action: deriveNextAction(access, onb?.status ?? null, overview),
    blockers: deriveBlockers(access, onb?.status ?? null),
    missions, validations, members, employees, documents, signatures, contracts, messages,
  };
}

function deriveNextAction(access: ProductAccess, onboardingStatus: string | null, o: CockpitOverview): string {
  if (access.decision === "denied") return "contact_support";
  if (access.decision === "suspended" || access.decision === "read_only") return "reactivate_subscription";
  if (access.decision === "onboarding_required" || onboardingStatus !== "completed") return "complete_onboarding";
  if (o.required_validations > 0) return "review_validations";
  if (o.active_missions === 0) return "launch_first_mission";
  return "monitor_operations";
}

function deriveBlockers(access: ProductAccess, onboardingStatus: string | null): string[] {
  const b: string[] = [];
  if (access.decision === "denied") b.push("no_entitlement");
  if (access.decision === "suspended") b.push("entitlement_suspended");
  if (access.decision === "read_only") b.push("entitlement_inactive");
  if (access.decision === "grace") b.push("payment_grace");
  if (access.decision === "onboarding_required" || onboardingStatus !== "completed") b.push("onboarding_incomplete");
  return b;
}
