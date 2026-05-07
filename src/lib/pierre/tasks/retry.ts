import {
  canPierreTaskBeRetried,
  normalizePierreTaskStatus,
  type PierreTaskStatus,
} from "./status";

export type PierreRetryableTask = {
  id: string;
  status?: string | null;
  retry_count?: number | null;
  max_retries?: number | null;
  scheduled_for?: string | null;
  blocked_reason?: string | null;
  error_message?: string | null;
  payload?: unknown;
  result?: unknown;
  claimed_at?: string | null;
  claimed_by?: string | null;
  locked_until?: string | null;
  [key: string]: unknown;
};

export type PierreTaskRetryInput = {
  task: PierreRetryableTask;
  now?: Date;
  delayMinutes?: number;
  force?: boolean;
};

export type PierreTaskRetryDecision = {
  allowed: boolean;
  next_status: PierreTaskStatus;
  retry_count: number;
  scheduled_for: string | null;
  reason: string;
  retry_code:
    | "NONE"
    | "INVALID_STATUS"
    | "MAX_RETRIES_REACHED";
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function computeRetryDelayMinutes(
  retryCount: number,
  explicitDelayMinutes?: number,
): number {
  if (
    typeof explicitDelayMinutes === "number" &&
    Number.isFinite(explicitDelayMinutes) &&
    explicitDelayMinutes > 0
  ) {
    return Math.max(1, Math.min(24 * 60, Math.floor(explicitDelayMinutes)));
  }

  if (retryCount <= 1) return 5;
  if (retryCount === 2) return 15;
  if (retryCount === 3) return 30;
  if (retryCount === 4) return 60;
  return 180;
}

function buildFutureIso(now: Date, delayMinutes: number): string {
  return new Date(now.getTime() + delayMinutes * 60_000).toISOString();
}

export function decidePierreTaskRetry(
  input: PierreTaskRetryInput,
): PierreTaskRetryDecision {
  const now = input.now ?? new Date();
  const task = input.task;
  const normalizedStatus = normalizePierreTaskStatus(task.status);
  const currentRetryCount = asNumber(task.retry_count) ?? 0;
  const maxRetries = asNumber(task.max_retries) ?? 3;
  const nextRetryCount = currentRetryCount + 1;

  if (!input.force && !canPierreTaskBeRetried(task.status)) {
    return {
      allowed: false,
      next_status: normalizedStatus,
      retry_count: currentRetryCount,
      scheduled_for: asString(task.scheduled_for),
      reason: "Le statut actuel n’autorise pas de relance automatique.",
      retry_code: "INVALID_STATUS",
    };
  }

  if (!input.force && nextRetryCount > maxRetries) {
    return {
      allowed: false,
      next_status: "blocked",
      retry_count: currentRetryCount,
      scheduled_for: null,
      reason:
        "Le nombre maximal de tentatives a été atteint. La tâche doit être revue humainement.",
      retry_code: "MAX_RETRIES_REACHED",
    };
  }

  const delayMinutes = computeRetryDelayMinutes(
    nextRetryCount,
    input.delayMinutes,
  );
  const scheduledFor = buildFutureIso(now, delayMinutes);

  return {
    allowed: true,
    next_status: "scheduled",
    retry_count: nextRetryCount,
    scheduled_for: scheduledFor,
    reason: `Nouvelle tentative planifiée dans ${delayMinutes} minute(s).`,
    retry_code: "NONE",
  };
}

export function buildPierreTaskRetryPatch(
  input: PierreTaskRetryInput,
): {
  allowed: boolean;
  patch: Record<string, unknown>;
  reason: string;
  retry_code: PierreTaskRetryDecision["retry_code"];
} {
  const now = input.now ?? new Date();
  const decision = decidePierreTaskRetry(input);

  if (!decision.allowed) {
    return {
      allowed: false,
      patch: {
        status: decision.next_status,
      },
      reason: decision.reason,
      retry_code: decision.retry_code,
    };
  }

  return {
    allowed: true,
    patch: {
      status: decision.next_status,
      retry_count: decision.retry_count,
      scheduled_for: decision.scheduled_for,
      blocked_reason: null,
      claimed_at: null,
      claimed_by: null,
      locked_until: null,
      updated_at: now.toISOString(),
    },
    reason: decision.reason,
    retry_code: decision.retry_code,
  };
}