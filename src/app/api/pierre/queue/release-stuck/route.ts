import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceRole) {
    throw new Error("Supabase admin env is missing.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(_request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const thresholdDate = new Date(Date.now() - 1000 * 60 * 15).toISOString();

    const { data: stuckTasks, error: selectError } = await supabase
      .from("pierre_tasks")
      .select("*")
      .eq("status", "running")
      .lt("started_at", thresholdDate);

    if (selectError) throw selectError;

    const tasks = Array.isArray(stuckTasks) ? stuckTasks : [];

    if (tasks.length === 0) {
      return json({
        ok: true,
        released: 0,
        task_ids: [],
      });
    }

    const taskIds = tasks.map((task) => task.id).filter(Boolean);

    const { error: updateError } = await supabase
      .from("pierre_tasks")
      .update({
        status: "retry",
      })
      .in("id", taskIds);

    if (updateError) throw updateError;

    const logRows = tasks.map((task) => ({
      task_id: task.id,
      mission_id: task.mission_id ?? null,
      level: "warning",
      event: "task_released_stuck",
      message: "Tâche relâchée automatiquement après blocage prolongé.",
      metadata: {
        previous_status: task.status ?? null,
        next_status: "retry",
        started_at: task.started_at ?? null,
      },
    }));

    const { error: logsError } = await supabase.from("pierre_task_logs").insert(logRows);
    if (logsError) throw logsError;

    return json({
      ok: true,
      released: taskIds.length,
      task_ids: taskIds,
    });
  } catch (error) {
    console.error("[pierre/queue/release-stuck][POST]", error);

    return json(
      {
        ok: false,
        error: "Impossible de relâcher les tâches bloquées Pierre.",
      },
      500
    );
  }
}