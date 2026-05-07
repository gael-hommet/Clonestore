export type PierreTaskStatus =
  | "pending"
  | "queued"
  | "running"
  | "awaiting_info"
  | "awaiting_approval"
  | "scheduled"
  | "blocked"
  | "completed"
  | "cancelled"
  | "failed"
  | "unknown";

export type PierreTaskStatusSummary = {
  normalized: PierreTaskStatus;
  is_terminal: boolean;
  is_actionable_now: boolean;
  is_waiting_human: boolean;
  is_waiting_time: boolean;
  is_blocking_progress: boolean;
};

export function normalizePierreTaskStatus(value: unknown): PierreTaskStatus {
  if (typeof value !== "string") return "unknown";

  const status = value.trim().toLowerCase();

  if (
    status === "pending" ||
    status === "queued" ||
    status === "running" ||
    status === "awaiting_info" ||
    status === "awaiting_approval" ||
    status === "scheduled" ||
    status === "blocked" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "failed"
  ) {
    return status;
  }

  if (status === "done" || status === "success") return "completed";
  if (status === "error") return "failed";
  if (status === "pending_approval" || status === "needs_approval") {
    return "awaiting_approval";
  }
  if (status === "in_progress") return "running";

  return "unknown";
}

export function summarizePierreTaskStatus(
  value: unknown,
): PierreTaskStatusSummary {
  const normalized = normalizePierreTaskStatus(value);

  const is_terminal =
    normalized === "completed" ||
    normalized === "cancelled" ||
    normalized === "failed";

  const is_waiting_human =
    normalized === "awaiting_info" ||
    normalized === "awaiting_approval";

  const is_waiting_time = normalized === "scheduled";

  const is_actionable_now =
    normalized === "pending" ||
    normalized === "queued";

  const is_blocking_progress =
    normalized === "blocked" ||
    normalized === "failed" ||
    normalized === "awaiting_info" ||
    normalized === "awaiting_approval";

  return {
    normalized,
    is_terminal,
    is_actionable_now,
    is_waiting_human,
    is_waiting_time,
    is_blocking_progress,
  };
}

export function canPierreTaskRunNow(
  value: unknown,
): boolean {
  const summary = summarizePierreTaskStatus(value);
  return summary.is_actionable_now;
}

export function canPierreTaskBeRetried(
  value: unknown,
): boolean {
  const normalized = normalizePierreTaskStatus(value);
  return normalized === "failed" || normalized === "blocked";
}

export function canPierreTaskBeApproved(
  value: unknown,
): boolean {
  return normalizePierreTaskStatus(value) === "awaiting_approval";
}

export function canPierreTaskBeCancelled(
  value: unknown,
): boolean {
  const normalized = normalizePierreTaskStatus(value);
  return !(
    normalized === "completed" ||
    normalized === "cancelled" ||
    normalized === "failed"
  );
}

export function canPierreTaskBeRescheduled(
  value: unknown,
): boolean {
  const normalized = normalizePierreTaskStatus(value);
  return (
    normalized === "scheduled" ||
    normalized === "queued" ||
    normalized === "pending" ||
    normalized === "awaiting_approval"
  );
}