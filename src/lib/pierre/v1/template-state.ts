// src/lib/pierre/v1/template-state.ts
// PHASE 8.3-B2D §1/§3/§11 — central, non-bypassable template state machine +
// template-scoped audit/CloneTrace/outbox.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import type { TenantContext } from "./tenant-context";

export type TemplateStatus = "draft" | "review_required" | "changes_requested" | "approved" | "published" | "deprecated" | "archived";

export class TemplateTransitionError extends Error {
  readonly code = "illegal_transition";
  readonly status = 409;
  constructor(public from: string, public to: string) { super(`Illegal template transition ${from} -> ${to}`); this.name = "TemplateTransitionError"; }
}

// Exactly the allowed transitions (everything else is forbidden).
const TEMPLATE_TRANSITIONS: Record<TemplateStatus, TemplateStatus[]> = {
  draft: ["review_required"],
  review_required: ["changes_requested", "approved"],
  changes_requested: ["draft"],
  approved: ["published"],
  published: ["deprecated"],
  deprecated: ["archived"],
  archived: [],
};

export function canTemplateTransition(from: string, to: string): boolean {
  return (TEMPLATE_TRANSITIONS[from as TemplateStatus] ?? []).includes(to as TemplateStatus);
}

export function assertTemplateTransition(from: string, to: string): void {
  if (from === to) return;
  if (!canTemplateTransition(from, to)) throw new TemplateTransitionError(from, to);
}

export type TemplateEventKind =
  | "template.created" | "template.version_created" | "template.review_requested" | "template.changes_requested"
  | "template.approved" | "template.approval_invalidated" | "template.published" | "template.deprecated"
  | "template.archived" | "template.preview_rendered" | "template.generation_blocked";

export type TemplateEventData = { template_id?: string | null; version_id?: string | null; status_before?: string | null; status_after?: string | null; fingerprint?: string | null; reason?: string | null; old_fingerprint?: string | null; new_fingerprint?: string | null };

/**
 * Atomically record a template event in THREE places (§6/§7): the append-only
 * template audit (via the SECURITY DEFINER function — the app role has no direct
 * INSERT), the platform CloneTrace (document access log), and the outbox with a
 * DETERMINISTIC dedup key (§8 — idempotent). Call inside the caller's transaction
 * so it rolls back atomically with the state change.
 */
export async function emitTemplateEvent(db: SqlExecutor, ctx: TenantContext, event: TemplateEventKind, data: TemplateEventData): Promise<void> {
  // §5 — append-only audit through the SECURITY DEFINER function.
  await db.query(
    `select pierre_rt_log_template_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [ctx.company_id, data.template_id ?? null, data.version_id ?? null, ctx.user_id, event, data.status_before ?? null, data.status_after ?? null, data.fingerprint ?? null, data.reason ?? null, ctx.correlation_id ?? null, data.old_fingerprint ?? null, data.new_fingerprint ?? null]);
  // §6 — real platform CloneTrace (the document access log).
  await db.query(
    `insert into pierre_rt_document_access_log (id, company_id, document_id, version_id, actor_user_id, action, detail) values ($1,$2,null,$3,$4,$5,$6)`,
    [newUuid(), ctx.company_id, data.version_id ?? null, ctx.user_id, event, JSON.stringify({ template_id: data.template_id, status_before: data.status_before, status_after: data.status_after, reason: data.reason })]);
  // §8 — deterministic dedup key (no random suffix): same logical event ⇒ one outbox row.
  const dedup = [event, data.template_id ?? "_", data.version_id ?? "_", data.status_before ?? "_", data.status_after ?? "_", data.fingerprint ?? "_"].join(":");
  await db.query(
    `insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key) values ($1,$2,$3,$4,$5) on conflict (company_id, dedup_key) do nothing`,
    [newUuid(), ctx.company_id, event, JSON.stringify({ ...data }), dedup]);
}
