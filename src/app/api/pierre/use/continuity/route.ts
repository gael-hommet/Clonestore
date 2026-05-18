import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildContinuityDashboard,
  type PierreContinuityDashboard,
} from "../../../../../lib/pierre/hr/continuity";
import {
  buildPierreOperationalFeed,
  buildFeedSummary,
  buildPremiumFeedSummary,
  buildOperationalCommandCenter,
} from "../../../../../lib/pierre/hr/operational-feed";
import {
  buildMissionControlActionFromTask,
  buildMissionControlMetrics,
  buildMissionControlDigest,
  buildMissionControlScaleProfile,
  sortMissionControlActions,
} from "../../../../../lib/pierre/hr/mission-control";
import {
  buildAuditTrailEvents,
  buildAuditTrailDiagnostics,
  scoreAuditTrailHealth,
  buildAuditTrailDigest,
  buildAuditTrailAlerts,
} from "../../../../../lib/pierre/hr/audit-trail";

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

async function fetchActiveMissions(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select(
      "id, status, understanding_status, risk_level, approval_required, mission_summary, missing_info_json, brain_output_json, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .not("status", "in", '("cancelled")')
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw {
      status: 500,
      message: "Unable to load missions.",
      code: "MISSIONS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function fetchTasksForMissions(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionIds: string[],
): Promise<DbRow[]> {
  if (missionIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select(
      "id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .in("mission_id", missionIds)
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

async function fetchLogsForMissions(
  supabaseAdmin: SupabaseClient,
  missionIds: string[],
): Promise<DbRow[]> {
  if (missionIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("pierre_task_logs")
    .select("id, task_id, mission_id, event_type, message, created_at")
    .in("mission_id", missionIds)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return [];
  return (data ?? []) as DbRow[];
}

async function fetchDocumentsForMissions(
  supabaseAdmin: SupabaseClient,
  missionIds: string[],
): Promise<DbRow[]> {
  if (missionIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("pierre_documents")
    .select("id, mission_id, title, doc_type, created_at")
    .in("mission_id", missionIds)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return [];
  return (data ?? []) as DbRow[];
}

// ═══════════════════════════════════════════════════════════
// DIGEST (global)
// ═══════════════════════════════════════════════════════════

function buildGlobalDigest(dashboard: PierreContinuityDashboard): string {
  if (dashboard.missions_total === 0) {
    return "Aucune mission active — le poste RH est en attente d'instructions.";
  }

  const sections = dashboard.sections ?? [];
  const safeCount = sections.find((s) => s.key === "safe_to_run")?.count ?? 0;
  const overdueCount = sections.find((s) => s.key === "overdue")?.count ?? 0;
  const dueNowCount = sections.find((s) => s.key === "due_now")?.count ?? 0;
  const approvalCount = sections.find((s) => s.key === "awaiting_approval")?.count ?? 0;
  const blockedCount = sections.find((s) => s.key === "blocked")?.count ?? 0;
  const failedCount = sections.find((s) => s.key === "failed")?.count ?? 0;

  const parts: string[] = [];

  if (dueNowCount > 0) parts.push(`${dueNowCount} tâche(s) à traiter maintenant.`);
  if (overdueCount > 0) parts.push(`${overdueCount} tâche(s) en retard.`);
  if (safeCount > 0) parts.push(`${safeCount} tâche(s) exécutable(s) automatiquement.`);
  if (approvalCount > 0) parts.push(`${approvalCount} tâche(s) en attente d'approbation.`);
  if (blockedCount > 0) parts.push(`${blockedCount} tâche(s) bloquée(s).`);
  if (failedCount > 0) parts.push(`${failedCount} tâche(s) en erreur.`);
  if (dashboard.missions_stalled > 0) {
    parts.push(
      `${dashboard.missions_stalled} mission(s) sans progression depuis plus de 3 jours.`,
    );
  }

  if (parts.length === 0) {
    parts.push(
      `${dashboard.missions_total} mission(s) en cours — aucune action immédiate requise.`,
    );
  }

  return parts.join(" ");
}

// ═══════════════════════════════════════════════════════════
// GET HANDLER
// ═══════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const missions = await fetchActiveMissions(supabaseAdmin, userId);

    const missionIds = missions
      .map((m) => asString(m.id))
      .filter((id): id is string => id !== null);

    const [tasks, logs, documents] = await Promise.all([
      fetchTasksForMissions(supabaseAdmin, userId, missionIds),
      fetchLogsForMissions(supabaseAdmin, missionIds),
      fetchDocumentsForMissions(supabaseAdmin, missionIds),
    ]);

    // Group tasks, logs, documents by mission_id
    const tasksByMissionId: Record<string, DbRow[]> = {};
    for (const task of tasks) {
      const mId = asString(task.mission_id);
      if (!mId) continue;
      if (!tasksByMissionId[mId]) tasksByMissionId[mId] = [];
      tasksByMissionId[mId].push(task);
    }

    const logsByMissionId: Record<string, DbRow[]> = {};
    for (const log of logs) {
      const mId = asString(log.mission_id);
      if (!mId) continue;
      if (!logsByMissionId[mId]) logsByMissionId[mId] = [];
      logsByMissionId[mId].push(log);
    }

    const documentsByMissionId: Record<string, DbRow[]> = {};
    for (const doc of documents) {
      const mId = asString(doc.mission_id);
      if (!mId) continue;
      if (!documentsByMissionId[mId]) documentsByMissionId[mId] = [];
      documentsByMissionId[mId].push(doc);
    }

    const now = new Date();
    const dashboard = buildContinuityDashboard(userId, missions, tasksByMissionId, {
      now,
      logsByMissionId,
      documentsByMissionId,
    });

    const digest = buildGlobalDigest(dashboard);

    const operationalFeed = buildPierreOperationalFeed({ missions, tasks, documents, logs, now });
    const operationalFeedSummary = buildFeedSummary(operationalFeed.items);
    const premiumFeedSummary = buildPremiumFeedSummary(operationalFeed.items);
    const commandCenter = buildOperationalCommandCenter(operationalFeed.items);
    const commandCenterPreview = commandCenter.recommended_order.slice(0, 5);

    // Mission control summary
    const TERMINAL_STATUSES = new Set(["done", "cancelled"]);
    const mcActions = tasks
      .filter((t) => {
        const s = asString(t.status)?.toLowerCase() ?? "";
        return !TERMINAL_STATUSES.has(s);
      })
      .map((task) => {
        try {
          return buildMissionControlActionFromTask(task, now);
        } catch {
          return null;
        }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
    const mcSortedActions = sortMissionControlActions(mcActions);
    const mcMetrics = buildMissionControlMetrics({
      actions: mcSortedActions,
      missions: missions as Record<string, unknown>[],
      snapshots: [],
      continuityDashboard: dashboard,
    });
    const urgentCount = mcSortedActions.filter((a) => a.priority === "urgent").length;
    const safeToRunCount = mcSortedActions.filter((a) => a.is_safe_to_run).length;
    const pendingApprovals = mcSortedActions.filter((a) => a.type === "approve_task").length;
    const blockers = mcSortedActions.filter((a) => a.is_blocking).length;
    const sensitiveCount = mcSortedActions.filter((a) => a.is_sensitive).length;
    const deliveriesCount = mcSortedActions.filter((a) => a.is_delivery).length;
    const globalStatus =
      sensitiveCount > 0 ? "sensitive" as const
      : blockers > 0 ? "blocked" as const
      : urgentCount > 0 ? "attention_required" as const
      : mcSortedActions.length > 0 ? "active" as const
      : "clear" as const;
    const mcDigest = buildMissionControlDigest({
      status: globalStatus,
      urgentCount,
      safeToRunCount,
      pendingApprovals,
      blockers,
      sensitiveCount,
      deliveries: deliveriesCount,
    });
    const missionControlSummary = {
      status: globalStatus,
      digest: mcDigest,
      metrics: mcMetrics,
      safe_to_run_count: safeToRunCount,
      pending_approvals: pendingApprovals,
      blockers,
      sensitive_count: sensitiveCount,
    };

    const mcScaleProfile = buildMissionControlScaleProfile();
    const mcPreview = {
      status: globalStatus,
      top_actions: mcSortedActions.slice(0, 5),
      counts: {
        safe_to_run: safeToRunCount,
        needs_human: mcSortedActions.filter((a) => a.requires_human).length,
        blockers,
        sensitive: sensitiveCount,
        deliveries: deliveriesCount,
      },
    };

    // Audit trail summary
    const auditEvents = buildAuditTrailEvents({ missions, tasks, documents, logs });
    const auditDiag = buildAuditTrailDiagnostics(auditEvents);
    const auditHealth = scoreAuditTrailHealth(auditEvents);
    const auditDigestObj = buildAuditTrailDigest(auditEvents);
    const auditAlerts = buildAuditTrailAlerts(auditEvents);

    return NextResponse.json({
      ok: true,
      dashboard,
      sections: dashboard.sections ?? [],
      digest,
      operational_feed_summary: operationalFeedSummary,
      premium_feed_summary: premiumFeedSummary,
      command_center_preview: commandCenterPreview,
      mission_control_summary: missionControlSummary,
      mission_control: {
        summary: missionControlSummary,
        preview: mcPreview,
        scale_profile: mcScaleProfile,
      },
      audit_trail_summary: {
        diagnostics: auditDiag,
        health: auditHealth,
        digest: auditDigestObj,
        alerts_count: auditAlerts.length,
        critical_count: auditDiag.critical_count,
        human_required_count: auditDiag.human_required_count,
      },
      meta: {
        userId,
        fetchedAt: now.toISOString(),
        missions_loaded: missions.length,
        tasks_loaded: tasks.length,
        logs_loaded: logs.length,
        documents_loaded: documents.length,
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
