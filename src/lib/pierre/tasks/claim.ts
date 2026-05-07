import {
  canPierreTaskRunNow,
  normalizePierreTaskStatus,
  type PierreTaskStatus,
} from "./status";

export type PierreClaimableTask = {
  id: string;
  status?: string | null;
  scheduled_for?: string | null;
  claimed_at?: string | null;
  claimed_by?: string | null;
  locked_until?: string | null;
  approval_required?: boolean | null;
  retry_count?: number | null;
  mission_id?: string | null;
  task_group_key?: string | null;
  [key: string]: unknown;
};

export type PierreTaskClaimInput = {
  task: PierreClaimableTask;
  workerId: string;
  now?: Date;
  lockMinutes?: number;
  force?: boolean;
};

export type PierreTaskClaimDecision = {
  allowed: boolean;
  next_status: PierreTaskStatus;
  claimed_at: string | null;
  claimed_by: string | null;
  locked_until: string | null;
  reason: string;
  conflict_code:
    | "NONE"
    | "MISSING_WORKER_ID"
    | "ALREADY_LOCKED"
    | "AWAITING_APPROVAL"
    | "SCHEDULED_FUTURE"
    | "INVALID_STATUS";
};

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

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

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFutureDate(value: string | null | undefined, now: Date): boolean {
  const date = toDate(value);
  return Boolean(date && date.getTime() > now.getTime());
}

function sanitizeLockMinutes(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 10;
  }
  return Math.max(1, Math.min(60, Math.floor(value)));
}

function buildLockUntil(now: Date, lockMinutes: number): string {
  return new Date(now.getTime() + lockMinutes * 60_000).toISOString();
}

function isSameWorker(current: string | null, candidate: string): boolean {
  return Boolean(current && current === candidate);
}

function isLockStillActive(task: PierreClaimableTask, now: Date): boolean {
  return isFutureDate(asString(task.locked_until), now);
}

function hasOpenLockFromAnotherWorker(
  task: PierreClaimableTask,
  workerId: string,
  now: Date,
): boolean {
  const claimedBy = asString(task.claimed_by);
  if (!claimedBy) return false;
  if (isSameWorker(claimedBy, workerId)) return false;
  return isLockStillActive(task, now);
}

export function decidePierreTaskClaim(
  input: PierreTaskClaimInput,
): PierreTaskClaimDecision {
  const now = input.now ?? new Date();
  const task = input.task;
  const normalizedStatus = normalizePierreTaskStatus(task.status);
  const workerId = input.workerId.trim();
  const claimedAt = asString(task.claimed_at);
  const claimedBy = asString(task.claimed_by);
  const lockedUntil = asString(task.locked_until);
  const scheduledFor = asString(task.scheduled_for);
  const lockMinutes = sanitizeLockMinutes(input.lockMinutes);

  if (!workerId) {
    return {
      allowed: false,
      next_status: normalizedStatus,
      claimed_at: claimedAt,
      claimed_by: claimedBy,
      locked_until: lockedUntil,
      reason: "Le workerId est requis pour claim une tÃ¢che.",
      conflict_code: "MISSING_WORKER_ID",
    };
  }

  if (!input.force && hasOpenLockFromAnotherWorker(task, workerId, now)) {
    return {
      allowed: false,
      next_status: normalizedStatus,
      claimed_at: claimedAt,
      claimed_by: claimedBy,
      locked_until: lockedUntil,
      reason: "La tÃ¢che est dÃ©jÃ  verrouillÃ©e par un autre worker.",
      conflict_code: "ALREADY_LOCKED",
    };
  }

  if (!input.force && asBoolean(task.approval_required) === true) {
    return {
      allowed: false,
      next_status: "awaiting_approval",
      claimed_at: claimedAt,
      claimed_by: claimedBy,
      locked_until: lockedUntil,
      reason: "La tÃ¢che nÃ©cessite une validation humaine avant claim/exÃ©cution.",
      conflict_code: "AWAITING_APPROVAL",
    };
  }

  if (!input.force && isFutureDate(scheduledFor, now)) {
    return {
      allowed: false,
      next_status: "scheduled",
      claimed_at: claimedAt,
      claimed_by: claimedBy,
      locked_until: lockedUntil,
      reason: "La tÃ¢che est planifiÃ©e dans le futur et ne doit pas Ãªtre claimÃ©e maintenant.",
      conflict_code: "SCHEDULED_FUTURE",
    };
  }

  const retryCount = asNumber(task.retry_count) ?? 0;
  const canRunNow = canPierreTaskRunNow(task.status);

  if (
    !input.force &&
    !canRunNow &&
    normalizedStatus !== "scheduled" &&
    normalizedStatus !== "running"
  ) {
    return {
      allowed: false,
      next_status: normalizedStatus,
      claimed_at: claimedAt,
      claimed_by: claimedBy,
      locked_until: lockedUntil,
      reason: `Le statut courant (${normalizedStatus}) nâ€™autorise pas un claim immÃ©diat.`,
      conflict_code: "INVALID_STATUS",
    };
  }

  const nextClaimedAt = now.toISOString();
  const nextLockedUntil = buildLockUntil(now, lockMinutes);

  return {
    allowed: true,
    next_status: "running",
    claimed_at: nextClaimedAt,
    claimed_by: workerId,
    locked_until: nextLockedUntil,
    reason:
      retryCount > 0
        ? `La tÃ¢che a Ã©tÃ© reclaimÃ©e pour exÃ©cution (tentative ${retryCount + 1}).`
        : "La tÃ¢che a Ã©tÃ© claimÃ©e avec succÃ¨s pour exÃ©cution.",
    conflict_code: "NONE",
  };
}

export function buildPierreTaskClaimPatch(
  input: PierreTaskClaimInput,
): {
  allowed: boolean;
  patch: Record<string, unknown>;
  reason: string;
  conflict_code: PierreTaskClaimDecision["conflict_code"];
} {
  const now = input.now ?? new Date();
  const decision = decidePierreTaskClaim(input);

  if (!decision.allowed) {
    return {
      allowed: false,
      patch: {
        status: decision.next_status,
      },
      reason: decision.reason,
      conflict_code: decision.conflict_code,
    };
  }

  return {
    allowed: true,
    patch: {
      status: decision.next_status,
      claimed_at: decision.claimed_at,
      claimed_by: decision.claimed_by,
      locked_until: decision.locked_until,
      started_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    reason: decision.reason,
    conflict_code: decision.conflict_code,
  };
}

export function shouldPierreTaskBeReclaimed(
  task: PierreClaimableTask,
  now: Date = new Date(),
): boolean {
  const status = normalizePierreTaskStatus(task.status);
  if (status !== "running") return false;

  const lockedUntil = toDate(asString(task.locked_until));
  if (!lockedUntil) return true;

  return lockedUntil.getTime() <= now.getTime();
}