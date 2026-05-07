import { normalizePierreTaskStatus, type PierreTaskStatus } from "./status";

export type PierreReleasableTask = {
  id: string;
  status?: string | null;
  claimed_at?: string | null;
  claimed_by?: string | null;
  locked_until?: string | null;
  scheduled_for?: string | null;
  retry_count?: number | null;
  [key: string]: unknown;
};

export type PierreTaskReleaseInput = {
  task: PierreReleasableTask;
  workerId?: string | null;
  now?: Date;
  mode?: "unlock_only" | "requeue" | "reschedule";
  delayMinutes?: number;
  force?: boolean;
};

export type PierreTaskReleaseDecision = {
  allowed: boolean;
  next_status: PierreTaskStatus;
  claimed_at: null;
  claimed_by: null;
  locked_until: null;
  scheduled_for: string | null;
  reason: string;
  release_code:
    | "NONE"
    | "NOT_CLAIMED"
    | "WORKER_MISMATCH"
    | "TERMINAL_STATUS";
};

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

function sanitizeDelayMinutes(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 15;
  }
  return Math.max(1, Math.min(24 * 60, Math.floor(value)));
}

function buildFutureIso(now: Date, delayMinutes: number): string {
  return new Date(now.getTime() + delayMinutes * 60_000).toISOString();
}

export function decidePierreTaskRelease(
  input: PierreTaskReleaseInput,
): PierreTaskReleaseDecision {
  const now = input.now ?? new Date();
  const task = input.task;
  const normalizedStatus = normalizePierreTaskStatus(task.status);
  const claimedBy = asString(task.claimed_by);
  const mode = input.mode || "requeue";

  if (
    normalizedStatus === "completed" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "failed"
  ) {
    return {
      allowed: false,
      next_status: normalizedStatus,
      claimed_at: null,
      claimed_by: null,
      locked_until: null,
      scheduled_for: asString(task.scheduled_for),
      reason: "La tâche est terminale, aucun release opérationnel n’est nécessaire.",
      release_code: "TERMINAL_STATUS",
    };
  }

  if (!input.force && !claimedBy) {
    return {
      allowed: false,
      next_status: normalizedStatus,
      claimed_at: null,
      claimed_by: null,
      locked_until: null,
      scheduled_for: asString(task.scheduled_for),
      reason: "La tâche n’est pas claimée, aucun release n’est nécessaire.",
      release_code: "NOT_CLAIMED",
    };
  }

  if (!input.force && claimedBy && input.workerId && claimedBy !== input.workerId) {
    return {
      allowed: false,
      next_status: normalizedStatus,
      claimed_at: null,
      claimed_by: null,
      locked_until: null,
      scheduled_for: asString(task.scheduled_for),
      reason: "Le worker demandé n’est pas propriétaire du lock actuel.",
      release_code: "WORKER_MISMATCH",
    };
  }

  if (mode === "unlock_only") {
    return {
      allowed: true,
      next_status: normalizedStatus,
      claimed_at: null,
      claimed_by: null,
      locked_until: null,
      scheduled_for: asString(task.scheduled_for),
      reason: "Le verrou a été supprimé sans modifier le statut de la tâche.",
      release_code: "NONE",
    };
  }

  if (mode === "reschedule") {
    const delayMinutes = sanitizeDelayMinutes(input.delayMinutes);

    return {
      allowed: true,
      next_status: "scheduled",
      claimed_at: null,
      claimed_by: null,
      locked_until: null,
      scheduled_for: buildFutureIso(now, delayMinutes),
      reason: `La tâche a été libérée et replanifiée dans ${delayMinutes} minute(s).`,
      release_code: "NONE",
    };
  }

  return {
    allowed: true,
    next_status: "queued",
    claimed_at: null,
    claimed_by: null,
    locked_until: null,
    scheduled_for: null,
    reason: "La tâche a été libérée et replacée en file d’attente.",
    release_code: "NONE",
  };
}

export function buildPierreTaskReleasePatch(
  input: PierreTaskReleaseInput,
): {
  allowed: boolean;
  patch: Record<string, unknown>;
  reason: string;
  release_code: PierreTaskReleaseDecision["release_code"];
} {
  const now = input.now ?? new Date();
  const decision = decidePierreTaskRelease(input);

  if (!decision.allowed) {
    return {
      allowed: false,
      patch: {
        status: decision.next_status,
      },
      reason: decision.reason,
      release_code: decision.release_code,
    };
  }

  return {
    allowed: true,
    patch: {
      status: decision.next_status,
      claimed_at: decision.claimed_at,
      claimed_by: decision.claimed_by,
      locked_until: decision.locked_until,
      scheduled_for: decision.scheduled_for,
      updated_at: now.toISOString(),
    },
    reason: decision.reason,
    release_code: decision.release_code,
  };
}