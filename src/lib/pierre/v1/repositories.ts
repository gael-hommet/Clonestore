// src/lib/pierre/v1/repositories.ts
// PHASE 8.1 — Pierre Production Runtime Core — repositories (Postgres).
//
// Typed persistence over SqlExecutor. Cursor-based pagination, no unbounded
// reads, version-checked updates (optimistic concurrency), no silent partial
// mutation. Every status change is mediated by mission-service, not raw UPDATE.

import type { SqlExecutor } from "./sql";
import { newUuid } from "./sql";
import { Errors } from "./errors";
import type { MissionStatus, TaskStatus, ActorType } from "./state-machine";

/** Normalize a timestamptz value (Date from PGlite / string from pg) to ISO. */
function isoOf(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return new Date(v as string).toISOString();
}

export type MissionRow = {
  id: string; company_id: string; requester_user_id: string;
  employee_id: string | null; site_id: string | null; parent_mission_id: string | null;
  source: string; instruction: string; status: MissionStatus; risk: string; sensitivity: string;
  autonomy_mode: string; approval_policy: string; summary: string | null; next_action: string | null;
  correlation_id: string; request_id: string; idempotency_key: string; version: number;
  created_at: string; updated_at: string; archived_at: string | null;
};

export type TaskRow = {
  id: string; company_id: string; mission_id: string; type: string; objective: string;
  status: TaskStatus; priority: number; domain: string; risk: string; sensitivity: string;
  channel: string; approval_required: boolean; expected_output: string | null; owner: string;
  attempts: number; max_attempts: number; timeout_ms: number; scheduled_at: string | null;
  due_at: string | null; idempotency_key: string; version: number; result: unknown;
  created_at: string; updated_at: string;
};

export type ValidationRow = {
  id: string; company_id: string; mission_id: string; task_id: string | null;
  validator_role: string; required_count: number; status: string; reason: string;
  risk_context: unknown; decided_by: string | null; decided_at: string | null;
  expires_at: string | null; version: number; created_at: string; updated_at: string;
};

export type EventRow = {
  id: string; company_id: string; mission_id: string | null; task_id: string | null;
  type: string; actor_type: string; actor_id: string | null; request_id: string | null;
  correlation_id: string | null; prev_state: string | null; new_state: string | null;
  metadata: unknown; created_at: string;
};

// ── Missions ────────────────────────────────────────────────────────────────
export const MissionRepo = {
  async insert(db: SqlExecutor, m: Omit<MissionRow, "version" | "created_at" | "updated_at" | "archived_at" | "summary" | "next_action"> & { summary: string | null; next_action: string | null }): Promise<MissionRow> {
    const { rows } = await db.query<MissionRow>(
      `insert into pierre_rt_missions
        (id, company_id, requester_user_id, employee_id, site_id, parent_mission_id, source, instruction,
         status, risk, sensitivity, autonomy_mode, approval_policy, summary, next_action,
         correlation_id, request_id, idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning *`,
      [m.id, m.company_id, m.requester_user_id, m.employee_id, m.site_id, m.parent_mission_id, m.source,
       m.instruction, m.status, m.risk, m.sensitivity, m.autonomy_mode, m.approval_policy, m.summary,
       m.next_action, m.correlation_id, m.request_id, m.idempotency_key]
    );
    return rows[0];
  },
  async byId(db: SqlExecutor, companyId: string, id: string): Promise<MissionRow | null> {
    const { rows } = await db.query<MissionRow>(
      `select * from pierre_rt_missions where company_id = $1 and id = $2`, [companyId, id]);
    return rows[0] ?? null;
  },
  async byIdempotency(db: SqlExecutor, companyId: string, key: string): Promise<MissionRow | null> {
    const { rows } = await db.query<MissionRow>(
      `select * from pierre_rt_missions where company_id = $1 and idempotency_key = $2`, [companyId, key]);
    return rows[0] ?? null;
  },
  /** Cursor pagination: created_at desc, id desc. cursor = "createdAt|id". */
  async list(db: SqlExecutor, companyId: string, opts: { limit: number; cursor?: string | null; status?: string | null }): Promise<{ items: MissionRow[]; next_cursor: string | null }> {
    const limit = Math.max(1, Math.min(100, opts.limit));
    const params: unknown[] = [companyId];
    let where = `company_id = $1`;
    if (opts.status) { params.push(opts.status); where += ` and status = $${params.length}`; }
    if (opts.cursor) {
      const [c, cid] = opts.cursor.split("|");
      params.push(c); params.push(cid);
      where += ` and (created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
    }
    params.push(limit + 1);
    const { rows } = await db.query<MissionRow>(
      `select * from pierre_rt_missions where ${where} order by created_at desc, id desc limit $${params.length}`, params);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const next = rows.length > limit ? `${isoOf(last.created_at)}|${last.id}` : null;
    return { items, next_cursor: next };
  },
  /** Version-checked status update. Throws version_conflict if version moved. */
  async updateStatus(db: SqlExecutor, companyId: string, id: string, fromVersion: number, to: MissionStatus, patch: Partial<Pick<MissionRow, "summary" | "next_action" | "archived_at">> = {}): Promise<MissionRow> {
    const { rows } = await db.query<MissionRow>(
      `update pierre_rt_missions
         set status = $4, version = version + 1, updated_at = now(),
             summary = coalesce($5, summary), next_action = coalesce($6, next_action),
             archived_at = coalesce($7, archived_at)
       where company_id = $1 and id = $2 and version = $3
       returning *`,
      [companyId, id, fromVersion, to, patch.summary ?? null, patch.next_action ?? null, patch.archived_at ?? null]);
    if (rows.length === 0) throw Errors.versionConflict();
    return rows[0];
  },
};

// ── Tasks ───────────────────────────────────────────────────────────────────
export const TaskRepo = {
  async insert(db: SqlExecutor, t: Omit<TaskRow, "version" | "created_at" | "updated_at" | "attempts" | "result">): Promise<TaskRow> {
    const { rows } = await db.query<TaskRow>(
      `insert into pierre_rt_tasks
        (id, company_id, mission_id, type, objective, status, priority, domain, risk, sensitivity, channel,
         approval_required, expected_output, owner, max_attempts, timeout_ms, scheduled_at, due_at, idempotency_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       returning *`,
      [t.id, t.company_id, t.mission_id, t.type, t.objective, t.status, t.priority, t.domain, t.risk,
       t.sensitivity, t.channel, t.approval_required, t.expected_output, t.owner, t.max_attempts,
       t.timeout_ms, t.scheduled_at, t.due_at, t.idempotency_key]);
    return rows[0];
  },
  async byId(db: SqlExecutor, companyId: string, id: string): Promise<TaskRow | null> {
    const { rows } = await db.query<TaskRow>(`select * from pierre_rt_tasks where company_id=$1 and id=$2`, [companyId, id]);
    return rows[0] ?? null;
  },
  async listByMission(db: SqlExecutor, companyId: string, missionId: string): Promise<TaskRow[]> {
    const { rows } = await db.query<TaskRow>(
      `select * from pierre_rt_tasks where company_id=$1 and mission_id=$2 order by priority desc, created_at asc`, [companyId, missionId]);
    return rows;
  },
  async addDependency(db: SqlExecutor, companyId: string, taskId: string, dependsOn: string): Promise<void> {
    await db.query(`insert into pierre_rt_task_deps (company_id, task_id, depends_on_task_id)
                    values ($1,$2,$3) on conflict do nothing`, [companyId, taskId, dependsOn]);
  },
  async unmetDependencies(db: SqlExecutor, companyId: string, taskId: string): Promise<number> {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int n from pierre_rt_task_deps d
        join pierre_rt_tasks t on t.id = d.depends_on_task_id
       where d.company_id=$1 and d.task_id=$2 and t.status <> 'succeeded'`, [companyId, taskId]);
    return rows[0].n;
  },
  async updateStatus(db: SqlExecutor, companyId: string, id: string, fromVersion: number, to: TaskStatus, patch: Partial<Pick<TaskRow, "result" | "scheduled_at">> = {}, bumpAttempt = false): Promise<TaskRow> {
    const { rows } = await db.query<TaskRow>(
      `update pierre_rt_tasks
         set status=$4, version=version+1, updated_at=now(),
             attempts = attempts + case when $7 then 1 else 0 end,
             result = coalesce($5, result),
             scheduled_at = coalesce($6, scheduled_at)
       where company_id=$1 and id=$2 and version=$3
       returning *`,
      [companyId, id, fromVersion, to, patch.result ? JSON.stringify(patch.result) : null, patch.scheduled_at ?? null, bumpAttempt]);
    if (rows.length === 0) throw Errors.versionConflict();
    return rows[0];
  },
  async readyDependentsOf(db: SqlExecutor, companyId: string, taskId: string): Promise<TaskRow[]> {
    const { rows } = await db.query<TaskRow>(
      `select t.* from pierre_rt_tasks t
        join pierre_rt_task_deps d on d.task_id = t.id
       where d.company_id=$1 and d.depends_on_task_id=$2`, [companyId, taskId]);
    return rows;
  },
};

// ── Validations ─────────────────────────────────────────────────────────────
export const ValidationRepo = {
  async insert(db: SqlExecutor, v: { company_id: string; mission_id: string; task_id: string | null; validator_role: string; reason: string; risk_context: unknown; expires_at: string | null }): Promise<ValidationRow> {
    const { rows } = await db.query<ValidationRow>(
      `insert into pierre_rt_validations (id, company_id, mission_id, task_id, validator_role, reason, risk_context, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [newUuid(), v.company_id, v.mission_id, v.task_id, v.validator_role, v.reason, JSON.stringify(v.risk_context ?? {}), v.expires_at]);
    return rows[0];
  },
  async byId(db: SqlExecutor, companyId: string, id: string): Promise<ValidationRow | null> {
    const { rows } = await db.query<ValidationRow>(`select * from pierre_rt_validations where company_id=$1 and id=$2`, [companyId, id]);
    return rows[0] ?? null;
  },
  async listByMission(db: SqlExecutor, companyId: string, missionId: string): Promise<ValidationRow[]> {
    const { rows } = await db.query<ValidationRow>(`select * from pierre_rt_validations where company_id=$1 and mission_id=$2 order by created_at asc`, [companyId, missionId]);
    return rows;
  },
  async decide(db: SqlExecutor, companyId: string, id: string, fromVersion: number, status: "approved" | "rejected" | "changes_requested" | "escalated", decidedBy: string): Promise<ValidationRow> {
    const { rows } = await db.query<ValidationRow>(
      `update pierre_rt_validations set status=$4, decided_by=$5, decided_at=now(), version=version+1, updated_at=now()
       where company_id=$1 and id=$2 and version=$3 and status='pending' returning *`,
      [companyId, id, fromVersion, status, decidedBy]);
    if (rows.length === 0) throw Errors.versionConflict("Validation already decided or version conflict");
    return rows[0];
  },
};

// ── CloneTrace events ───────────────────────────────────────────────────────
export const EventRepo = {
  async append(db: SqlExecutor, e: { company_id: string; mission_id: string | null; task_id: string | null; type: string; actor_type: ActorType; actor_id?: string | null; request_id?: string | null; correlation_id?: string | null; prev_state?: string | null; new_state?: string | null; metadata?: Record<string, unknown> }): Promise<void> {
    await db.query(
      `insert into pierre_rt_events (id, company_id, mission_id, task_id, type, actor_type, actor_id, request_id, correlation_id, prev_state, new_state, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [newUuid(), e.company_id, e.mission_id, e.task_id, e.type, e.actor_type, e.actor_id ?? null, e.request_id ?? null, e.correlation_id ?? null, e.prev_state ?? null, e.new_state ?? null, JSON.stringify(e.metadata ?? {})]);
  },
  async timeline(db: SqlExecutor, companyId: string, missionId: string): Promise<EventRow[]> {
    const { rows } = await db.query<EventRow>(`select * from pierre_rt_events where company_id=$1 and mission_id=$2 order by created_at asc, id asc`, [companyId, missionId]);
    return rows;
  },
};

// ── Idempotency ─────────────────────────────────────────────────────────────
export const IdempotencyRepo = {
  /** Returns stored result if the (scope,key) was already processed for this tenant. */
  async get(db: SqlExecutor, companyId: string, scope: string, key: string): Promise<unknown | null> {
    const { rows } = await db.query<{ result: unknown }>(
      `select result from pierre_rt_idempotency where company_id=$1 and scope=$2 and key=$3`, [companyId, scope, key]);
    return rows[0]?.result ?? null;
  },
  /** Store a result; on conflict keep the first (idempotent). Returns the
   *  effective stored result (first writer wins). */
  async put(db: SqlExecutor, companyId: string, scope: string, key: string, result: unknown): Promise<void> {
    await db.query(
      `insert into pierre_rt_idempotency (id, company_id, scope, key, result)
       values ($1,$2,$3,$4,$5) on conflict (company_id, scope, key) do nothing`,
      [newUuid(), companyId, scope, key, JSON.stringify(result)]);
  },
};

// ── Outbox ──────────────────────────────────────────────────────────────────
export const OutboxRepo = {
  async enqueue(db: SqlExecutor, o: { company_id: string; mission_id: string | null; task_id: string | null; kind: string; payload: Record<string, unknown>; dedup_key: string }): Promise<void> {
    await db.query(
      `insert into pierre_rt_outbox (id, company_id, mission_id, task_id, kind, payload, dedup_key)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (company_id, dedup_key) do nothing`,
      [newUuid(), o.company_id, o.mission_id, o.task_id, o.kind, JSON.stringify(o.payload), o.dedup_key]);
  },
  async pending(db: SqlExecutor, limit: number): Promise<Array<{ id: string; company_id: string; kind: string; payload: unknown }>> {
    const { rows } = await db.query<{ id: string; company_id: string; kind: string; payload: unknown }>(
      `select id, company_id, kind, payload from pierre_rt_outbox where status='pending' order by created_at asc limit $1`, [Math.min(100, limit)]);
    return rows;
  },
  async mark(db: SqlExecutor, id: string, status: "dispatched" | "awaiting_integration" | "failed"): Promise<void> {
    await db.query(`update pierre_rt_outbox set status=$2, attempts=attempts+1, dispatched_at=case when $2='dispatched' then now() else dispatched_at end where id=$1`, [id, status]);
  },
};
