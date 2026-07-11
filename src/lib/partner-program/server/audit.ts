// Programme partenaires — journal admin APPEND-ONLY. Toute intervention sensible exige
// acteur + action + raison + avant/après + requestId. tx en mode service.

import type { SqlExecutor } from "@/lib/pierre/v1/sql";

export async function recordAudit(
  tx: SqlExecutor,
  entry: {
    actor: string;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    reason: string;
    prev?: unknown;
    next?: unknown;
    requestId?: string | null;
  },
): Promise<void> {
  await tx.query(
    `insert into clonestore_pp_admin_audit
       (actor, action, entity_type, entity_id, reason, prev_state, new_state, request_id)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
    [
      entry.actor,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.reason,
      entry.prev === undefined ? null : JSON.stringify(entry.prev),
      entry.next === undefined ? null : JSON.stringify(entry.next),
      entry.requestId ?? null,
    ],
  );
}
