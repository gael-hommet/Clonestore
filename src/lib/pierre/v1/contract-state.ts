// src/lib/pierre/v1/contract-state.ts
// PHASE 8.3-B2G §5/§11 — contract workflow STATE MACHINE (pure, mirrors the v14 DB trigger)
// + atomic event emission (append-only audit via SECURITY DEFINER + real CloneTrace +
// deterministic outbox). Illegal transitions are refused; events are idempotent.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import type { TenantContext } from "./tenant-context";

export type ContractWorkflowStatus =
  | "draft" | "under_review" | "changes_requested" | "approved" | "final" | "ready_for_signature"
  | "submitted" | "in_progress" | "signed" | "declined" | "expired" | "cancelled" | "failed"
  | "superseded" | "archived";

// MUST stay in sync with pierre_rt_contract_workflow_guard() in v14.
export const CONTRACT_TRANSITIONS: Record<ContractWorkflowStatus, ContractWorkflowStatus[]> = {
  draft: ["under_review", "cancelled"],
  under_review: ["changes_requested", "approved", "cancelled"],
  changes_requested: ["draft", "cancelled"],
  approved: ["final", "changes_requested", "cancelled"],
  final: ["ready_for_signature", "superseded", "cancelled"],
  ready_for_signature: ["submitted", "cancelled", "final"],
  submitted: ["in_progress", "declined", "expired", "cancelled", "failed"],
  in_progress: ["signed", "declined", "expired", "failed"],
  signed: ["superseded", "archived"],
  declined: ["draft", "archived"],
  expired: ["draft", "archived"],
  cancelled: ["draft", "archived"],
  failed: ["draft", "archived"],
  superseded: ["archived"],
  archived: [],
};

export class ContractTransitionError extends Error {
  readonly code = "illegal_transition";
  readonly status = 409;
  constructor(public from: string, public to: string) { super(`Illegal contract transition ${from} -> ${to}`); this.name = "ContractTransitionError"; }
}

export function canContractTransition(from: string, to: string): boolean {
  const allowed = CONTRACT_TRANSITIONS[from as ContractWorkflowStatus];
  return !!allowed && allowed.includes(to as ContractWorkflowStatus);
}
export function assertContractTransition(from: string, to: string): void {
  if (from === to) return;
  if (!canContractTransition(from, to)) throw new ContractTransitionError(from, to);
}

export type ContractEventKind =
  | "contract.created" | "contract.version_created" | "contract.readiness_checked"
  | "contract.generation_started" | "contract.generated" | "contract.review_requested"
  | "contract.changes_requested" | "contract.approved" | "contract.approval_invalidated"
  | "contract.finalized" | "contract.signature_prepared" | "contract.amendment_created"
  | "contract.superseded" | "contract.archived" | "contract.generation_blocked"
  | "contract.amendment_activated";

export type ContractEventData = {
  contract_id: string;
  version_id?: string | null;
  document_id?: string | null;
  status_before?: string | null;
  status_after?: string | null;
  fingerprint?: string | null;
  reason?: string | null;
  correlation_id?: string | null;
};

/**
 * Emit a contract event ATOMICALLY: append-only audit (SECURITY DEFINER, tenant-bound) +
 * real CloneTrace (document_access_log) + deterministic outbox (no random suffix). Call
 * inside the caller's transaction so it rolls back with the state change.
 */
export async function emitContractEvent(db: SqlExecutor, ctx: TenantContext, event: ContractEventKind, data: ContractEventData): Promise<void> {
  await db.query(
    `select pierre_rt_log_contract_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [ctx.company_id, data.contract_id, data.version_id ?? null, ctx.user_id, event, data.status_before ?? null, data.status_after ?? null, data.fingerprint ?? null, data.reason ?? null, data.correlation_id ?? ctx.correlation_id ?? null]);
  await db.query(
    `insert into pierre_rt_document_access_log (id, company_id, document_id, version_id, actor_user_id, action, detail) values ($1,$2,$3,$4,$5,$6,$7)`,
    [newUuid(), ctx.company_id, data.document_id ?? null, null, ctx.user_id, event, JSON.stringify({ contract_id: data.contract_id, contract_version_id: data.version_id ?? null, reason: data.reason ?? null })]);
  const dedup = [event, data.contract_id, data.version_id ?? "_", data.status_before ?? "_", data.status_after ?? "_", data.fingerprint ?? "_"].join(":");
  await db.query(
    `insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key) values ($1,$2,$3,$4,$5) on conflict (company_id, dedup_key) do nothing`,
    [newUuid(), ctx.company_id, event, JSON.stringify({ contract_id: data.contract_id, contract_version_id: data.version_id ?? null, document_id: data.document_id ?? null, status_before: data.status_before ?? null, status_after: data.status_after ?? null }), dedup]);
}
