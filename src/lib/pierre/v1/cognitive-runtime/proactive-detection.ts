// src/lib/pierre/v1/cognitive-runtime/proactive-detection.ts
// PHASE 8.14 (D5) — wires the proactive controller to a REAL scheduler tick over tenant-scoped company
// state. A detector runs a tenant-scoped SQL query and returns HrSignals; the tick dedups them against
// the durable pierre_rt_proactive_signals table (unique on (company_id, dedup_key) → a duplicate tick is a
// no-op), prioritizes via the existing controller, persists fresh signals, and — for a fresh signal whose
// decision is a mission AND a governed pack exists — OPENS A REAL GOVERNED MISSION via the existing
// createMission path (and links it to the signal). Signals with no governed pack stay observe/alert
// (fail-closed, no mission). Detectors are tenant-scoped by construction.

import { runProactiveBatch, type ProactiveOutcome } from "./proactive-controller";
import { createMission } from "../mission-service";
import type { SqlExecutor } from "../sql";
import type { TenantContext } from "../tenant-context";
import type { HrSignal } from "../hr-proactive/signal-types";

type Db = SqlExecutor;
type Ctx = TenantContext;

export type Detector = (db: Db, ctx: Ctx, nowIso: string) => Promise<HrSignal[]>;

/** Real detector: pending validations older than the SLA window → overdue-approval signals. */
export const overdueApprovalsDetector: Detector = async (db, ctx, nowIso) => {
  const cutoff = new Date(new Date(nowIso).getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const rows = await db.query<{ id: string }>(
    `select id from pierre_rt_validations where company_id = $1 and status = 'pending' and created_at < $2`,
    [ctx.company_id, cutoff],
  );
  return rows.rows.map((r) => ({ key: "approval.overdue", companyId: ctx.company_id, subjectRef: String(r.id), detectedAt: nowIso, severity: "warning", dedupKey: `approval.overdue:${r.id}` }));
};

export type ProactiveTickResult = { detected: number; fresh: number; suppressed: number; persisted: number; missionsOpened: number; outcomes: ProactiveOutcome[] };

/**
 * One scheduler tick for one tenant: detect → dedup (durable) → prioritize → persist fresh signals →
 * OPEN a real governed mission for each fresh mission-decision signal that has a governed pack. The
 * mission is created through the same governed createMission path (guard/validation/queue) and linked to
 * the signal; signals without a pack remain observe/alert (fail-closed). `deps.createMission` is injectable
 * for testing; production uses the real service.
 */
export async function runProactiveDetectionTick(
  db: Db, ctx: Ctx, nowIso: string,
  detectors: readonly Detector[] = [overdueApprovalsDetector],
  deps?: { createMission?: typeof createMission },
): Promise<ProactiveTickResult> {
  const create = deps?.createMission ?? createMission;
  const detected = (await Promise.all(detectors.map((d) => d(db, ctx, nowIso)))).flat();
  const existing = (await db.query<{ dedup_key: string }>(
    `select dedup_key from pierre_rt_proactive_signals where company_id = $1 and status = 'open'`, [ctx.company_id],
  )).rows.map((r) => r.dedup_key);

  const { outcomes, suppressed } = runProactiveBatch(detected, existing);

  let persisted = 0;
  let missionsOpened = 0;
  for (const o of outcomes) {
    const res = await db.query<{ id: string }>(
      `insert into pierre_rt_proactive_signals (id, company_id, signal_key, subject_ref, dedup_key, severity, status)
         values (gen_random_uuid(), $1, $2, $3, $4, $5, 'open')
       on conflict (company_id, dedup_key) do nothing
       returning id`,
      [ctx.company_id, o.signal.key, o.signal.subjectRef, o.signal.dedupKey, o.signal.severity],
    );
    if (res.rows.length === 0) continue; // already existed → no duplicate work
    persisted++;

    // Governed autonomy: a fresh mission-decision signal WITH a governed pack opens a real mission.
    if (o.decision === "mission" && o.missionRequest) {
      const mission = await create(db, ctx, {
        instruction: o.missionRequest.reason, source: "proactive",
        idempotency_key: `proactive:${o.signal.dedupKey}`, // idempotent: one mission per live signal
      });
      await db.query(`update pierre_rt_proactive_signals set mission_id = $1, status = 'handled', updated_at = now() where id = $2 and company_id = $3`,
        [mission.mission_id, res.rows[0].id, ctx.company_id]);
      missionsOpened++;
    }
  }
  return { detected: detected.length, fresh: outcomes.length, suppressed, persisted, missionsOpened, outcomes };
}
