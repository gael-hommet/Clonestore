import type { SupabaseClient } from "@supabase/supabase-js";
import type { PierreTaskLogInsert } from "@/lib/pierre/types";

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