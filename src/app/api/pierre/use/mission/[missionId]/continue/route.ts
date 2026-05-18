import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionContinuityInsight,
  buildContinuePlan,
  buildFollowupTaskDraftsForContinue,
} from "../../../../../../../lib/pierre/hr/continuity";
import {
  evaluatePierreCloneGuard,
  buildCloneGuardPreview,
  type PierreCloneGuardRiskLevel,
} from "../../../../../../../lib/pierre/hr/cloneguard";
import {
  evaluateGovernance,
  buildGovernancePreview,
} from "../../../../../../../lib/pierre/hr/governance";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

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

// ═══════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════

async function verifyMissionOwnership(
  supabaseAdmin: SupabaseClient,
  missionId: string,
  userId: string,
): Promise<DbRow> {
  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select(
      "id, status, understanding_status, risk_level, approval_required, mission_summary, missing_info_json, brain_output_json, created_at, updated_at",
    )
    .eq("id", missionId)
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission.",
      code: "MISSION_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  if (!data) {
    throw { status: 404, message: "Mission not found.", code: "MISSION_NOT_FOUND" };
  }

  return data as DbRow;
}

async function fetchMissionTasks(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select(
      "id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, created_at, updated_at",
    )
    .eq("mission_id", missionId)
    .order("priority", { ascending: false });

  if (error) {
    throw {
      status: 500,
      message: "Unable to load tasks.",
      code: "TASKS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function fetchMissionLogs(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data } = await supabaseAdmin
    .from("pierre_task_logs")
    .select("id, task_id, mission_id, event_type, message, created_at")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as DbRow[];
}

async function fetchMissionDocuments(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data } = await supabaseAdmin
    .from("pierre_documents")
    .select("id, mission_id, title, doc_type, created_at")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(50);
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ missionId: string }> },
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const missionId = asString(resolvedParams?.missionId);

    if (!missionId) {
      return jsonError("Mission id is required.", 400, { code: "MISSION_ID_REQUIRED" });
    }

    // Parse body for optional create_followups flag
    let createFollowups = false;
    try {
      const body: unknown = await request.json();
      if (isObject(body)) {
        createFollowups = body.create_followups === true;
      }
    } catch {
      // No body or invalid JSON — defaults apply
    }

    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const [mission, tasks] = await Promise.all([
      verifyMissionOwnership(supabaseAdmin, missionId, userId),
      fetchMissionTasks(supabaseAdmin, missionId),
    ]);

    const [logs, documents] = await Promise.all([
      fetchMissionLogs(supabaseAdmin, missionId),
      fetchMissionDocuments(supabaseAdmin, missionId),
    ]);

    const now = new Date();
    const insight = buildMissionContinuityInsight(mission, tasks, { now, logs, documents });
    const plan = buildContinuePlan(mission, tasks, { now });

    // CloneGuard summary over safe_to_run plan actions
    const missionText = [
      asString(mission.mission_summary),
      asString(mission.risk_level),
    ].filter(Boolean).join(" ");

    let cgEvaluatedCount = 0;
    let cgBlockedCount = 0;
    let cgApprovalRequiredCount = 0;
    let cgHighestRisk: PierreCloneGuardRiskLevel = "green";
    const RISK_RANK: Record<PierreCloneGuardRiskLevel, number> = { green: 0, orange: 1, red: 2, black: 3 };
    let govBlockedCount = 0;
    let govAutoAllowedCount = 0;

    const cgEnrichedSafe = (Array.isArray(plan.safe_to_run) ? plan.safe_to_run : []).map((t) => {
      const row = typeof t === "object" && t !== null ? (t as Record<string, unknown>) : {};
      const cgEval = evaluatePierreCloneGuard({
        task_type: asString(row.type),
        task_title: asString(row.title),
        approval_required: row.approval_required === true || row.approval_required === "true",
        text_corpus: missionText,
        now: now.toISOString(),
      });
      cgEvaluatedCount++;
      if (cgEval.decision === "refuse" || cgEval.decision === "block") cgBlockedCount++;
      if (cgEval.decision === "require_approval") cgApprovalRequiredCount++;
      if (RISK_RANK[cgEval.risk_level] > RISK_RANK[cgHighestRisk]) cgHighestRisk = cgEval.risk_level;

      const govEval = evaluateGovernance({
        task_type: asString(row.type),
        task_title: asString(row.title),
        approval_required: row.approval_required === true || row.approval_required === "true",
        text_corpus: missionText,
        guard_evaluation: cgEval,
        now: now.toISOString(),
      });
      if (govEval.decision === "refuse" || govEval.decision === "block") govBlockedCount++;
      if (govEval.allowed_to_auto_execute) govAutoAllowedCount++;

      return {
        ...row,
        cloneguard_preview: buildCloneGuardPreview(cgEval),
        governance_preview: buildGovernancePreview(govEval),
      };
    });

    // Log: plan + CloneGuard summary
    await tryInsertLog(supabaseAdmin, {
      mission_id: missionId,
      user_id: userId,
      event_type: "mission_continue_plan_generated",
      message: `Plan de continuité généré — ${plan.safe_to_run.length} tâche(s) exécutable(s), ${plan.requires_human.length} requérant intervention humaine`,
      meta_json: {
        safe_to_run_count: plan.safe_to_run.length,
        requires_human_count: plan.requires_human.length,
        blocked_count: plan.blocked.length,
        summary: plan.summary,
      },
    });
    await tryInsertLog(supabaseAdmin, {
      mission_id: missionId,
      user_id: userId,
      event_type: "cloneguard_continue_evaluated",
      message: `CloneGuard — ${cgEvaluatedCount} action(s) évaluée(s), ${cgBlockedCount} bloquée(s), niveau max : ${cgHighestRisk}`,
      meta_json: {
        evaluated_count: cgEvaluatedCount,
        blocked_count: cgBlockedCount,
        approval_required_count: cgApprovalRequiredCount,
        highest_risk_level: cgHighestRisk,
      },
    });

    // Optionally create followup tasks
    let followupsCreated = 0;
    if (createFollowups) {
      const drafts = buildFollowupTaskDraftsForContinue(missionId, plan);
      if (drafts.length > 0) {
        const toInsert = drafts.map((d) => ({
          ...d,
          user_id: userId,
          agent_slug: "pierre",
        }));
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("pierre_tasks")
          .insert(toInsert)
          .select("id");

        if (!insertError && inserted) {
          followupsCreated = inserted.length;

          await tryInsertLog(supabaseAdmin, {
            mission_id: missionId,
            user_id: userId,
            event_type: "continuity_followups_created",
            message: `${followupsCreated} tâche(s) de suivi créée(s) automatiquement`,
            meta_json: {
              followup_task_ids: inserted.map((t: DbRow) => asString(t.id)),
              draft_types: drafts.map((d) => asString(d.type)),
            },
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      mission_id: missionId,
      insight,
      plan: { ...plan, safe_to_run: cgEnrichedSafe },
      followups_created: followupsCreated,
      cloneguard_summary: {
        evaluated_count: cgEvaluatedCount,
        blocked_count: cgBlockedCount,
        approval_required_count: cgApprovalRequiredCount,
        highest_risk_level: cgHighestRisk,
      },
      governance_summary: {
        blocked_count: govBlockedCount,
        auto_allowed_count: govAutoAllowedCount,
      },
      meta: {
        missionId,
        userId,
        generatedAt: now.toISOString(),
        tasks_count: tasks.length,
        logs_count: logs.length,
        documents_count: documents.length,
        safe_to_run_count: plan.safe_to_run.length,
        requires_human_count: plan.requires_human.length,
        blocked_count: plan.blocked.length,
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
