// src/lib/pierre/v1/client.ts
// PHASE 8.1 — canonical typed client for /api/pierre/v1/*.
//
// Single client the cockpit uses. Strict response schemas (zod), timeout +
// AbortSignal, request id, active-company header, typed errors. Retries ONLY on
// safe idempotent reads (GET) and on createMission (which carries an idempotency
// key); never auto-repeats an unsafe mutation. No silent swallow, no avoidable any.

import { z } from "zod";

export class PierreClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: unknown;
  constructor(message: string, code: string, status: number, requestId?: string, details?: unknown) {
    super(message);
    this.name = "PierreClientError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}

// ── Response schemas ────────────────────────────────────────────────────────
const MissionView = z.object({
  mission_id: z.string(),
  status: z.string(),
  summary: z.string().nullable(),
  risk: z.string(),
  tasks: z.array(z.object({ id: z.string(), type: z.string(), status: z.string(), approval_required: z.boolean(), risk: z.string() })),
  approvals: z.array(z.object({ id: z.string(), status: z.string(), reason: z.string() })),
  queued_actions: z.number(),
  next_action: z.string().nullable(),
  trace_reference: z.string(),
  idempotent_replay: z.boolean(),
});
export type MissionView = z.infer<typeof MissionView>;

const MissionListItem = z.object({ id: z.string(), status: z.string(), risk: z.string(), summary: z.string().nullable(), created_at: z.union([z.string(), z.date()]) });
const MissionList = z.object({ items: z.array(MissionListItem), next_cursor: z.string().nullable() });
export type MissionList = z.infer<typeof MissionList>;

const TaskView = z.object({ id: z.string(), type: z.string(), objective: z.string(), status: z.string(), risk: z.string(), sensitivity: z.string(), approval_required: z.boolean(), attempts: z.number(), max_attempts: z.number(), result: z.unknown() });
const TaskList = z.array(TaskView);

const TimelineEvent = z.object({ type: z.string(), actor_type: z.string(), prev_state: z.string().nullable(), new_state: z.string().nullable(), task_id: z.string().nullable(), created_at: z.union([z.string(), z.date()]), metadata: z.unknown() });
const Timeline = z.array(TimelineEvent);

const ValidationView = z.object({ id: z.string(), status: z.string(), reason: z.string(), validator_role: z.string(), task_id: z.string().nullable(), version: z.number(), risk_context: z.unknown() });
const ValidationList = z.array(ValidationView);

const DecideResult = z.object({ validation_id: z.string(), status: z.string(), unlocked_task: z.string().nullable() });
const CancelResult = z.object({ mission_id: z.string(), status: z.string() });
const Health = z.object({ status: z.string(), db: z.string().optional(), queue: z.unknown().optional() });

// ── Config ──────────────────────────────────────────────────────────────────
export type PierreClientConfig = {
  companyId: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
};

type RequestOpts = { body?: unknown; signal?: AbortSignal; retrySafe?: boolean };

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
}

export function createPierreClient(cfg: PierreClientConfig) {
  const baseUrl = cfg.baseUrl ?? "";
  const doFetch = cfg.fetchImpl ?? fetch;
  const timeoutMs = cfg.timeoutMs ?? 12000;

  async function request<T>(method: string, path: string, schema: z.ZodType<T>, opts: RequestOpts = {}): Promise<{ data: T; requestId?: string }> {
    const maxTries = opts.retrySafe ? 3 : 1;
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxTries; attempt++) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      const onAbort = () => ac.abort();
      if (opts.signal) opts.signal.addEventListener("abort", onAbort, { once: true });
      try {
        const res = await doFetch(`${baseUrl}${path}`, {
          method,
          headers: {
            "content-type": "application/json",
            "x-pierre-company": cfg.companyId,
            "x-request-id": newId(),
            ...(cfg.defaultHeaders ?? {}),
          },
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: ac.signal,
        });
        const requestId = res.headers.get("x-request-id") ?? undefined;
        const text = await res.text();
        const json: unknown = text ? JSON.parse(text) : {};
        if (!res.ok) {
          const errObj = (json as { error?: { code?: string; message?: string; details?: unknown } }).error ?? {};
          throw new PierreClientError(errObj.message ?? `HTTP ${res.status}`, errObj.code ?? "internal", res.status, requestId, errObj.details);
        }
        const parsed = schema.safeParse(json);
        if (!parsed.success) throw new PierreClientError("Invalid response schema", "schema_mismatch", 502, requestId, parsed.error.issues);
        return { data: parsed.data, requestId };
      } catch (e) {
        lastErr = e;
        const isClientErr = e instanceof PierreClientError;
        const retriable = opts.retrySafe && (!isClientErr || (e as PierreClientError).status >= 500);
        if (!retriable || attempt === maxTries - 1) throw e;
        await new Promise((r) => setTimeout(r, 150 * 2 ** attempt + Math.random() * 100));
      } finally {
        clearTimeout(timer);
        if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      }
    }
    throw lastErr;
  }

  return {
    async createMission(input: { instruction: string; source?: string; idempotency_key?: string; autonomy_mode?: string; signal?: AbortSignal }): Promise<MissionView> {
      // Stable idempotency key so a double-click / retry never creates two missions.
      const idempotency_key = input.idempotency_key ?? `ui|${cfg.companyId}|${input.instruction.trim()}`;
      const { data } = await request("POST", "/api/pierre/v1/missions", MissionView, {
        body: { instruction: input.instruction, source: input.source ?? "cockpit", idempotency_key, autonomy_mode: input.autonomy_mode },
        signal: input.signal,
        retrySafe: true, // safe: carries idempotency key
      });
      return data;
    },
    async listMissions(q: { limit?: number; cursor?: string | null; status?: string | null; signal?: AbortSignal } = {}): Promise<MissionList> {
      const params = new URLSearchParams();
      if (q.limit) params.set("limit", String(q.limit));
      if (q.cursor) params.set("cursor", q.cursor);
      if (q.status) params.set("status", q.status);
      const { data } = await request("GET", `/api/pierre/v1/missions?${params.toString()}`, MissionList, { signal: q.signal, retrySafe: true });
      return data;
    },
    async getMission(id: string, signal?: AbortSignal): Promise<MissionView> {
      return (await request("GET", `/api/pierre/v1/missions/${encodeURIComponent(id)}`, MissionView, { signal, retrySafe: true })).data;
    },
    async getMissionTasks(id: string, signal?: AbortSignal) {
      return (await request("GET", `/api/pierre/v1/missions/${encodeURIComponent(id)}/tasks`, TaskList, { signal, retrySafe: true })).data;
    },
    async getMissionTimeline(id: string, signal?: AbortSignal) {
      return (await request("GET", `/api/pierre/v1/missions/${encodeURIComponent(id)}/timeline`, Timeline, { signal, retrySafe: true })).data;
    },
    async listMissionValidations(id: string, signal?: AbortSignal) {
      return (await request("GET", `/api/pierre/v1/missions/${encodeURIComponent(id)}/validations`, ValidationList, { signal, retrySafe: true })).data;
    },
    async approveValidation(validationId: string, version: number) {
      return (await request("POST", `/api/pierre/v1/validations/${encodeURIComponent(validationId)}/approve`, DecideResult, { body: { version } })).data;
    },
    async rejectValidation(validationId: string, version: number) {
      return (await request("POST", `/api/pierre/v1/validations/${encodeURIComponent(validationId)}/reject`, DecideResult, { body: { version } })).data;
    },
    async requestValidationChanges(validationId: string, version: number) {
      return (await request("POST", `/api/pierre/v1/validations/${encodeURIComponent(validationId)}/request-changes`, DecideResult, { body: { version } })).data;
    },
    async cancelMission(id: string) {
      return (await request("POST", `/api/pierre/v1/missions/${encodeURIComponent(id)}/cancel`, CancelResult, {})).data;
    },
    async getRuntimeHealth(signal?: AbortSignal) {
      return (await request("GET", "/api/pierre/v1/health", Health, { signal, retrySafe: true })).data;
    },
  };
}

export type PierreV1Client = ReturnType<typeof createPierreClient>;
