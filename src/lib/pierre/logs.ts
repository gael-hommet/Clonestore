import type { SupabaseClient } from "@supabase/supabase-js";
import type { PierreTaskLogInsert } from "@/lib/pierre/types";

// ══════════════════════════════════════════════════════════
// PURE LOG ROW BUILDERS — no Supabase, no async, no side effects
// ══════════════════════════════════════════════════════════

export type PierreLogRow = {
  user_id: string;
  agent_slug: "pierre";
  mission_id?: string | null;
  task_id?: string | null;
  event_type: string;
  message: string;
  meta_json: Record<string, unknown>;
};

export function buildPierreAuditLogRow(params: {
  user_id: string;
  mission_id?: string | null;
  task_id?: string | null;
  event_type: string;
  message: string;
  meta?: Record<string, unknown>;
}): PierreLogRow {
  return {
    user_id: params.user_id,
    agent_slug: "pierre",
    mission_id: params.mission_id ?? null,
    task_id: params.task_id ?? null,
    event_type: params.event_type,
    message: params.message,
    meta_json: params.meta ?? {},
  };
}

export function buildGovernanceAuditLogRow(params: {
  user_id: string;
  mission_id?: string | null;
  task_id?: string | null;
  task_type?: string | null;
  governance_decision: string;
  guard_decision?: string | null;
  policy_decision?: string | null;
  trust_decision?: string | null;
  risk_level?: string | null;
  allowed_to_auto_execute?: boolean;
  explanation?: string | null;
}): PierreLogRow {
  const isBlocked =
    params.governance_decision === "block" || params.governance_decision === "refuse";
  const event_type = isBlocked ? "governance_execution_blocked" : "governance_evaluation";
  const message = isBlocked
    ? `Gouvernance: exécution bloquée (${params.governance_decision}). ${params.explanation ?? ""}`.trim()
    : `Gouvernance évaluée: ${params.governance_decision}.`;

  return {
    user_id: params.user_id,
    agent_slug: "pierre",
    mission_id: params.mission_id ?? null,
    task_id: params.task_id ?? null,
    event_type,
    message,
    meta_json: {
      governance_decision: params.governance_decision,
      guard_decision: params.guard_decision ?? null,
      policy_decision: params.policy_decision ?? null,
      trust_decision: params.trust_decision ?? null,
      risk_level: params.risk_level ?? null,
      allowed_to_auto_execute: params.allowed_to_auto_execute ?? false,
      task_type: params.task_type ?? null,
    },
  };
}

export function buildExecutionAuditLogRow(params: {
  user_id: string;
  mission_id?: string | null;
  task_id: string;
  task_type?: string | null;
  task_title?: string | null;
  outcome: "completed" | "failed" | "blocked" | "awaiting_approval" | "awaiting_info";
  artifact_kind?: string | null;
  quality_score?: number | null;
  document_id?: string | null;
  email_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}): PierreLogRow {
  const ok = params.outcome === "completed";
  const event_type = ok ? "task_execution_completed" : "task_execution_failed";
  const message = ok
    ? `Tâche exécutée : ${params.task_title ?? params.task_id}. Artefact : ${params.artifact_kind ?? "aucun"}.`
    : `Échec tâche : ${params.task_title ?? params.task_id}. ${params.error_message ?? ""}`.trim();

  return {
    user_id: params.user_id,
    agent_slug: "pierre",
    mission_id: params.mission_id ?? null,
    task_id: params.task_id,
    event_type,
    message,
    meta_json: {
      outcome: params.outcome,
      task_type: params.task_type ?? null,
      artifact_kind: params.artifact_kind ?? null,
      quality_score: params.quality_score ?? null,
      document_id: params.document_id ?? null,
      email_id: params.email_id ?? null,
      ...(ok ? {} : {
        error_code: params.error_code ?? null,
        error_message: params.error_message ?? null,
      }),
    },
  };
}

export function buildHumanRequiredLogRow(params: {
  user_id: string;
  mission_id?: string | null;
  task_id?: string | null;
  task_type?: string | null;
  reason: string;
  governance_decision?: string | null;
  risk_level?: string | null;
}): PierreLogRow {
  return {
    user_id: params.user_id,
    agent_slug: "pierre",
    mission_id: params.mission_id ?? null,
    task_id: params.task_id ?? null,
    event_type: "human_action_required",
    message: `Action humaine requise : ${params.reason}`,
    meta_json: {
      reason: params.reason,
      task_type: params.task_type ?? null,
      governance_decision: params.governance_decision ?? null,
      risk_level: params.risk_level ?? null,
      requires_human: true,
    },
  };
}

export async function insertPierreLogs(
  supabase: SupabaseClient,
  rows: PierreTaskLogInsert[]
) {
  if (!rows.length) return;

  const { error } = await supabase.from("pierre_task_logs").insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertPierreMissionCreatedLog(
  supabase: SupabaseClient,
  input: {
    missionId: string;
    userId: string;
    source: string;
    understandingStatus: string;
    riskLevel: string;
    approvalRequired: boolean;
  }
) {
  await insertPierreLogs(supabase, [
    {
      mission_id: input.missionId,
      task_id: null,
      user_id: input.userId,
      agent_slug: "pierre",
      event_type: "mission_created",
      message: "Mission Pierre créée.",
      meta_json: {
        source: input.source,
        understanding_status: input.understandingStatus,
        risk_level: input.riskLevel,
        approval_required: input.approvalRequired,
      },
    },
  ]);
}

export async function insertPierreTaskCreatedLogs(
  supabase: SupabaseClient,
  input: {
    missionId: string;
    userId: string;
    tasks: Array<{
      id: string;
      type: string;
      title: string;
      status: string;
      approval_required?: boolean;
      execute_at?: string | null;
    }>;
  }
) {
  if (!input.tasks.length) return;

  await insertPierreLogs(
    supabase,
    input.tasks.map((task) => ({
      mission_id: input.missionId,
      task_id: task.id,
      user_id: input.userId,
      agent_slug: "pierre",
      event_type: "task_created",
      message: `Task créée : ${task.title}`,
      meta_json: {
        type: task.type,
        status: task.status,
        approval_required: Boolean(task.approval_required),
        execute_at: task.execute_at || null,
      },
    }))
  );
}

export async function insertPierreTaskStatusLog(
  supabase: SupabaseClient,
  input: {
    missionId: string | null;
    taskId: string;
    userId: string;
    eventType: string;
    message: string;
    meta?: Record<string, unknown>;
  }
) {
  await insertPierreLogs(supabase, [
    {
      mission_id: input.missionId,
      task_id: input.taskId,
      user_id: input.userId,
      agent_slug: "pierre",
      event_type: input.eventType,
      message: input.message,
      meta_json: input.meta || {},
    },
  ]);
}