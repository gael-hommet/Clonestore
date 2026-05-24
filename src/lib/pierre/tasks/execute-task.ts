// DB-connected Pierre task executor (Bloc 8)

import { type SupabaseClient } from "@supabase/supabase-js";
import { executePierreTask, type PierreExecutorTask } from "./executors";
import {
  buildPierreTaskExecutionResult,
  type PierreArtifactKind,
  type PierreTaskExecutionInput,
  type PierreTaskExecutionResult,
} from "./artifacts";
import {
  evaluatePierreCloneGuard,
  buildCloneGuardAuditEvent,
} from "../hr/cloneguard";
import {
  evaluateGovernance,
  buildGovernanceAuditEvent,
} from "../hr/governance";
import {
  buildHumanRequiredLogRow,
} from "../logs";
import {
  classifyEmployeeActionRisk,
  resolveEmployeeActionGovernance,
} from "../hr/employee-actions";

// ── Types ──────────────────────────────────────────────────────────────────

type DbRow = Record<string, unknown>;

export type PierreExecutionPersistenceResult = {
  ok: boolean;
  task_id: string;
  mission_id: string | null;
  outcome: "completed" | "blocked" | "failed" | "awaiting_info" | "awaiting_approval";
  artifact: {
    kind: PierreArtifactKind | null;
    status: string;
    document_id: string | null;
    email_id: string | null;
  } | null;
  execution_result: PierreTaskExecutionResult;
  error?: string;
  error_code?: string;
};

// Statuses from which execution is blocked (terminal or pending approval)
const NON_EXECUTABLE_STATUSES = new Set([
  "done",
  "cancelled",
  "error",
  "awaiting_approval",
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

// ── DB helpers ─────────────────────────────────────────────────────────────

async function loadTask(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
): Promise<DbRow> {
  const { data, error } = await supabase
    .from("pierre_tasks")
    .select(
      "id, type, title, status, mission_id, payload_json, result_json, user_id, agent_slug, execute_at",
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Impossible de charger la tâche.",
      code: "TASK_FETCH_FAILED",
    };
  }

  if (!data) {
    throw { status: 404, message: "Tâche introuvable.", code: "TASK_NOT_FOUND" };
  }

  return data as DbRow;
}

async function loadCompanyMemory(
  supabase: SupabaseClient,
  userId: string,
): Promise<DbRow | null> {
  const { data } = await supabase
    .from("pierre_company_memory")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .maybeSingle();

  return (data ?? null) as DbRow | null;
}

async function setTaskRunning(
  supabase: SupabaseClient,
  taskId: string,
): Promise<void> {
  await supabase
    .from("pierre_tasks")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", taskId);
}

async function updateTaskResult(
  supabase: SupabaseClient,
  taskId: string,
  dbStatus: string,
  resultJson: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("pierre_tasks")
    .update({
      status: dbStatus,
      result_json: resultJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
}

async function insertLog(
  supabase: SupabaseClient,
  params: {
    task_id: string;
    mission_id: string | null;
    user_id: string;
    event_type: string;
    message: string;
    meta_json?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("pierre_task_logs").insert({
    task_id: params.task_id,
    mission_id: params.mission_id,
    user_id: params.user_id,
    agent_slug: "pierre",
    event_type: params.event_type,
    message: params.message,
    meta_json: params.meta_json ?? {},
  });
}

async function persistDocumentArtifact(
  supabase: SupabaseClient,
  params: {
    user_id: string;
    task_id: string;
    mission_id: string | null;
    title: string;
    doc_type: string;
    text_content: string;
    html_content: string;
    source_kind: string;
    tags_json: string[];
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pierre_documents")
    .insert({
      user_id: params.user_id,
      agent_slug: "pierre",
      mission_id: params.mission_id,
      task_id: params.task_id,
      doc_type: params.doc_type,
      title: params.title,
      text_content: params.text_content,
      html_content: params.html_content,
      pdf_url: null,
      source_kind: params.source_kind,
      tags_json: params.tags_json,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return asString((data as DbRow).id);
}

async function persistEmailArtifact(
  supabase: SupabaseClient,
  params: {
    user_id: string;
    task_id: string;
    mission_id: string | null;
    to_json: string[];
    cc_json: string[];
    bcc_json: string[];
    subject: string;
    text_snapshot: string;
    html_snapshot: string;
    status: "draft" | "queued";
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pierre_outbound_emails")
    .insert({
      user_id: params.user_id,
      agent_slug: "pierre",
      mission_id: params.mission_id,
      task_id: params.task_id,
      to_json: params.to_json,
      cc_json: params.cc_json,
      bcc_json: params.bcc_json,
      subject: params.subject,
      text_snapshot: params.text_snapshot,
      html_snapshot: params.html_snapshot,
      sender_profile_json: { source: "pierre" },
      status: params.status,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return asString((data as DbRow).id);
}

// ── Status mapping ─────────────────────────────────────────────────────────

function outcomeToDbStatus(
  executorOutcome: Awaited<ReturnType<typeof executePierreTask>>,
): string {
  if (executorOutcome.ok) return "done";
  switch (executorOutcome.status) {
    case "awaiting_approval":
      return "awaiting_approval";
    case "awaiting_info":
      return "blocked";
    case "blocked":
      return "blocked";
    default:
      return "error";
  }
}

function outcomeToLabel(
  executorOutcome: Awaited<ReturnType<typeof executePierreTask>>,
): PierreExecutionPersistenceResult["outcome"] {
  if (executorOutcome.ok) return "completed";
  switch (executorOutcome.status) {
    case "awaiting_approval":
      return "awaiting_approval";
    case "awaiting_info":
      return "awaiting_info";
    case "blocked":
      return "blocked";
    default:
      return "failed";
  }
}

// ── Main export ────────────────────────────────────────────────────────────

export async function executePierreTaskWithPersistence(params: {
  supabaseAdmin: SupabaseClient;
  taskId: string;
  userId: string;
}): Promise<PierreExecutionPersistenceResult> {
  const { supabaseAdmin, taskId, userId } = params;
  const now = new Date();

  // 1. Load task
  const taskRow = await loadTask(supabaseAdmin, taskId, userId);
  const currentStatus = asString(taskRow.status) ?? "unknown";
  const missionId = asString(taskRow.mission_id);
  const payloadJson = isObject(taskRow.payload_json) ? taskRow.payload_json : {};

  // 2. Guard: reject non-executable states
  if (NON_EXECUTABLE_STATUSES.has(currentStatus)) {
    return {
      ok: false,
      task_id: taskId,
      mission_id: missionId,
      outcome: currentStatus === "awaiting_approval" ? "awaiting_approval" : "blocked",
      artifact: null,
      execution_result: buildPierreTaskExecutionResult({
        task: {
          id: taskId,
          type: asString(taskRow.type),
          title: asString(taskRow.title),
          payload_json: payloadJson,
          mission_id: missionId,
        },
        now,
      }),
      error: `La tâche ne peut pas être exécutée depuis le statut "${currentStatus}".`,
      error_code: "TASK_NOT_EXECUTABLE",
    };
  }

  // 3. Load company memory (for tone/language in artifact builders)
  const companyMemory = await loadCompanyMemory(supabaseAdmin, userId);

  // 4. Resolve employee context from payload_json
  const employeeContext = isObject(payloadJson.employee_context)
    ? payloadJson.employee_context
    : null;
  const employee = employeeContext
    ? {
        id: asString(employeeContext.employee_id),
        name: asString(employeeContext.employee_name) || asString(employeeContext.name),
        role: asString(employeeContext.employee_role) || asString(employeeContext.role),
        email: asString(employeeContext.employee_email) || asString(employeeContext.email),
        department:
          asString(employeeContext.employee_department) ||
          asString(employeeContext.department),
      }
    : payloadJson.employee_id
      ? {
          id: asString(payloadJson.employee_id),
          name: asString(payloadJson.employee_name),
          role: null,
          email: null,
          department: null,
        }
      : null;

  // 5. CloneGuard gate — blocks absolute refusals and hard blocks before execution
  const cgEval = evaluatePierreCloneGuard({
    task_type: asString(taskRow.type),
    task_title: asString(taskRow.title),
    payload_json: isObject(payloadJson) ? payloadJson : null,
    approval_required:
      taskRow.approval_required === true || taskRow.approval_required === "true",
    now: now.toISOString(),
  });

  if (cgEval.decision === "refuse" || cgEval.decision === "block") {
    const cgAudit = buildCloneGuardAuditEvent(cgEval, {
      task_type: asString(taskRow.type),
      now: now.toISOString(),
    });
    await insertLog(supabaseAdmin, {
      task_id: taskId,
      mission_id: missionId,
      user_id: userId,
      event_type: cgAudit.event_type,
      message: cgAudit.message,
      meta_json: cgAudit.meta_json as Record<string, unknown>,
    });
    return {
      ok: false,
      task_id: taskId,
      mission_id: missionId,
      outcome: "blocked",
      artifact: null,
      execution_result: buildPierreTaskExecutionResult({
        task: {
          id: taskId,
          type: asString(taskRow.type),
          title: asString(taskRow.title),
          payload_json: payloadJson,
          mission_id: missionId,
        },
        now,
      }),
      error: cgEval.explanation,
      error_code: "CLONEGUARD_BLOCKED",
    };
  }

  // 5.5. Governance gate — CloneGuard + ClonePolicy + CloneTrust combined
  const govEval = evaluateGovernance({
    task_type: asString(taskRow.type),
    task_title: asString(taskRow.title),
    payload_json: isObject(payloadJson) ? payloadJson : null,
    approval_required:
      taskRow.approval_required === true || taskRow.approval_required === "true",
    guard_evaluation: cgEval,
    now: now.toISOString(),
  });

  if (govEval.decision === "refuse" || govEval.decision === "block") {
    const govAudit = buildGovernanceAuditEvent(govEval, {
      task_type: asString(taskRow.type),
      mission_id: missionId,
      now: now.toISOString(),
    });
    await insertLog(supabaseAdmin, {
      task_id: taskId,
      mission_id: missionId,
      user_id: userId,
      event_type: govAudit.event_type,
      message: govAudit.message,
      meta_json: govAudit.meta_json as Record<string, unknown>,
    });
    return {
      ok: false,
      task_id: taskId,
      mission_id: missionId,
      outcome: "blocked",
      artifact: null,
      execution_result: buildPierreTaskExecutionResult({
        task: {
          id: taskId,
          type: asString(taskRow.type),
          title: asString(taskRow.title),
          payload_json: payloadJson,
          mission_id: missionId,
        },
        now,
      }),
      error: govEval.explanation,
      error_code: "GOVERNANCE_BLOCKED",
    };
  }

  // 5.6. Human approval gate — require_approval and supervised decisions must never auto-execute
  if (!govEval.allowed_to_auto_execute) {
    const humanRow = buildHumanRequiredLogRow({
      user_id: userId,
      mission_id: missionId,
      task_id: taskId,
      task_type: asString(taskRow.type),
      reason: govEval.explanation || "Approbation humaine requise.",
      governance_decision: govEval.decision,
      risk_level: govEval.risk_level,
    });
    await insertLog(supabaseAdmin, {
      task_id: taskId,
      mission_id: missionId,
      user_id: userId,
      event_type: humanRow.event_type,
      message: humanRow.message,
      meta_json: humanRow.meta_json,
    });
    return {
      ok: false,
      task_id: taskId,
      mission_id: missionId,
      outcome: "awaiting_approval",
      artifact: null,
      execution_result: buildPierreTaskExecutionResult({
        task: {
          id: taskId,
          type: asString(taskRow.type),
          title: asString(taskRow.title),
          payload_json: payloadJson,
          mission_id: missionId,
        },
        now,
      }),
      error: govEval.explanation,
      error_code: "HUMAN_APPROVAL_REQUIRED",
    };
  }

  // 6. Set task to "running" in DB
  await setTaskRunning(supabaseAdmin, taskId);

  // 7. Log execution start
  await insertLog(supabaseAdmin, {
    task_id: taskId,
    mission_id: missionId,
    user_id: userId,
    event_type: "task_execution_started",
    message: `Exécution démarrée pour la tâche "${asString(taskRow.title) || taskId}".`,
    meta_json: {
      task_type: asString(taskRow.type),
      previous_status: currentStatus,
      has_employee_context: employee !== null,
    },
  });

  // 8. Build executor task — maps payload_json → payload (required by executors.ts)
  const executorTask: PierreExecutorTask = {
    id: taskId,
    type: asString(taskRow.type),
    title: asString(taskRow.title),
    status: "running",
    mission_id: missionId,
    payload: payloadJson,
    scheduled_for: asString(taskRow.execute_at),
  };

  // 9. Execute (pure — HR gate + routing)
  const executorOutcome = await executePierreTask(executorTask, { now });

  // 10. Build rich artifact result (always computed, regardless of executor outcome)
  const executionInput: PierreTaskExecutionInput = {
    task: {
      id: taskId,
      type: asString(taskRow.type),
      title: asString(taskRow.title),
      payload_json: payloadJson,
      mission_id: missionId,
      scheduled_for: asString(taskRow.execute_at),
    },
    employee,
    company_memory: companyMemory as Record<string, unknown> | null,
    now,
  };

  const executionResult = buildPierreTaskExecutionResult(executionInput);

  // 11. Persist artifact when execution succeeded or produces a storable artifact
  let documentId: string | null = null;
  let emailId: string | null = null;

  const shouldPersist =
    executorOutcome.ok ||
    executionResult.artifact?.kind === "missing_info" ||
    executionResult.artifact?.kind === "followup";

  if (shouldPersist && executionResult.artifact) {
    const artifact = executionResult.artifact;

    if (artifact.kind === "email_draft" || artifact.kind === "email_send") {
      emailId = await persistEmailArtifact(supabaseAdmin, {
        user_id: userId,
        task_id: taskId,
        mission_id: missionId,
        to_json: artifact.to_json,
        cc_json: artifact.cc_json,
        bcc_json: artifact.bcc_json,
        subject: artifact.subject ?? artifact.title,
        text_snapshot: artifact.content_text,
        html_snapshot: artifact.content_html,
        status: artifact.kind === "email_send" ? "queued" : "draft",
      });
    } else {
      documentId = await persistDocumentArtifact(supabaseAdmin, {
        user_id: userId,
        task_id: taskId,
        mission_id: missionId,
        title: artifact.title,
        doc_type: artifact.doc_type,
        text_content: artifact.content_text,
        html_content: artifact.content_html,
        source_kind: "task_execution",
        tags_json: artifact.tags,
      });
    }
  }

  // 12. Determine final DB status and build result_json
  const dbStatus = outcomeToDbStatus(executorOutcome);
  const outcomeLabel = outcomeToLabel(executorOutcome);

  const fileSnap = isObject(payloadJson.employee_file_snapshot)
    ? payloadJson.employee_file_snapshot
    : null;

  const resultJson: Record<string, unknown> = {
    outcome: outcomeLabel,
    executor_ok: executorOutcome.ok,
    artifact_kind: executionResult.artifact_kind,
    artifact_status: executionResult.artifact_status,
    quality_score: executionResult.quality.score,
    document_id: documentId,
    email_id: emailId,
    generated_at: now.toISOString(),
    employee_id: asString(payloadJson.employee_id) || asString(employee?.id) || null,
    employee_name: asString(payloadJson.employee_name) || asString(employee?.name) || null,
    employee_action_type: asString(payloadJson.action_type),
    employee_action_domain: asString(payloadJson.action_domain),
    employee_action_governance: (() => {
      const at = asString(payloadJson.action_type);
      if (!at) return null;
      try { return resolveEmployeeActionGovernance(at); } catch { return null; }
    })(),
    employee_action_risk: (() => {
      const at = asString(payloadJson.action_type);
      if (!at) return null;
      try { return classifyEmployeeActionRisk(at); } catch { return null; }
    })(),
    ...(fileSnap
      ? {
          employee_file_health_score:
            typeof fileSnap.health_score === "number" ? fileSnap.health_score : null,
          employee_file_risk_level:
            typeof fileSnap.risk_level === "string" ? fileSnap.risk_level : null,
        }
      : {}),
    ...(executorOutcome.ok
      ? {}
      : {
          error_code: executorOutcome.error_code,
          error_message: executorOutcome.message,
        }),
  };

  // 13. Update task with final status and result_json
  await updateTaskResult(supabaseAdmin, taskId, dbStatus, resultJson);

  // 14. Log result
  await insertLog(supabaseAdmin, {
    task_id: taskId,
    mission_id: missionId,
    user_id: userId,
    event_type: executorOutcome.ok
      ? "task_execution_completed"
      : "task_execution_failed",
    message: executorOutcome.ok
      ? `Tâche exécutée avec succès. Artefact : ${executionResult.artifact_kind ?? "aucun"}.`
      : `Échec d'exécution : ${executorOutcome.message}`,
    meta_json: {
      outcome: outcomeLabel,
      artifact_kind: executionResult.artifact_kind,
      quality_score: executionResult.quality.score,
      document_id: documentId,
      email_id: emailId,
      ...(executorOutcome.ok
        ? {}
        : { error_code: executorOutcome.error_code }),
    },
  });

  return {
    ok: executorOutcome.ok,
    task_id: taskId,
    mission_id: missionId,
    outcome: outcomeLabel,
    artifact:
      executionResult.artifact_kind !== null
        ? {
            kind: executionResult.artifact_kind,
            status: executionResult.artifact_status,
            document_id: documentId,
            email_id: emailId,
          }
        : null,
    execution_result: executionResult,
    ...(!executorOutcome.ok && {
      error: executorOutcome.message,
      error_code: executorOutcome.error_code,
    }),
  };
}
