// src/lib/pierre/v1/clonetrace-t2-bridge.ts
// P20.2 (D1 fix) — thin bridge from the CloneTrace T2 artifact (clonetrace-product-tech.ts) to
// the REAL, EXISTING, already-tracked V1 persistent event store (EventRepo / pierre_rt_events).
// No third trace system: this composes the one persistent authority that already exists, the
// same "pont mince" pattern already proven for src/lib/geo/document-jurisdiction.ts in P19.
//
// LIVES IN v1/, NOT IN product-technologies/t2/: T2 enforces a hard, tested doctrine of ZERO
// imports from the Pierre V1 runtime (t2-product-technologies.test.ts test #4, a closed-allowlist
// recursive scan). This bridge necessarily imports V1's EventRepo — so it belongs on the V1 side
// of the boundary, consumed BY callers as an opt-in step, never imported FROM inside t2/. The T2
// contract itself (clonetrace-product-tech.ts) is left completely unchanged.
//
// REAL SCHEMA DISCOVERY (this session, via live PGlite runs, not assumed from reading code):
//   - pierre_rt_events.mission_id is FOREIGN-KEY constrained to real pierre_rt_missions rows —
//     confirmed by the actual Postgres error 'violates foreign key constraint
//     "pierre_rt_events_mission_id_fkey"'. A CloneTrace T2 session id (from CloneCall/CloneRoom,
//     e.g. "call-1") is NOT a real V1 mission and cannot occupy that column.
//   - pierre_rt_events.correlation_id/request_id are plain `uuid`-typed columns with NO FK.
// Consequence (honest, not hidden): this bridge never attempts to populate mission_id/task_id
// unless the caller explicitly vouches for a real, already-persisted V1 mission id. It always
// generates (or accepts) a correlation_id as the reconstructable key, and preserves every
// original technology-specific id in metadata — never dropped, just not FK-risked.

import { randomUUID } from "crypto";
import { EventRepo, type EventRow } from "./repositories";
import type { SqlExecutor } from "./sql";
import type { CloneTraceEvent } from "@/lib/clonestore/product-technologies/t2/clonetrace-product-tech";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRealUuid = (v: string | null | undefined): v is string => !!v && UUID_RE.test(v);

export type CloneTracePersistResult =
  | { readonly ok: true; readonly rowWritten: true; readonly correlationId: string }
  | { readonly ok: false; readonly rowWritten: false; readonly error: string };

export interface CloneTracePersistenceContext {
  readonly companyId: string;
  /** Supply only if you have a REAL, already-persisted V1 mission id — else omit (safe default). */
  readonly realMissionId?: string | null;
  readonly correlationId?: string | null;
}

/**
 * Persist a CloneTrace T2 artifact into the real pierre_rt_events store. Company-scoped
 * (fail-closed if companyId is empty). Never throws — DB errors are captured and returned
 * as an honest { ok:false } result, never surfaced as a silent success. Always returns the
 * effective correlationId (generated if not supplied) so the caller can reconstruct later.
 */
export async function persistCloneTraceEvent(
  db: SqlExecutor,
  artifact: CloneTraceEvent,
  ctx: CloneTracePersistenceContext,
): Promise<CloneTracePersistResult> {
  const companyId = (ctx.companyId ?? "").trim();
  if (companyId.length === 0) {
    return { ok: false, rowWritten: false, error: "companyId requis pour la persistance — refus fail-closed (jamais un événement orphelin)." };
  }
  const correlationId = isRealUuid(ctx.correlationId) ? ctx.correlationId : randomUUID();
  const missionId = isRealUuid(ctx.realMissionId ?? null) ? (ctx.realMissionId as string) : null;

  try {
    await EventRepo.append(db, {
      company_id: companyId,
      mission_id: missionId,
      task_id: null,
      type: `clonetrace:${artifact.action}`,
      actor_type: "system",
      request_id: null,
      correlation_id: correlationId,
      prev_state: null,
      new_state: null,
      metadata: {
        clonetrace_event_id: artifact.eventId,
        subject: artifact.subject,
        reason: artifact.reason,
        original_mission_id: artifact.links.missionId,
        original_task_id: artifact.links.taskId,
        artifact_ids: artifact.links.artifactIds,
        validation_ids: artifact.links.validationIds,
        resume_pointer: artifact.resumePointer,
        t1_evidence_present: artifact.t1Evidence !== null,
      },
    });
    return { ok: true, rowWritten: true, correlationId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, rowWritten: false, error: `Écriture CloneTrace échouée : ${message}` };
  }
}

/** Reconstruct a real, persisted CloneTrace timeline for a company by correlation_id — real DB read. */
export async function reconstructCloneTraceTimelineByCorrelation(
  db: SqlExecutor,
  companyId: string,
  correlationId: string,
): Promise<readonly EventRow[]> {
  const { rows } = await db.query<EventRow>(
    `select * from pierre_rt_events where company_id = $1 and correlation_id = $2 and type like 'clonetrace:%' order by created_at asc, id asc`,
    [companyId, correlationId],
  );
  return rows;
}

/** Reconstruct via a REAL V1 mission_id (only meaningful when persistCloneTraceEvent was called with realMissionId). */
export async function reconstructCloneTraceTimelineByMission(
  db: SqlExecutor,
  companyId: string,
  missionId: string,
): Promise<readonly EventRow[]> {
  return EventRepo.timeline(db, companyId, missionId);
}
