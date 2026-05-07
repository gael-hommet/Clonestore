export type PierreTaskCreateInput = {
  missionId: string;
  type: string;
  title: string;
  description: string;
  status?:
    | "pending"
    | "queued"
    | "scheduled"
    | "awaiting_info"
    | "awaiting_approval"
    | "blocked";
  riskLevel?: "normal" | "sensitive" | "critical";
  approvalRequired?: boolean;
  scheduledFor?: string | null;
  payload?: Record<string, unknown> | null;
  maxRetries?: number;
  taskGroupKey?: string | null;
};

export type PierreTaskInsertRow = {
  mission_id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  risk_level: string;
  approval_required: boolean;
  scheduled_for: string | null;
  payload: Record<string, unknown> | null;
  retry_count: number;
  max_retries: number;
  task_group_key: string | null;
};

function sanitizeStatus(
  value: PierreTaskCreateInput["status"] | undefined,
): PierreTaskInsertRow["status"] {
  return value || "queued";
}

function sanitizeRiskLevel(
  value: PierreTaskCreateInput["riskLevel"] | undefined,
): PierreTaskInsertRow["risk_level"] {
  return value || "normal";
}

function sanitizeMaxRetries(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 3;
  }
  return Math.max(0, Math.min(20, Math.floor(value)));
}

export function buildPierreTaskInsertRow(
  input: PierreTaskCreateInput,
): PierreTaskInsertRow {
  return {
    mission_id: input.missionId,
    type: input.type,
    title: input.title,
    description: input.description,
    status: sanitizeStatus(input.status),
    risk_level: sanitizeRiskLevel(input.riskLevel),
    approval_required: Boolean(input.approvalRequired),
    scheduled_for: input.scheduledFor || null,
    payload: input.payload || null,
    retry_count: 0,
    max_retries: sanitizeMaxRetries(input.maxRetries),
    task_group_key: input.taskGroupKey || null,
  };
}

export function buildPierreTaskInsertRows(
  inputs: PierreTaskCreateInput[],
): PierreTaskInsertRow[] {
  return inputs.map(buildPierreTaskInsertRow);
}