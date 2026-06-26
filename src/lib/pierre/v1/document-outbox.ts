// src/lib/pierre/v1/document-outbox.ts
// PHASE 8.3 — outbox events only. P8.3 does NOT build the general email/notification
// channels (that is P8.4). It produces governed outbox rows that P8.4 will dispatch.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import type { TenantContext } from "./tenant-context";

export type DocumentEventKind =
  | "document.ready_for_review" | "document.approved" | "document.signature_ready"
  | "signature.submitted" | "signature.recipient_signed" | "signature.completed"
  | "signature.declined" | "signature.expired" | "contract.signed" | "document.requirement_missing";

/**
 * Append a P8.3 outbox event. `dedupKey` makes events idempotent where it matters
 * (e.g. signature.completed must be emitted once); otherwise a unique suffix is used.
 */
export async function emitDocumentEvent(
  db: SqlExecutor, ctx: TenantContext, kind: DocumentEventKind, documentId: string | null,
  payload: Record<string, unknown>, dedupKey?: string,
): Promise<void> {
  const dedup = dedupKey ?? `${kind}:${documentId ?? "_"}:${payload.version_id ?? payload.signature_request_id ?? "_"}:${newUuid().slice(0, 8)}`;
  await db.query(
    `insert into pierre_rt_outbox (id, company_id, kind, payload, dedup_key) values ($1,$2,$3,$4,$5)
     on conflict (company_id, dedup_key) do nothing`,
    [newUuid(), ctx.company_id, kind, JSON.stringify({ ...payload, document_id: documentId }), dedup]);
}
