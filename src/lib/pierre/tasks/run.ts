import {
  canPierreTaskRunNow,
  normalizePierreTaskStatus,
  type PierreTaskStatus,
} from "./status";

export type PierreRunnableTask = {
  id: string;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  approval_required?: boolean | null;
  scheduled_for?: string | null;
  payload?: unknown;
  result?: unknown;
  mission_id?: string | null;
  claimed_at?: string | null;
  claimed_by?: string | null;
  locked_until?: string | null;
  [key: string]: unknown;
};

export type PierreTaskRunInput = {
  task: PierreRunnableTask;
  now?: Date;
};

export type PierreTaskRunDecision = {
  allowed: boolean;
  next_status: PierreTaskStatus;
  reason: string;
  run_code:
    | "NONE"
    | "TERMINAL_STATUS"
    | "ALREADY_RUNNING"
    | "AWAITING_APPROVAL"
    | "AWAITING_INFO"
    | "BLOCKED"
    | "SCHEDULED_FUTURE"
    | "INVALID_STATUS";
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
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

function hasBlockingMissingInfo(payload: unknown): boolean {
  if (!isObject(payload)) return false;

  const missingInfo = payload.missing_info;
  if (Array.isArray(missingInfo) && missingInfo.length > 0) return true;

  const questions = payload.questions;
  if (Array.isArray(questions) && questions.length > 0) return true;

  return false;
}

function isScheduledInFuture(
  scheduledFor: string | null | undefined,
  now: Date,
): boolean {
  if (!scheduledFor) return false;

  const date = new Date(scheduledFor);
  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() > now.getTime();
}

export function decidePierreTaskRun(
  input: PierreTaskRunInput,
): PierreTaskRunDecision {
  const now = input.now ?? new Date();
  const task = input.task;
  const normalizedStatus = normalizePierreTaskStatus(task.status);

  if (
    normalizedStatus === "completed" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "failed"
  ) {
    return {
      allowed: false,
      next_status: normalizedStatus,
      reason: "La tÃ¢che est dÃ©jÃ  dans un Ã©tat terminal.",
      run_code: "TERMINAL_STATUS",
    };
  }

  if (normalizedStatus === "running") {
    return {
      allowed: false,
      next_status: "running",
      reason: "La tÃ¢che est dÃ©jÃ  en cours dâ€™exÃ©cution.",
      run_code: "ALREADY_RUNNING",
    };
  }

  if (normalizedStatus === "awaiting_approval") {
    return {
      allowed: false,
      next_status: "awaiting_approval",
      reason: "La tÃ¢che attend une validation humaine explicite.",
      run_code: "AWAITING_APPROVAL",
    };
  }

  if (normalizedStatus === "awaiting_info") {
    return {
      allowed: false,
      next_status: "awaiting_info",
      reason: "La tÃ¢che attend encore des informations essentielles.",
      run_code: "AWAITING_INFO",
    };
  }

  if (normalizedStatus === "blocked") {
    return {
      allowed: false,
      next_status: "blocked",
      reason: "La tÃ¢che est bloquÃ©e et doit Ãªtre dÃ©bloquÃ©e avant exÃ©cution.",
      run_code: "BLOCKED",
    };
  }

  if (isScheduledInFuture(asString(task.scheduled_for), now)) {
    return {
      allowed: false,
      next_status: "scheduled",
      reason: "La tÃ¢che est planifiÃ©e pour plus tard et ne doit pas encore dÃ©marrer.",
      run_code: "SCHEDULED_FUTURE",
    };
  }

  if (asBoolean(task.approval_required) === true) {
    return {
      allowed: false,
      next_status: "awaiting_approval",
      reason: "La tÃ¢che requiert une validation humaine avant exÃ©cution.",
      run_code: "AWAITING_APPROVAL",
    };
  }

  if (hasBlockingMissingInfo(task.payload)) {
    return {
      allowed: false,
      next_status: "awaiting_info",
      reason: "Le payload de la tÃ¢che signale des informations manquantes.",
      run_code: "AWAITING_INFO",
    };
  }

  if (!canPierreTaskRunNow(task.status) && normalizedStatus !== "scheduled") {
    return {
      allowed: false,
      next_status: normalizedStatus,
      reason: "Le statut actuel nâ€™autorise pas un lancement immÃ©diat.",
      run_code: "INVALID_STATUS",
    };
  }

  return {
    allowed: true,
    next_status: "running",
    reason: "La tÃ¢che est autorisÃ©e Ã  dÃ©marrer maintenant.",
    run_code: "NONE",
  };
}

export function buildPierreTaskRunPatch(
  input: PierreTaskRunInput,
): {
  allowed: boolean;
  patch: Record<string, unknown>;
  reason: string;
  run_code: PierreTaskRunDecision["run_code"];
} {
  const now = input.now ?? new Date();
  const decision = decidePierreTaskRun(input);

  if (!decision.allowed) {
    return {
      allowed: false,
      patch: {
        status: decision.next_status,
      },
      reason: decision.reason,
      run_code: decision.run_code,
    };
  }

  return {
    allowed: true,
    patch: {
      status: "running",
      started_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    reason: decision.reason,
    run_code: decision.run_code,
  };
}