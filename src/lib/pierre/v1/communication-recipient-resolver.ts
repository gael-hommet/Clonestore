// src/lib/pierre/v1/communication-recipient-resolver.ts
// PHASE 8.4-R1.4 — STRICT per-strategy recipient resolution from REAL, tenant-scoped data. Each
// recipientStrategy has its own resolver reading the actual business object's real fields (approver,
// requester/creator, coordinator, owner, template author, task target) — NOT "the first owner/admin"
// by default. A free payload value is never authoritative; a cross-tenant object is invisible; an
// ambiguous/absent recipient blocks the communication. A generic owner/admin fallback is used ONLY
// when the event policy explicitly declares `fallbackStrategy: "tenant_owner"`.

import type { SqlExecutor } from "./sql";
import type { TenantContext } from "./tenant-context";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type RecipientStrategy = "document_approver" | "document_requester" | "signature_coordinator" | "contract_owner" | "template_author" | "task_target" | "invited_email";

export type ResolvedRecipient = {
  recipient_type: string;
  recipient_role: string;
  resolved_user_id: string | null;
  resolved_membership_id: string | null;
  resolved_employee_id: string | null;
  resolved_email: string | null;
  resolution_source: string;
};
export type RecipientResolution = {
  resolved: boolean;
  object_label: string;
  document_id: string | null;
  recipient: ResolvedRecipient | null;
  blockers: string[];
};

type Target = { user_id?: string | null; membership_id?: string | null; employee_id?: string | null; source: string };

// ── object loading (tenant-scoped) + per-strategy target identity ──────────────────────
async function loadObjectAndTarget(db: SqlExecutor, ctx: TenantContext, strategy: string, objectType: string, objectId: string | null, payload: Record<string, unknown>): Promise<{ exists: boolean; label: string; documentId: string | null; target: Target | null }> {
  if (objectType === "mission_task") {
    if (!objectId) return { exists: false, label: "", documentId: null, target: null };
    // R1.4 — a mission task MUST be a real persisted object, never just a payload.objective string.
    const t = (await db.query<{ id: string; objective: string | null; owner: string | null }>(`select id, objective, owner from pierre_rt_tasks where company_id=$1 and id=$2`, [ctx.company_id, objectId])).rows[0];
    if (!t) return { exists: false, label: "", documentId: null, target: null };
    // task owner is a membership/user reference; resolve via members if it matches a user, else a membership
    return { exists: true, label: (t.objective ?? "Notification").slice(0, 140), documentId: null, target: t.owner ? { user_id: t.owner, source: "tasks.owner" } : null };
  }
  if (!objectId) return { exists: false, label: "", documentId: null, target: null };

  if (objectType === "contract") {
    const r = (await db.query<{ document_id: string | null; approved_by: string | null; first_name: string | null; last_name: string | null }>(
      `select c.document_id, c.approved_by, e.first_name, e.last_name from pierre_rt_employee_contracts c left join pierre_rt_employees e on e.company_id=c.company_id and e.id=c.employee_id where c.company_id=$1 and c.id=$2`, [ctx.company_id, objectId])).rows[0];
    if (!r) return { exists: false, label: "", documentId: null, target: null };
    const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
    const label = name ? `Contrat de ${name}` : "Contrat";
    // contract_owner → the approver who validated it (real field); signature_coordinator → same owner
    return { exists: true, label, documentId: r.document_id, target: r.approved_by ? { user_id: r.approved_by, source: "employee_contracts.approved_by" } : null };
  }
  if (objectType === "document") {
    const r = (await db.query<{ title: string | null; created_by: string | null; approved_by: string | null; owner_membership_id: string | null }>(
      `select title, created_by, approved_by, owner_membership_id from pierre_rt_documents where company_id=$1 and id=$2`, [ctx.company_id, objectId])).rows[0];
    if (!r) return { exists: false, label: "", documentId: null, target: null };
    const label = r.title ?? "Document";
    if (strategy === "document_requester") return { exists: true, label, documentId: objectId, target: r.created_by ? { user_id: r.created_by, source: "documents.created_by" } : null };
    // document_approver → the assigned approver: owner_membership_id (the approval owner), else the
    // already-recorded approver. NEVER the first admin by default.
    if (r.owner_membership_id) return { exists: true, label, documentId: objectId, target: { membership_id: r.owner_membership_id, source: "documents.owner_membership_id" } };
    return { exists: true, label, documentId: objectId, target: r.approved_by ? { user_id: r.approved_by, source: "documents.approved_by" } : null };
  }
  if (objectType === "signature_request") {
    const r = (await db.query<{ document_id: string | null; title: string | null; created_by: string | null; approved_by: string | null }>(
      `select sr.document_id, sr.created_by, d.title, d.approved_by from pierre_rt_signature_requests sr left join pierre_rt_documents d on d.company_id=sr.company_id and d.id=sr.document_id where sr.company_id=$1 and sr.id=$2`, [ctx.company_id, objectId])).rows[0];
    if (!r) return { exists: false, label: "", documentId: null, target: null };
    const label = r.title ?? "Document à signer";
    // signature_coordinator → who prepared/may submit the signature: the request creator, else the document owner
    return { exists: true, label, documentId: r.document_id, target: r.created_by ? { user_id: r.created_by, source: "signature_requests.created_by" } : (r.approved_by ? { user_id: r.approved_by, source: "documents.approved_by" } : null) };
  }
  if (objectType === "template") {
    const r = (await db.query<{ name: string | null; created_by: string | null }>(`select name, created_by from pierre_rt_document_templates where company_id=$1 and id=$2`, [ctx.company_id, objectId])).rows[0];
    if (!r) return { exists: false, label: "", documentId: null, target: null };
    return { exists: true, label: r.name ?? "Modèle", documentId: null, target: r.created_by ? { user_id: r.created_by, source: "document_templates.created_by" } : null };
  }
  return { exists: false, label: "", documentId: null, target: null };
}

async function memberByUser(db: SqlExecutor, ctx: TenantContext, userId: string): Promise<{ membership_id: string; user_id: string } | null> {
  const r = (await db.query<{ id: string; user_id: string }>(`select id, user_id from pierre_rt_members where company_id=$1 and user_id=$2 and (status is null or status='active') limit 1`, [ctx.company_id, userId])).rows[0];
  return r ? { membership_id: r.id, user_id: r.user_id } : null;
}
async function memberById(db: SqlExecutor, ctx: TenantContext, membershipId: string): Promise<{ membership_id: string; user_id: string } | null> {
  const r = (await db.query<{ id: string; user_id: string }>(`select id, user_id from pierre_rt_members where company_id=$1 and id=$2 and (status is null or status='active') limit 1`, [ctx.company_id, membershipId])).rows[0];
  return r ? { membership_id: r.id, user_id: r.user_id } : null;
}
async function tenantOwner(db: SqlExecutor, ctx: TenantContext): Promise<{ membership_id: string; user_id: string } | null> {
  const r = (await db.query<{ id: string; user_id: string }>(`select id, user_id from pierre_rt_members where company_id=$1 and (status is null or status='active') and role in ('owner','admin') order by case role when 'owner' then 0 else 1 end, created_at asc limit 1`, [ctx.company_id])).rows[0];
  return r ? { membership_id: r.id, user_id: r.user_id } : null;
}

/**
 * Resolve the recipient for a communication via its STRATEGY. The in-app recipient is the resolved
 * real member; the email is the employee's own address (employee targets) or the company signatory
 * (employer operators). Fail-closed: no object / no resolvable member / no valid email when required.
 */
export async function resolveCommunicationRecipient(
  db: SqlExecutor, ctx: TenantContext,
  input: { recipientStrategy: string; objectType: string; objectId: string | null; payload: Record<string, unknown>; requiresEmail: boolean; fallbackStrategy?: string | null },
): Promise<RecipientResolution> {
  const blockers: string[] = [];

  // PHASE 8.6 — invitations target an EXTERNAL email (the invitee is not yet a member, so there is no
  // in-app recipient). The address is NOT trusted from the payload: it is read from the persisted,
  // tenant-scoped invitation row (a real object field, exactly like every other strategy). A cross-tenant
  // or absent invitation is invisible; a missing/invalid address blocks the communication.
  if (input.recipientStrategy === "invited_email") {
    if (!input.objectId) { blockers.push("object_not_found_in_tenant"); return { resolved: false, object_label: "", document_id: null, recipient: null, blockers }; }
    const inv = (await db.query<{ email: string | null }>(`select email from pierre_rt_invitations where company_id=$1 and id=$2 and status='pending'`, [ctx.company_id, input.objectId])).rows[0];
    if (!inv) { blockers.push("object_not_found_in_tenant"); return { resolved: false, object_label: "", document_id: null, recipient: null, blockers }; }
    const invEmail = inv.email && EMAIL_RE.test(inv.email) ? inv.email : null;
    if (!invEmail) blockers.push("no_valid_invitee_email");
    const recipient: ResolvedRecipient = {
      recipient_type: "external_recipient", recipient_role: "invited_email",
      resolved_user_id: null, resolved_membership_id: null, resolved_employee_id: null,
      resolved_email: invEmail, resolution_source: "invitations.email",
    };
    return { resolved: blockers.length === 0, object_label: "Invitation", document_id: null, recipient, blockers };
  }

  const loaded = await loadObjectAndTarget(db, ctx, input.recipientStrategy, input.objectType, input.objectId, input.payload);
  if (!loaded.exists) { blockers.push("object_not_found_in_tenant"); return { resolved: false, object_label: "", document_id: null, recipient: null, blockers }; }

  // resolve the target member (the real person from the object's real field)
  let member: { membership_id: string; user_id: string } | null = null;
  let source = "";
  if (loaded.target?.membership_id) { member = await memberById(db, ctx, loaded.target.membership_id); source = loaded.target.source; }
  else if (loaded.target?.user_id) { member = await memberByUser(db, ctx, loaded.target.user_id); source = loaded.target.source; }

  // explicit, policy-declared fallback ONLY (never a silent owner/admin default)
  if (!member && input.fallbackStrategy === "tenant_owner") { member = await tenantOwner(db, ctx); source = "policy_fallback:tenant_owner"; }
  if (!member) { blockers.push("recipient_not_resolved"); return { resolved: false, object_label: loaded.label, document_id: loaded.documentId, recipient: null, blockers }; }

  // employer email = the company signatory (a REAL tenant identity, never a payload value)
  const co = (await db.query<{ signatory_email: string | null }>(`select signatory_email from pierre_rt_companies where id=$1`, [ctx.company_id])).rows[0];
  const email = co?.signatory_email && EMAIL_RE.test(co.signatory_email) ? co.signatory_email : null;
  if (input.requiresEmail && !email) blockers.push("no_valid_employer_email");

  const recipient: ResolvedRecipient = {
    recipient_type: "employer_operator",
    recipient_role: input.recipientStrategy,
    resolved_user_id: member.user_id,
    resolved_membership_id: member.membership_id,
    resolved_employee_id: null,
    resolved_email: email,
    resolution_source: source,
  };
  return { resolved: blockers.length === 0, object_label: loaded.label, document_id: loaded.documentId, recipient, blockers };
}
