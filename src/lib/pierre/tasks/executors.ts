import { normalizePierreTaskStatus } from "./status";

export type PierreExecutorTask = {
  id: string;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  mission_id?: string | null;
  payload?: unknown;
  result?: unknown;
  [key: string]: unknown;
};

export type PierreExecutorContext = {
  now?: Date;
};

export type PierreExecutorSuccess = {
  ok: true;
  status: "completed";
  result: Record<string, unknown>;
  log: {
    level: "info";
    event: string;
    message: string;
    payload?: Record<string, unknown>;
  };
};

export type PierreExecutorFailure = {
  ok: false;
  status: "failed" | "blocked" | "awaiting_info" | "awaiting_approval";
  error_code:
    | "UNSUPPORTED_TASK"
    | "MISSING_PAYLOAD"
    | "MISSING_INFO"
    | "APPROVAL_REQUIRED"
    | "EXECUTION_ERROR";
  message: string;
  log: {
    level: "error" | "warning";
    event: string;
    message: string;
    payload?: Record<string, unknown>;
  };
};

export type PierreExecutorOutcome =
  | PierreExecutorSuccess
  | PierreExecutorFailure;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function missingInfoFromPayload(payload: unknown): string[] {
  if (!isObject(payload)) return [];
  const missingInfo = payload.missing_info;
  if (!Array.isArray(missingInfo)) return [];
  return missingInfo.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function hasApprovalRequired(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  return payload.approval_required === true;
}

function buildSuccess(
  event: string,
  message: string,
  result: Record<string, unknown>,
): PierreExecutorSuccess {
  return {
    ok: true,
    status: "completed",
    result,
    log: {
      level: "info",
      event,
      message,
      payload: result,
    },
  };
}

function buildFailure(params: {
  status: PierreExecutorFailure["status"];
  error_code: PierreExecutorFailure["error_code"];
  event: string;
  level: PierreExecutorFailure["log"]["level"];
  message: string;
  payload?: Record<string, unknown>;
}): PierreExecutorFailure {
  return {
    ok: false,
    status: params.status,
    error_code: params.error_code,
    message: params.message,
    log: {
      level: params.level,
      event: params.event,
      message: params.message,
      payload: params.payload,
    },
  };
}

function executeGenerateDocument(
  task: PierreExecutorTask,
  context: PierreExecutorContext,
): PierreExecutorOutcome {
  const payload = isObject(task.payload) ? task.payload : null;
  const missingInfo = missingInfoFromPayload(payload);

  if (missingInfo.length > 0) {
    return buildFailure({
      status: "awaiting_info",
      error_code: "MISSING_INFO",
      event: "document_generation_waiting_info",
      level: "warning",
      message: "Impossible de gÃ©nÃ©rer le document sans les informations manquantes.",
      payload: { missing_info: missingInfo },
    });
  }

  return buildSuccess(
    "document_generated",
    "Le document RH a Ã©tÃ© gÃ©nÃ©rÃ© avec succÃ¨s.",
    {
      generated_document: true,
      task_id: task.id,
      generated_at: (context.now ?? new Date()).toISOString(),
    },
  );
}

function executePrepareEmail(
  task: PierreExecutorTask,
  context: PierreExecutorContext,
): PierreExecutorOutcome {
  const payload = isObject(task.payload) ? task.payload : null;
  const missingInfo = missingInfoFromPayload(payload);

  if (missingInfo.length > 0) {
    return buildFailure({
      status: "awaiting_info",
      error_code: "MISSING_INFO",
      event: "email_preparation_waiting_info",
      level: "warning",
      message: "Impossible de prÃ©parer lâ€™email tant que certaines informations manquent.",
      payload: { missing_info: missingInfo },
    });
  }

  if (hasApprovalRequired(payload)) {
    return buildFailure({
      status: "awaiting_approval",
      error_code: "APPROVAL_REQUIRED",
      event: "email_preparation_waiting_approval",
      level: "warning",
      message: "La prÃ©paration de lâ€™email exige une validation humaine prÃ©alable.",
    });
  }

  return buildSuccess(
    "email_prepared",
    "Lâ€™email RH a Ã©tÃ© prÃ©parÃ© avec succÃ¨s.",
    {
      prepared_email: true,
      task_id: task.id,
      generated_at: (context.now ?? new Date()).toISOString(),
    },
  );
}

function executeGeneratePdf(
  task: PierreExecutorTask,
  context: PierreExecutorContext,
): PierreExecutorOutcome {
  const payload = isObject(task.payload) ? task.payload : null;
  const missingInfo = missingInfoFromPayload(payload);

  if (missingInfo.length > 0) {
    return buildFailure({
      status: "awaiting_info",
      error_code: "MISSING_INFO",
      event: "pdf_generation_waiting_info",
      level: "warning",
      message: "Impossible de gÃ©nÃ©rer le PDF sans les informations nÃ©cessaires.",
      payload: { missing_info: missingInfo },
    });
  }

  return buildSuccess(
    "pdf_generated",
    "Le PDF a Ã©tÃ© gÃ©nÃ©rÃ© avec succÃ¨s.",
    {
      generated_pdf: true,
      task_id: task.id,
      generated_at: (context.now ?? new Date()).toISOString(),
    },
  );
}

function executeScheduleFollowUp(
  task: PierreExecutorTask,
  context: PierreExecutorContext,
): PierreExecutorOutcome {
  return buildSuccess(
    "follow_up_scheduled",
    "La relance a Ã©tÃ© planifiÃ©e avec succÃ¨s.",
    {
      scheduled_follow_up: true,
      task_id: task.id,
      generated_at: (context.now ?? new Date()).toISOString(),
      scheduled_for: asString(task.scheduled_for),
    },
  );
}

function executeRequestMissingInfo(task: PierreExecutorTask): PierreExecutorOutcome {
  const payload = isObject(task.payload) ? task.payload : null;
  const missingInfo = missingInfoFromPayload(payload);

  return buildFailure({
    status: "awaiting_info",
    error_code: "MISSING_INFO",
    event: "request_missing_info",
    level: "warning",
    message:
      missingInfo.length > 0
        ? "La tÃ¢che reste en attente des informations manquantes."
        : "La tÃ¢che attend des clarifications supplÃ©mentaires.",
    payload: {
      missing_info: missingInfo,
    },
  });
}

function executeBlockMission(task: PierreExecutorTask): PierreExecutorOutcome {
  return buildFailure({
    status: "blocked",
    error_code: "EXECUTION_ERROR",
    event: "mission_blocked",
    level: "warning",
    message: "La mission est bloquÃ©e et nÃ©cessite un arbitrage humain.",
    payload: {
      task_id: task.id,
    },
  });
}

function executeStructureMission(
  task: PierreExecutorTask,
  context: PierreExecutorContext,
): PierreExecutorOutcome {
  return buildSuccess(
    "mission_structured",
    "La mission RH a Ã©tÃ© structurÃ©e avec succÃ¨s.",
    {
      structured_mission: true,
      task_id: task.id,
      generated_at: (context.now ?? new Date()).toISOString(),
    },
  );
}

export async function executePierreTask(
  task: PierreExecutorTask,
  context: PierreExecutorContext = {},
): Promise<PierreExecutorOutcome> {
  const normalizedStatus = normalizePierreTaskStatus(task.status);

  if (normalizedStatus !== "running" && normalizedStatus !== "queued" && normalizedStatus !== "pending") {
    return buildFailure({
      status: "blocked",
      error_code: "EXECUTION_ERROR",
      event: "executor_invalid_status",
      level: "warning",
      message: `La tÃ¢che ne peut pas Ãªtre exÃ©cutÃ©e depuis le statut ${normalizedStatus}.`,
      payload: {
        status: normalizedStatus,
      },
    });
  }

  if (!task.type) {
    return buildFailure({
      status: "failed",
      error_code: "UNSUPPORTED_TASK",
      event: "executor_missing_task_type",
      level: "error",
      message: "Le type de tÃ¢che est manquant.",
    });
  }

  switch (task.type) {
    case "generate_document":
      return executeGenerateDocument(task, context);

    case "prepare_email":
      return executePrepareEmail(task, context);

    case "generate_pdf":
      return executeGeneratePdf(task, context);

    case "schedule_follow_up":
      return executeScheduleFollowUp(task, context);

    case "request_missing_info":
      return executeRequestMissingInfo(task);

    case "block_mission":
      return executeBlockMission(task);

    case "structure_mission":
      return executeStructureMission(task, context);

    default:
      return buildFailure({
        status: "failed",
        error_code: "UNSUPPORTED_TASK",
        event: "executor_unsupported_task",
        level: "error",
        message: `Type de tÃ¢che non supportÃ© : ${task.type}`,
        payload: {
          task_type: task.type,
        },
      });
  }
}


export type PierreRunnableTask = PierreExecutorTask & {
  user_id: string;
  mission_id?: string | null;
  payload_json: Record<string, unknown>;
  result_json?: Record<string, unknown>;
};
