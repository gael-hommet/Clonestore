import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionControlActionFromTask,
  buildMissionControlRunPlan,
  buildMissionControlScaleProfile,
  buildMissionControlDataWindow,
  sortMissionControlActions,
  isMissionControlSafeToRun,
} from "../../../../../../lib/pierre/hr/mission-control";
import {
  evaluatePierreCloneGuard,
  isCloneGuardAutoExecutable,
  applyCloneGuardToTask,
} from "../../../../../../lib/pierre/hr/cloneguard";
import {
  isGovernanceAutoExecutable,
} from "../../../../../../lib/pierre/hr/governance";
import {
  executePierreTaskWithPersistence,
  type PierreExecutionPersistenceResult,
} from "../../../../../../lib/pierre/tasks/execute-task";
import {
  buildExecutionAuditLogRow,
} from "../../../../../../lib/pierre/logs";

const HARD_MAX_TASKS = 10;
const BLOCKED_TASK_TYPES = new Set(["email.send", "send_email"]);

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };
type RunResult = { task_id: string; outcome: string; ok: boolean; error?: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}
function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}
function mapDbError(error: unknown) {
  if (isObject(error)) return { message: asString(error.message) || "Unexpected database error.", code: asString(error.code) };
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured.");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function tryReadBearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  for (const key of ["sb-access-token", "supabase-access-token", "access-token"]) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.includes("auth-token")) continue;
    const raw = cookie.value;
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const c = parsed.find((i): i is string => typeof i === "string" && i.split(".").length === 3);
        if (c) return c;
      }
      if (isObject(parsed)) {
        const cs = isObject(parsed.currentSession) ? parsed.currentSession : null;
        const c = asString(parsed.access_token) || (cs ? asString(cs.access_token) : null);
        if (c) return c;
      }
    } catch { if (raw.split(".").length === 3) return raw; }
  }
  return null;
}

async function authenticateRequest(request: NextRequest, supabaseAdmin: SupabaseClient): Promise<string> {
  const token = tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
  if (!token) throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  return data.user.id;
}

async function hasPierreAccess(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin.from("orders").select("id").eq("user_id", userId).eq("agent_slug", "pierre").eq("status", "active").limit(1).maybeSingle();
    return Boolean(data);
  } catch { return false; }
}

async function tryInsertLog(
  supabaseAdmin: SupabaseClient,
  payload: { user_id: string; event_type: string; message: string; meta_json?: Record<string, unknown> },
): Promise<void> {
  try {
    await supabaseAdmin.from("pierre_task_logs").insert({
      user_id: payload.user_id,
      agent_slug: "pierre",
      event_type: payload.event_type,
      message: payload.message,
      meta_json: payload.meta_json ?? null,
    });
  } catch (_e) { /* skip malformed row */ }
}

// ── POST /api/pierre/use/mission-control/run-safe ─────────

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    let body: Record<string, unknown> = {};
    try { const raw = await request.json(); if (isObject(raw)) body = raw; } catch { /* empty body ok */ }

    const rawMax = typeof body.max === "number" ? body.max : parseInt(String(body.max ?? "5"), 10);
    const maxTasks = Number.isFinite(rawMax) ? Math.min(Math.max(rawMax, 1), HARD_MAX_TASKS) : 5;

    const dataWindow = buildMissionControlDataWindow();
    const scaleProfile = buildMissionControlScaleProfile();
    const now = new Date();

    const { data, error } = await supabaseAdmin.from("pierre_tasks")
      .select("id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, brain_output_json, created_at, updated_at")
      .eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(dataWindow.tasks_limit);
    if (error) throw { status: 500, message: "Unable to load tasks.", code: "TASKS_FETCH_FAILED", details: error };
    const tasks = Array.isArray(data) ? (data as DbRow[]) : [];

    const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
    const actions = tasks
      .filter(isObject)
      .filter((t) => !TERMINAL_STATUSES.has(asString(t.status)?.toLowerCase() ?? ""))
      .map((t) => {
        try { return buildMissionControlActionFromTask(t, now); }
        catch (_e) { /* skip malformed row */ return null; }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const sortedActions = sortMissionControlActions(actions);
    const runPlan = buildMissionControlRunPlan(sortedActions, maxTasks, false);

    // CloneGuard summary over all actions (before execution)
    let cgBlockedCount = 0;
    let govBlockedCount = 0;
    const cgEnrichedActions = sortedActions.map((a) => {
      const taskRow = tasks.find((t) => asString(t.id) === a.task_id);
      if (!taskRow) return applyCloneGuardToTask(a as Record<string, unknown>, {
        decision: "allow", risk_level: "green", signals: [], matched_rules: [],
        allowed_to_auto_execute: true, requires_human: false,
        explanation: "Tâche non trouvée.", human_note: "", evaluated_at: now.toISOString(),
      });
      const cgEval = evaluatePierreCloneGuard({
        task_type: asString(taskRow.type),
        task_title: asString(taskRow.title),
        approval_required: taskRow.approval_required === true || taskRow.approval_required === "true",
        now: now.toISOString(),
      });
      if (cgEval.decision === "refuse" || cgEval.decision === "block") cgBlockedCount++;
      return applyCloneGuardToTask(a as Record<string, unknown>, cgEval);
    });

    if (runPlan.safe_task_ids.length === 0) {
      return NextResponse.json({
        ok: true,
        ran: [],
        errors: [],
        skipped: [],
        run_plan: runPlan,
        cloneguard_summary: { evaluated: cgEnrichedActions.length, blocked: cgBlockedCount },
        governance_summary: { blocked: govBlockedCount },
        summary: "Aucune tâche sûre à exécuter.",
        meta: {
          canonical_route: "/api/pierre/use/mission-control/run-safe",
          compatibility_route: "/api/pierre/use/dashboard/execute-safe",
          userId,
          fetchedAt: now.toISOString(),
          tasks_loaded: tasks.length,
          max_tasks: maxTasks,
          hard_max_tasks: HARD_MAX_TASKS,
          safety_gate: "mission_control_safe_execution",
          ran_count: 0,
          error_count: 0,
          skipped_count: 0,
        },
      });
    }

    await tryInsertLog(supabaseAdmin, {
      user_id: userId,
      event_type: "mission_control_run_safe_started",
      message: `Exécution sûre démarrée — ${runPlan.safe_task_ids.length} tâche(s) planifiée(s)`,
      meta_json: { safe_task_ids: runPlan.safe_task_ids, max_requested: maxTasks, actions_evaluated: actions.length },
    });

    const ran: RunResult[] = [];
    const errors: RunResult[] = [];
    const skipped: Array<{ task_id: string; reason: string }> = [];

    for (const action of runPlan.safe_actions) {
      const taskId = action.task_id;
      if (!taskId) { skipped.push({ task_id: "unknown", reason: "Missing task_id on action" }); continue; }

      // Final safety gate — re-verify at execution time
      const taskRow = tasks.find((t) => asString(t.id) === taskId);
      if (!taskRow) { skipped.push({ task_id: taskId, reason: "Tâche introuvable au moment de l'exécution" }); continue; }

      // Hard type block — absolute gate
      const taskType = asString(taskRow.type)?.toLowerCase() ?? "";
      if (BLOCKED_TASK_TYPES.has(taskType)) {
        skipped.push({ task_id: taskId, reason: `Type bloqué : ${taskType}` });
        continue;
      }

      // CloneGuard gate — evaluates task for black/red signals before execution
      const cgAutoExec = isCloneGuardAutoExecutable({
        task_type: asString(taskRow.type),
        task_title: asString(taskRow.title),
        approval_required: taskRow.approval_required === true || taskRow.approval_required === "true",
      });
      if (!cgAutoExec) {
        const cgEval = evaluatePierreCloneGuard({
          task_type: asString(taskRow.type),
          task_title: asString(taskRow.title),
          approval_required: taskRow.approval_required === true || taskRow.approval_required === "true",
          now: now.toISOString(),
        });
        skipped.push({ task_id: taskId, reason: `CloneGuard : ${cgEval.explanation}` });
        continue;
      }

      // Governance gate — combines CloneGuard + ClonePolicy + CloneTrust
      const govAutoExec = isGovernanceAutoExecutable({
        task_type: asString(taskRow.type),
        task_title: asString(taskRow.title),
        approval_required: taskRow.approval_required === true || taskRow.approval_required === "true",
        now: now.toISOString(),
      });
      if (!govAutoExec) {
        govBlockedCount++;
        skipped.push({ task_id: taskId, reason: "Gouvernance : auto-exécution non autorisée" });
        continue;
      }

      if (!isMissionControlSafeToRun(taskRow, now)) {
        skipped.push({ task_id: taskId, reason: "Tâche non sûre au moment de l'exécution" });
        continue;
      }

      try {
        const result: PierreExecutionPersistenceResult = await executePierreTaskWithPersistence({ supabaseAdmin, taskId, userId });
        const missionId = asString(taskRow.mission_id);
        if (result.ok) {
          ran.push({ task_id: taskId, outcome: result.outcome, ok: true });
          void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert(
            buildExecutionAuditLogRow({ user_id: userId, mission_id: missionId, task_id: taskId, task_type: asString(taskRow.type), task_title: asString(taskRow.title), outcome: "completed" }),
          )).catch(() => {});
        } else {
          errors.push({ task_id: taskId, outcome: result.outcome, ok: false, error: result.error ?? "Execution failed" });
          void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert(
            buildExecutionAuditLogRow({ user_id: userId, mission_id: missionId, task_id: taskId, task_type: asString(taskRow.type), task_title: asString(taskRow.title), outcome: "failed", error_message: result.error ?? undefined }),
          )).catch(() => {});
        }
      } catch (execError) {
        const msg = execError instanceof Error ? execError.message
          : isObject(execError) ? (asString(execError.message) ?? "Unknown error")
          : "Unknown execution error";
        errors.push({ task_id: taskId, outcome: "failed", ok: false, error: msg });
        void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert(
          buildExecutionAuditLogRow({ user_id: userId, mission_id: asString(taskRow.mission_id), task_id: taskId, task_type: asString(taskRow.type), task_title: asString(taskRow.title), outcome: "failed", error_message: msg }),
        )).catch(() => {});
      }
    }

    await tryInsertLog(supabaseAdmin, {
      user_id: userId,
      event_type: "mission_control_run_safe_completed",
      message: `Exécution sûre terminée — ${ran.length} réussi(es), ${errors.length} échec(s), ${skipped.length} ignoré(es)`,
      meta_json: {
        ran_task_ids: ran.map((r) => r.task_id),
        error_task_ids: errors.map((e) => e.task_id),
        skipped_task_ids: skipped.map((s) => s.task_id),
        ran_count: ran.length, error_count: errors.length, skipped_count: skipped.length,
      },
    });

    const total = ran.length + errors.length + skipped.length;
    const summary = ran.length > 0
      ? `${ran.length}/${total} tâche(s) exécutée(s) avec succès. ${errors.length} erreur(s). ${skipped.length} ignorée(s).`
      : `Aucune tâche exécutée avec succès. ${errors.length} erreur(s). ${skipped.length} ignorée(s).`;

    return NextResponse.json({
      ok: true,
      ran,
      errors,
      skipped,
      run_plan: runPlan,
      scale_profile: scaleProfile,
      cloneguard_summary: { evaluated: cgEnrichedActions.length, blocked: cgBlockedCount },
      summary,
      meta: {
        canonical_route: "/api/pierre/use/mission-control/run-safe",
        compatibility_route: "/api/pierre/use/dashboard/execute-safe",
        userId,
        fetchedAt: now.toISOString(),
        tasks_loaded: tasks.length,
        max_tasks: maxTasks,
        hard_max_tasks: HARD_MAX_TASKS,
        safety_gate: "mission_control_safe_execution",
        ran_count: ran.length,
        error_count: errors.length,
        skipped_count: skipped.length,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code),
        details: isObject(error.details) ? error.details : null,
      });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
