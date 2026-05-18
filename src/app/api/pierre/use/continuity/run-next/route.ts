import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { selectNextRunnableTasks } from "../../../../../../lib/pierre/hr/continuity";
import {
  executePierreTaskWithPersistence,
  type PierreExecutionPersistenceResult,
} from "../../../../../../lib/pierre/tasks/execute-task";
import {
  evaluatePierreCloneGuard,
} from "../../../../../../lib/pierre/hr/cloneguard";
import {
  evaluateGovernance,
} from "../../../../../../lib/pierre/hr/governance";
import {
  buildExecutionAuditLogRow,
} from "../../../../../../lib/pierre/logs";

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const DEFAULT_MAX_TASKS = 5;
const HARD_MAX_TASKS = 10;
const SEND_TASK_TYPES = new Set(["email.send", "send_email"]);

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

type RunResult = {
  task_id: string;
  outcome: string;
  ok: boolean;
  error?: string;
};

type SkippedTask = {
  task_id: string;
  reason: string;
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

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

function asInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message: asString(error.message) || "Unexpected database error.",
      code: asString(error.code),
    };
  }
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

function classifySkipReason(task: DbRow, now: Date): string {
  const taskType = asString(task.type) ?? "";
  if (SEND_TASK_TYPES.has(taskType)) {
    return "Envoi d'email — déclenchement manuel requis";
  }

  const approvalRequired = task.approval_required === true || task.approval_required === 1;
  if (approvalRequired) {
    return "Approbation humaine requise";
  }

  const executeAt = asString(task.execute_at);
  if (executeAt) {
    const due = new Date(executeAt);
    if (!isNaN(due.getTime()) && due.getTime() > now.getTime()) {
      return "Planifiée pour une date future — exécution différée";
    }
  }

  return "Limite de tâches atteinte pour cette exécution";
}

// ═══════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

function tryReadBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
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
        const candidate = parsed.find(
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
        );
        if (candidate) return candidate;
      }
      if (isObject(parsed)) {
        const currentSession = isObject(parsed.currentSession)
          ? parsed.currentSession
          : null;
        const candidate =
          asString(parsed.access_token) ||
          (currentSession ? asString(currentSession.access_token) : null);
        if (candidate) return candidate;
      }
    } catch {
      if (raw.split(".").length === 3) return raw;
    }
  }

  return null;
}

async function authenticateRequest(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
): Promise<string> {
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw {
      status: 401,
      message: "Unable to authenticate request.",
      code: "AUTH_INVALID",
    };
  }

  return data.user.id;
}

async function hasPierreAccess(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════

async function fetchRunnableCandidates(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionId: string | null,
): Promise<DbRow[]> {
  let query = supabaseAdmin
    .from("pierre_tasks")
    .select(
      "id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .in("status", ["ready", "retry"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(100);

  if (missionId) {
    query = query.eq("mission_id", missionId);
  }

  const { data, error } = await query;

  if (error) {
    throw {
      status: 500,
      message: "Unable to load runnable tasks.",
      code: "TASKS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

// ═══════════════════════════════════════════════════════════
// LOG INSERTION (non-blocking)
// ═══════════════════════════════════════════════════════════

async function tryInsertLog(
  supabaseAdmin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    await supabaseAdmin.from("pierre_task_logs").insert(row);
  } catch {
    // Log insertion is non-blocking — never abort the response on log failure
  }
}

// ═══════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const bodyRaw = await request.json().catch(() => null);
    const missionId = isObject(bodyRaw) ? asString(bodyRaw.mission_id) : null;
    const maxRaw = isObject(bodyRaw) ? asInt(bodyRaw.max, DEFAULT_MAX_TASKS) : DEFAULT_MAX_TASKS;
    const max = Math.min(Math.max(1, maxRaw), HARD_MAX_TASKS);

    const now = new Date();
    const candidates = await fetchRunnableCandidates(supabaseAdmin, userId, missionId);
    const selected = selectNextRunnableTasks(candidates, { max, now });

    // Build enriched skipped list (candidates excluded from selection)
    const selectedIds = new Set(
      selected.map((t) => asString(t.id)).filter((id): id is string => id !== null),
    );
    const skipped: SkippedTask[] = candidates
      .filter((t) => {
        const tid = asString(t.id);
        return tid !== null && !selectedIds.has(tid);
      })
      .map((t) => ({
        task_id: asString(t.id) ?? "",
        reason: classifySkipReason(t, now),
      }));

    if (selected.length === 0) {
      return NextResponse.json({
        ok: true,
        ran: [],
        errors: [],
        skipped,
        meta: {
          userId,
          mission_id: missionId,
          candidates_found: candidates.length,
          selected_count: 0,
          cloneguard_evaluated_count: 0,
          cloneguard_blocked_count: 0,
          governance_blocked_count: 0,
          triggered_at: now.toISOString(),
        },
      });
    }

    const selectedTaskIds = selected.map((t) => asString(t.id)).filter(Boolean);

    // Emit log: run-next started (only when scoped to a mission)
    if (missionId) {
      await tryInsertLog(supabaseAdmin, {
        mission_id: missionId,
        user_id: userId,
        event_type: "continuity_run_next_started",
        message: `Exécution automatique démarrée — ${selected.length} tâche(s) sélectionnée(s)`,
        meta_json: {
          selected_task_ids: selectedTaskIds,
          max_requested: max,
          candidates_found: candidates.length,
        },
      });
    }

    const ran: RunResult[] = [];
    const errors: RunResult[] = [];
    let cgEvaluatedCount = 0;
    let cgBlockedCount = 0;
    let govBlockedCount = 0;

    for (const task of selected) {
      const taskId = asString(task.id);
      if (!taskId) continue;

      // CloneGuard gate — evaluate before execution
      const cgCtx = {
        task_type: asString(task.type),
        task_title: asString(task.title),
        approval_required: task.approval_required === true || task.approval_required === "true",
        text_corpus: [asString(task.title), asString(task.type), asString(task.last_error)].filter(Boolean).join(" "),
        now: now.toISOString(),
      };
      const cgEval = evaluatePierreCloneGuard(cgCtx);
      cgEvaluatedCount++;

      if (!cgEval.allowed_to_auto_execute) {
        cgBlockedCount++;
        const cgReason =
          cgEval.decision === "refuse"
            ? "CloneGuard: action refusée"
            : cgEval.decision === "block"
              ? "CloneGuard: action bloquée"
              : "CloneGuard: validation humaine requise";
        skipped.push({ task_id: taskId, reason: cgReason });
        await tryInsertLog(supabaseAdmin, {
          task_id: taskId,
          mission_id: asString(task.mission_id),
          user_id: userId,
          agent_slug: "pierre",
          event_type: "cloneguard_continuity_blocked",
          message: `CloneGuard a bloqué la tâche "${asString(task.title) ?? taskId}" — ${cgEval.explanation}`,
          meta_json: {
            task_id: taskId,
            mission_id: asString(task.mission_id),
            decision: cgEval.decision,
            risk_level: cgEval.risk_level,
            allowed_to_auto_execute: cgEval.allowed_to_auto_execute,
            signals: cgEval.signals,
            matched_rules: cgEval.matched_rules,
          },
        });
        continue;
      }

      // Governance pre-flight gate (passes cgEval to avoid re-running CloneGuard)
      const govEval = evaluateGovernance({
        task_type: asString(task.type),
        task_title: asString(task.title),
        approval_required: task.approval_required === true || task.approval_required === "true",
        guard_evaluation: cgEval,
        now: now.toISOString(),
      });

      if (govEval.decision === "refuse" || govEval.decision === "block") {
        govBlockedCount++;
        skipped.push({
          task_id: taskId,
          reason: `Gouvernance: ${govEval.decision} — ${govEval.explanation.slice(0, 80)}`,
        });
        await tryInsertLog(supabaseAdmin, {
          task_id: taskId,
          mission_id: asString(task.mission_id),
          user_id: userId,
          agent_slug: "pierre",
          event_type: "governance_continuity_blocked",
          message: `Gouvernance a bloqué la tâche "${asString(task.title) ?? taskId}" — ${govEval.explanation}`,
          meta_json: {
            task_id: taskId,
            mission_id: asString(task.mission_id),
            decision: govEval.decision,
            risk_level: govEval.risk_level,
            guard_decision: govEval.guard_decision,
            policy_decision: govEval.policy_decision,
            trust_decision: govEval.trust_decision,
            allowed_to_auto_execute: govEval.allowed_to_auto_execute,
          },
        });
        continue;
      }

      try {
        const result: PierreExecutionPersistenceResult =
          await executePierreTaskWithPersistence({
            supabaseAdmin,
            taskId,
            userId,
          });

        if (result.ok) {
          ran.push({ task_id: taskId, outcome: result.outcome, ok: true });
          void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert(
            buildExecutionAuditLogRow({ user_id: userId, mission_id: asString(task.mission_id), task_id: taskId, task_type: asString(task.type), task_title: asString(task.title), outcome: "completed" }),
          )).catch(() => {});
        } else {
          errors.push({
            task_id: taskId,
            outcome: result.outcome,
            ok: false,
            error: result.error ?? "Execution failed",
          });
          void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert(
            buildExecutionAuditLogRow({ user_id: userId, mission_id: asString(task.mission_id), task_id: taskId, task_type: asString(task.type), task_title: asString(task.title), outcome: "failed", error_message: result.error ?? undefined }),
          )).catch(() => {});
        }
      } catch (execError) {
        const msg =
          execError instanceof Error
            ? execError.message
            : isObject(execError)
              ? (asString(execError.message) ?? "Unknown error")
              : "Unknown execution error";

        errors.push({ task_id: taskId, outcome: "failed", ok: false, error: msg });
        void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert(
          buildExecutionAuditLogRow({ user_id: userId, mission_id: asString(task.mission_id), task_id: taskId, task_type: asString(task.type), task_title: asString(task.title), outcome: "failed", error_message: msg }),
        )).catch(() => {});
      }
    }

    // Emit log: run-next completed (only when scoped to a mission)
    if (missionId) {
      await tryInsertLog(supabaseAdmin, {
        mission_id: missionId,
        user_id: userId,
        event_type: "continuity_run_next_completed",
        message: `Exécution automatique terminée — ${ran.length} réussi(es), ${errors.length} échec(s)`,
        meta_json: {
          ran_task_ids: ran.map((r) => r.task_id),
          error_task_ids: errors.map((e) => e.task_id),
          ran_count: ran.length,
          error_count: errors.length,
          skipped_count: skipped.length,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      ran,
      errors,
      skipped,
      meta: {
        userId,
        mission_id: missionId,
        candidates_found: candidates.length,
        selected_count: selected.length,
        ran_count: ran.length,
        error_count: errors.length,
        skipped_count: skipped.length,
        cloneguard_evaluated_count: cgEvaluatedCount,
        cloneguard_blocked_count: cgBlockedCount,
        governance_blocked_count: govBlockedCount,
        triggered_at: now.toISOString(),
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status as number,
        {
          code: asString(error.code),
          details: isObject(error.details) ? error.details : null,
        },
      );
    }

    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
