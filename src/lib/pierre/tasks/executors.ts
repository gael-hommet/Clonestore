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

// Artifact request shapes emitted by executors when payload has content.
// The persistence layer (process-task.ts + run-next adapter) handles actual DB writes.
export type PierreDocumentArtifactRequest = {
  kind: "document" | "pdf";
  doc_type: string;
  title: string;
  text_content: string;
  html_content: string;
};

export type PierreEmailArtifactRequest = {
  kind: "email_draft" | "email_send";
  subject: string;
  body_text: string;
  body_html: string;
  to_json: string[];
  cc_json: string[];
  bcc_json: string[];
};

export type PierreArtifactRequest =
  | PierreDocumentArtifactRequest
  | PierreEmailArtifactRequest;

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

// Extract email addresses from a payload field value.
function collectEmailStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item))
      .filter((v): v is string => v !== null && v.includes("@"));
  }
  if (typeof value === "string" && value.includes("@")) {
    return [value.trim()];
  }
  return [];
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

// Try to extract a document artifact request from the task payload.
// Returns null when the payload lacks content — no artifact can be prepared.
function tryExtractDocumentArtifact(
  task: PierreExecutorTask,
  kind: "document" | "pdf",
): PierreDocumentArtifactRequest | null {
  const payload = isObject(task.payload) ? task.payload : null;
  if (!payload) return null;

  const textContent =
    asString(payload.text_content) ||
    asString(payload.body_text) ||
    asString(payload.document_text) ||
    asString(payload.generated_document_text) ||
    asString(payload.raw_input) ||
    asString(payload.input);

  const htmlContent =
    asString(payload.html_content) ||
    asString(payload.body_html) ||
    asString(payload.document_html) ||
    asString(payload.generated_document_html);

  if (!textContent && !htmlContent) return null;

  const resolvedDocType =
    asString(payload.doc_type) || (kind === "pdf" ? "pdf_export" : "document_rh");

  const resolvedTitle =
    asString(payload.title) ||
    asString(task.title) ||
    (kind === "pdf" ? "Document Pierre PDF" : "Document Pierre");

  return {
    kind,
    doc_type: resolvedDocType,
    title: resolvedTitle,
    text_content: textContent || "",
    html_content: htmlContent || "",
  };
}

// Try to extract an email artifact request from the task payload.
// Returns null when the payload lacks subject and body — no draft can be prepared.
function tryExtractEmailArtifact(
  task: PierreExecutorTask,
  kind: "email_draft" | "email_send",
): PierreEmailArtifactRequest | null {
  const payload = isObject(task.payload) ? task.payload : null;
  if (!payload) return null;

  const subject =
    asString(payload.subject) ||
    asString(payload.email_subject) ||
    asString(payload.title);

  const bodyText =
    asString(payload.body_text) ||
    asString(payload.text_content) ||
    asString(payload.document_text) ||
    asString(payload.generated_document_text) ||
    asString(payload.raw_input);

  const bodyHtml =
    asString(payload.body_html) ||
    asString(payload.html_content) ||
    asString(payload.document_html) ||
    asString(payload.generated_document_html);

  if (!subject && !bodyText && !bodyHtml) return null;

  const toJson = [
    ...collectEmailStrings(payload.to),
    ...collectEmailStrings(payload.recipient_email),
    ...collectEmailStrings(payload.recipient_emails),
    ...collectEmailStrings(payload.destinataire_email),
    ...collectEmailStrings(payload.destinataires),
  ];

  const ccJson = [
    ...collectEmailStrings(payload.cc),
    ...collectEmailStrings(payload.cc_emails),
  ];

  const bccJson = [
    ...collectEmailStrings(payload.bcc),
    ...collectEmailStrings(payload.bcc_emails),
  ];

  return {
    kind,
    subject: subject || "(sans objet)",
    body_text: bodyText || "",
    body_html: bodyHtml || "",
    to_json: [...new Set(toJson)],
    cc_json: [...new Set(ccJson)],
    bcc_json: [...new Set(bccJson)],
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
      message: "Impossible de generer le document sans les informations manquantes.",
      payload: { missing_info: missingInfo },
    });
  }

  const artifactRequest = tryExtractDocumentArtifact(task, "document");
  const generatedAt = (context.now ?? new Date()).toISOString();

  return buildSuccess(
    "document_artifact_planned",
    "Tache de generation de document enregistree.",
    {
      task_id: task.id,
      generated_at: generatedAt,
      ...(artifactRequest
        ? { artifact_request: artifactRequest }
        : { artifact_pending: true, note: "Le payload ne contient pas de contenu generable." }),
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
      message: "Impossible de preparer l'email tant que certaines informations manquent.",
      payload: { missing_info: missingInfo },
    });
  }

  if (hasApprovalRequired(payload)) {
    return buildFailure({
      status: "awaiting_approval",
      error_code: "APPROVAL_REQUIRED",
      event: "email_preparation_waiting_approval",
      level: "warning",
      message: "La preparation de l'email exige une validation humaine prealable.",
    });
  }

  const isSend = task.type === "email.send" || task.type === "send_email";
  const artifactRequest = tryExtractEmailArtifact(
    task,
    isSend ? "email_send" : "email_draft",
  );
  const generatedAt = (context.now ?? new Date()).toISOString();

  return buildSuccess(
    "email_artifact_planned",
    "Tache de preparation d'email enregistree.",
    {
      task_id: task.id,
      generated_at: generatedAt,
      ...(artifactRequest
        ? { artifact_request: artifactRequest }
        : { artifact_pending: true, note: "Le payload ne contient pas de contenu email generable." }),
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
      message: "Impossible de generer le PDF sans les informations necessaires.",
      payload: { missing_info: missingInfo },
    });
  }

  const artifactRequest = tryExtractDocumentArtifact(task, "pdf");
  const generatedAt = (context.now ?? new Date()).toISOString();

  return buildSuccess(
    "pdf_artifact_planned",
    "Tache de generation PDF enregistree.",
    {
      task_id: task.id,
      generated_at: generatedAt,
      ...(artifactRequest
        ? { artifact_request: artifactRequest }
        : { artifact_pending: true, note: "Le payload ne contient pas de contenu PDF generable." }),
    },
  );
}

function executeScheduleFollowUp(
  task: PierreExecutorTask,
  context: PierreExecutorContext,
): PierreExecutorOutcome {
  return buildSuccess(
    "follow_up_scheduled",
    "La relance a ete planifiee avec succes.",
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
        ? "La tache reste en attente des informations manquantes."
        : "La tache attend des clarifications supplementaires.",
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
    message: "La mission est bloquee et necessite un arbitrage humain.",
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
    "La mission RH a ete structuree avec succes.",
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

  if (
    normalizedStatus !== "running" &&
    normalizedStatus !== "queued" &&
    normalizedStatus !== "pending"
  ) {
    return buildFailure({
      status: "blocked",
      error_code: "EXECUTION_ERROR",
      event: "executor_invalid_status",
      level: "warning",
      message: `La tache ne peut pas etre executee depuis le statut ${normalizedStatus}.`,
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
      message: "Le type de tache est manquant.",
    });
  }

  switch (task.type) {
    case "generate_document":
    case "doc.generate":
    case "doc.rewrite":
      return executeGenerateDocument(task, context);

    case "prepare_email":
    case "email.draft":
    case "email.send":
      return executePrepareEmail(task, context);

    case "generate_pdf":
    case "pdf.generate":
      return executeGeneratePdf(task, context);

    case "schedule_follow_up":
    case "followup.schedule":
    case "reminder.create":
      return executeScheduleFollowUp(task, context);

    case "request_missing_info":
    case "ask_missing_info":
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
        message: `Type de tache non supporte : ${task.type}`,
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
