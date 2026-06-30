// src/lib/pierre/v1/runtime-limits.ts
// PHASE 8.5-R4 §R4.7 — server resource governance. Every limit has a safe default + an ABSOLUTE server
// ceiling; the env value is parsed FAIL-CLOSED (NaN / negative / non-finite → default) and clamped to
// [1, absolute] so a client/operator can never raise a limit beyond the hard ceiling. A breach is a
// hard refusal (the caller rolls back; nothing is truncated or partially created).

function clampInt(raw: string | undefined, def: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;       // fail-closed: missing/NaN/negative → default
  return Math.min(Math.floor(n), max);                  // never exceed the absolute ceiling
}

export const RUNTIME_LIMITS = {
  maxSteps: clampInt(process.env.PIERRE_RUNTIME_MAX_STEPS, 200, 2000),
  maxDepth: clampInt(process.env.PIERRE_RUNTIME_MAX_DEPTH, 100, 1000),
  maxDepsPerStep: clampInt(process.env.PIERRE_RUNTIME_MAX_DEPS_PER_STEP, 25, 200),
  maxActiveMissionsPerTenant: clampInt(process.env.PIERRE_RUNTIME_MAX_ACTIVE_MISSIONS_PER_TENANT, 200, 5000),
  maxActiveJobsPerTenant: clampInt(process.env.PIERRE_RUNTIME_MAX_ACTIVE_JOBS_PER_TENANT, 2000, 50000),
  maxFollowUps: clampInt(process.env.PIERRE_RUNTIME_MAX_FOLLOW_UPS, 20, 200),
  maxMissionDurationDays: clampInt(process.env.PIERRE_RUNTIME_MAX_MISSION_DURATION_DAYS, 365, 3650),
  maxInputBytes: clampInt(process.env.PIERRE_RUNTIME_MAX_INPUT_BYTES, 64 * 1024, 1024 * 1024),
  maxOutputBytes: clampInt(process.env.PIERRE_RUNTIME_MAX_OUTPUT_BYTES, 64 * 1024, 1024 * 1024),
  maxCheckpointBytes: clampInt(process.env.PIERRE_RUNTIME_MAX_CHECKPOINT_BYTES, 32 * 1024, 512 * 1024),
  maxEventPayloadBytes: clampInt(process.env.PIERRE_RUNTIME_MAX_EVENT_PAYLOAD_BYTES, 32 * 1024, 512 * 1024),
  maxSchedulesPerMission: clampInt(process.env.PIERRE_RUNTIME_MAX_SCHEDULES_PER_MISSION, 50, 1000),
};

export type RuntimeLimits = typeof RUNTIME_LIMITS;

/** Read the live limits (re-read env each call so tests can stub a limit). */
export function runtimeLimits(): RuntimeLimits {
  return {
    maxSteps: clampInt(process.env.PIERRE_RUNTIME_MAX_STEPS, 200, 2000),
    maxDepth: clampInt(process.env.PIERRE_RUNTIME_MAX_DEPTH, 100, 1000),
    maxDepsPerStep: clampInt(process.env.PIERRE_RUNTIME_MAX_DEPS_PER_STEP, 25, 200),
    maxActiveMissionsPerTenant: clampInt(process.env.PIERRE_RUNTIME_MAX_ACTIVE_MISSIONS_PER_TENANT, 200, 5000),
    maxActiveJobsPerTenant: clampInt(process.env.PIERRE_RUNTIME_MAX_ACTIVE_JOBS_PER_TENANT, 2000, 50000),
    maxFollowUps: clampInt(process.env.PIERRE_RUNTIME_MAX_FOLLOW_UPS, 20, 200),
    maxMissionDurationDays: clampInt(process.env.PIERRE_RUNTIME_MAX_MISSION_DURATION_DAYS, 365, 3650),
    maxInputBytes: clampInt(process.env.PIERRE_RUNTIME_MAX_INPUT_BYTES, 64 * 1024, 1024 * 1024),
    maxOutputBytes: clampInt(process.env.PIERRE_RUNTIME_MAX_OUTPUT_BYTES, 64 * 1024, 1024 * 1024),
    maxCheckpointBytes: clampInt(process.env.PIERRE_RUNTIME_MAX_CHECKPOINT_BYTES, 32 * 1024, 512 * 1024),
    maxEventPayloadBytes: clampInt(process.env.PIERRE_RUNTIME_MAX_EVENT_PAYLOAD_BYTES, 32 * 1024, 512 * 1024),
    maxSchedulesPerMission: clampInt(process.env.PIERRE_RUNTIME_MAX_SCHEDULES_PER_MISSION, 50, 1000),
  };
}

/** The longest dependency chain (DAG depth) of a compiled step list. */
export function planDepth(steps: Array<{ step_key: string; depends_on: string[] }>): number {
  const byKey = new Map(steps.map((s) => [s.step_key, s] as const));
  const memo = new Map<string, number>();
  const depth = (k: string, seen: Set<string>): number => {
    if (memo.has(k)) return memo.get(k)!;
    if (seen.has(k)) return 0; // a cycle is caught elsewhere; avoid infinite recursion here
    seen.add(k);
    const deps = byKey.get(k)?.depends_on ?? [];
    const d = deps.length === 0 ? 1 : 1 + Math.max(...deps.map((x) => depth(x, seen)));
    seen.delete(k);
    memo.set(k, d);
    return d;
  };
  return steps.length === 0 ? 0 : Math.max(...steps.map((s) => depth(s.step_key, new Set())));
}
