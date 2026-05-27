// B43 — Correlation ID helpers

let _counter = 0;

function pad(n: number, digits: number): string {
  return String(n).padStart(digits, "0");
}

function pseudoRandom(): string {
  const t = Date.now();
  _counter = (_counter + 1) % 99999;
  return `${t.toString(36)}${pad(_counter, 5)}`;
}

// ── ID creation ───────────────────────────────────────────────────────────────

export function createCorrelationId(prefix = "cor"): string {
  return `${prefix}_${pseudoRandom()}`;
}

export function createCausationId(parentCorrelationId: string): string {
  return `cau_${parentCorrelationId}_${pseudoRandom()}`;
}

export function ensureCorrelationId(existing?: string | null, prefix = "cor"): string {
  if (existing && existing.trim().length > 0) return existing.trim();
  return createCorrelationId(prefix);
}

// ── Context object ────────────────────────────────────────────────────────────

export type CorrelationContext = {
  correlation_id: string;
  causation_id: string | null;
  agent_slug: string;
  company_id: string | null;
  user_id: string | null;
  mission_id: string | null;
  task_id: string | null;
};

export function buildCorrelationContext(params: Partial<CorrelationContext>): CorrelationContext {
  return {
    correlation_id: ensureCorrelationId(params.correlation_id),
    causation_id: params.causation_id ?? null,
    agent_slug: params.agent_slug ?? "pierre",
    company_id: params.company_id ?? null,
    user_id: params.user_id ?? null,
    mission_id: params.mission_id ?? null,
    task_id: params.task_id ?? null,
  };
}

// ── HTTP headers ──────────────────────────────────────────────────────────────

export function buildCorrelationHeaders(ctx: CorrelationContext): Record<string, string> {
  const headers: Record<string, string> = {
    "x-correlation-id": ctx.correlation_id,
  };
  if (ctx.causation_id) headers["x-causation-id"] = ctx.causation_id;
  if (ctx.mission_id) headers["x-mission-id"] = ctx.mission_id;
  return headers;
}

export function extractCorrelationIdFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const val = headers["x-correlation-id"];
  if (typeof val === "string" && val.trim().length > 0) return val.trim();
  if (Array.isArray(val) && val.length > 0) return val[0];
  return null;
}
