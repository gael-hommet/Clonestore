// src/lib/pierre/v1/cognitive-runtime/operational-memory.ts
// PHASE 8.14 — operational memory (owner §15). Persists the WORK (request, resolved entities, confirmed
// facts, rejected assumptions, plan versions, next expected event) — NEVER hidden chain-of-thought, raw
// prompts, or secrets. Defines the tenant-safe store CONTRACT + an in-memory implementation (used by
// tests and degraded mode). A durable Postgres implementation satisfies the same interface using the
// existing pierre_rt_* connection (a dedicated cognitive-state table); it is additive, never a 2nd runtime.

import type { PierreCognitiveTerminalState } from "./types";

export type CognitiveOperationRecord = {
  readonly operationId: string;
  readonly companyId: string;              // tenant scope — enforced on every read/write
  readonly actorId: string;
  readonly missionId: string | null;       // link to the real persisted mission (stack B/C)
  readonly originalRequest: string;
  readonly normalizedObjective: string;
  readonly resolvedEntities: Record<string, string>;  // label → resolved id (no raw PII beyond ids/labels)
  readonly confirmedFacts: readonly string[];
  readonly rejectedAssumptions: readonly string[];
  readonly planVersion: number;
  readonly terminalState: PierreCognitiveTerminalState;
  readonly nextExpectedEvent: string | null;
  readonly updatedAtIso: string;
  // richer durable fields (optional so the in-memory store + existing tests stay simple)
  readonly missionRunId?: string | null;
  readonly activePlanFingerprint?: string | null;
  readonly ambiguities?: readonly string[];
  readonly clarifications?: ReadonlyArray<{ question: string; answer?: string }>;
  readonly planVersions?: ReadonlyArray<{ version: number; fingerprint: string | null }>;
  readonly approvals?: readonly string[];
  readonly humanDecisions?: readonly string[];
  readonly blockers?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly retryState?: Record<string, unknown>;
};

// Guard: reject anything that smells like hidden reasoning / secrets being smuggled into memory.
const FORBIDDEN_KEYS = ["chain_of_thought", "reasoning", "raw_prompt", "system_prompt", "api_key", "secret", "token"];
export function assertNoHiddenReasoning(record: Partial<CognitiveOperationRecord>): void {
  for (const k of Object.keys(record)) {
    if (FORBIDDEN_KEYS.some((f) => k.toLowerCase().includes(f))) {
      throw new Error(`operational-memory: forbidden field "${k}" (no chain-of-thought / secrets)`);
    }
  }
}

export interface CognitiveMemoryStore {
  save(record: CognitiveOperationRecord): Promise<void>;
  // tenant-scoped read: companyId MUST match or null is returned (no cross-tenant leak)
  get(companyId: string, operationId: string): Promise<CognitiveOperationRecord | null>;
  listByMission(companyId: string, missionId: string): Promise<CognitiveOperationRecord[]>;
}

// ── Durable Postgres store (D2) ─────────────────────────────────────────────
// Persists to pierre_rt_cognitive_operations (migration pierre_v27) on the existing runtime DB. Tenant
// isolation is enforced two ways: RLS (app.current_company) AND an explicit company_id filter on every
// query (defense-in-depth). Optimistic version bumps on every save. Never stores chain-of-thought/secrets.
type MinimalDb = { query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<{ rows: T[] }> };

const j = (v: unknown) => JSON.stringify(v ?? null);
function rowToRecord(r: Record<string, unknown>): CognitiveOperationRecord {
  const asArr = (v: unknown): string[] => (Array.isArray(v) ? v as string[] : []);
  return {
    operationId: String(r.operation_id), companyId: String(r.company_id), actorId: String(r.actor_id),
    missionId: r.mission_id ? String(r.mission_id) : null,
    originalRequest: String(r.original_request ?? ""), normalizedObjective: String(r.normalized_objective ?? ""),
    resolvedEntities: (r.resolved_entities as Record<string, string>) ?? {},
    confirmedFacts: asArr(r.confirmed_facts), rejectedAssumptions: asArr(r.rejected_assumptions),
    planVersion: Number((r.plan_versions as unknown[])?.length ?? 1) || 1,
    terminalState: String(r.terminal_state ?? "AWAITING_INFORMATION") as PierreCognitiveTerminalState,
    nextExpectedEvent: r.next_expected_event ? String(r.next_expected_event) : null,
    updatedAtIso: r.updated_at ? new Date(String(r.updated_at)).toISOString() : new Date(0).toISOString(),
    missionRunId: r.mission_run_id ? String(r.mission_run_id) : null,
    activePlanFingerprint: r.active_plan_fingerprint ? String(r.active_plan_fingerprint) : null,
    ambiguities: asArr(r.ambiguities), approvals: asArr(r.approvals), humanDecisions: asArr(r.human_decisions),
    blockers: asArr(r.blockers), evidenceRefs: asArr(r.evidence_refs),
    clarifications: (r.clarifications as ReadonlyArray<{ question: string; answer?: string }>) ?? [],
    planVersions: (r.plan_versions as ReadonlyArray<{ version: number; fingerprint: string | null }>) ?? [],
    retryState: (r.retry_state as Record<string, unknown>) ?? {},
  };
}

export function createPgMemoryStore(db: MinimalDb): CognitiveMemoryStore {
  return {
    async save(record) {
      assertNoHiddenReasoning(record);
      await db.query(
        `insert into pierre_rt_cognitive_operations
           (operation_id, company_id, actor_id, original_request, normalized_objective, interpretation,
            resolved_entities, confirmed_facts, rejected_assumptions, ambiguities, clarifications,
            plan_versions, active_plan_fingerprint, mission_id, mission_run_id, completed_steps,
            pending_steps, approvals, human_decisions, blockers, evidence_refs, next_expected_event,
            retry_state, terminal_state, version, updated_at)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,
                 $13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,$21::jsonb,$22,$23::jsonb,$24,1,now())
         on conflict (operation_id) do update set
           normalized_objective = excluded.normalized_objective,
           interpretation = excluded.interpretation, resolved_entities = excluded.resolved_entities,
           confirmed_facts = excluded.confirmed_facts, rejected_assumptions = excluded.rejected_assumptions,
           ambiguities = excluded.ambiguities, clarifications = excluded.clarifications,
           plan_versions = excluded.plan_versions, active_plan_fingerprint = excluded.active_plan_fingerprint,
           mission_id = excluded.mission_id, mission_run_id = excluded.mission_run_id,
           completed_steps = excluded.completed_steps, pending_steps = excluded.pending_steps,
           approvals = excluded.approvals, human_decisions = excluded.human_decisions,
           blockers = excluded.blockers, evidence_refs = excluded.evidence_refs,
           next_expected_event = excluded.next_expected_event, retry_state = excluded.retry_state,
           terminal_state = excluded.terminal_state,
           version = pierre_rt_cognitive_operations.version + 1, updated_at = now()
         where pierre_rt_cognitive_operations.company_id = excluded.company_id`,   // tenant guard on update
        [record.operationId, record.companyId, record.actorId, record.originalRequest, record.normalizedObjective,
         j({}), j(record.resolvedEntities), j(record.confirmedFacts), j(record.rejectedAssumptions), j(record.ambiguities ?? []),
         j(record.clarifications ?? []), j(record.planVersions ?? [{ version: record.planVersion, fingerprint: record.activePlanFingerprint ?? null }]),
         record.activePlanFingerprint ?? null, record.missionId, record.missionRunId ?? null, j([]),
         j([]), j(record.approvals ?? []), j(record.humanDecisions ?? []), j(record.blockers ?? []), j(record.evidenceRefs ?? []),
         record.nextExpectedEvent, j(record.retryState ?? {}), record.terminalState],
      );
    },
    async get(companyId, operationId) {
      const r = await db.query(`select * from pierre_rt_cognitive_operations where operation_id = $1 and company_id = $2`, [operationId, companyId]);
      return r.rows[0] ? rowToRecord(r.rows[0]) : null;   // company_id filter → no cross-tenant existence leak
    },
    async listByMission(companyId, missionId) {
      const r = await db.query(`select * from pierre_rt_cognitive_operations where company_id = $1 and mission_id = $2 order by updated_at desc`, [companyId, missionId]);
      return r.rows.map(rowToRecord);
    },
  };
}

/**
 * Resolve the memory store. In production a durable DB is REQUIRED (fail-closed, owner §3): a null db in
 * production throws rather than silently using volatile memory. Tests/degraded mode may use in-memory.
 */
export function resolveMemoryStore(db: MinimalDb | null, opts?: { productionMode?: boolean; allowInMemory?: boolean }): CognitiveMemoryStore {
  if (db) return createPgMemoryStore(db);
  if (opts?.productionMode && !opts?.allowInMemory) {
    throw new Error("operational-memory: production requires a durable DB-backed store (no in-memory fallback)");
  }
  return createInMemoryMemoryStore();
}

/** In-memory store — durable within a process; used by tests and degraded mode. Tenant-safe by key. */
export function createInMemoryMemoryStore(): CognitiveMemoryStore {
  const byKey = new Map<string, CognitiveOperationRecord>();
  const key = (c: string, o: string) => `${c}::${o}`;
  return {
    async save(record) {
      assertNoHiddenReasoning(record);
      byKey.set(key(record.companyId, record.operationId), record);
    },
    async get(companyId, operationId) {
      const r = byKey.get(key(companyId, operationId)) ?? null;
      return r && r.companyId === companyId ? r : null; // defense-in-depth tenant check
    },
    async listByMission(companyId, missionId) {
      return [...byKey.values()].filter((r) => r.companyId === companyId && r.missionId === missionId);
    },
  };
}
