import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildPierreOperationalFeed,
  buildOperationalBriefing,
  buildPremiumFeedSummary,
  buildOperationalCommandCenter,
  type PierreOperationalBriefingPeriod,
} from "../../../../../../lib/pierre/hr/operational-feed";
import { buildContinuityDashboard } from "../../../../../../lib/pierre/hr/continuity";
import {
  buildAuditTrailEvents,
  buildAuditTrailDiagnostics,
  scoreAuditTrailHealth,
  buildAuditTrailDigest,
  buildAuditTrailAlerts,
} from "../../../../../../lib/pierre/hr/audit-trail";
import {
  buildMissionControlDashboard,
  buildMissionControlBriefing,
  buildMissionControlPreview,
  buildMissionControlDataWindow,
} from "../../../../../../lib/pierre/hr/mission-control";

// ── Types ──────────────────────────────────────────────────

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

const VALID_PERIODS: PierreOperationalBriefingPeriod[] = [
  "instant",
  "daily",
  "weekly",
  "monthly",
];

// ── Helpers ────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
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

// ── Supabase ───────────────────────────────────────────────

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

// ── Auth ───────────────────────────────────────────────────

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
        const currentSession = isObject(parsed.currentSession) ? parsed.currentSession : null;
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
    throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
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

// ── Data fetching ──────────────────────────────────────────

async function fetchMissions(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select(
      "id, status, understanding_status, risk_level, approval_required, mission_summary, intent, missing_info_json, brain_output_json, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw { status: 500, message: "Unable to load missions.", code: "MISSIONS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchTasks(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select(
      "id, mission_id, type, title, status, approval_required, execute_at, brain_output_json, context_snapshot_json, result_json, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw { status: 500, message: "Unable to load tasks.", code: "TASKS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchDocuments(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_documents")
    .select(
      "id, mission_id, doc_type, title, status, text_content, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw { status: 500, message: "Unable to load documents.", code: "DOCUMENTS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchLogs(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_task_logs")
    .select(
      "id, mission_id, task_id, event_type, message, meta_json, created_at",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw { status: 500, message: "Unable to load logs.", code: "LOGS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

// ─────────────────────────────────────────────────────────
// POST /api/pierre/use/messages/briefing
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const rawPeriod = isObject(body) ? asString(body.period) : null;
    const period: PierreOperationalBriefingPeriod =
      rawPeriod && VALID_PERIODS.includes(rawPeriod as PierreOperationalBriefingPeriod)
        ? (rawPeriod as PierreOperationalBriefingPeriod)
        : "daily";

    const now = new Date();

    const [missions, tasks, documents, logs] = await Promise.all([
      fetchMissions(supabaseAdmin, userId),
      fetchTasks(supabaseAdmin, userId),
      fetchDocuments(supabaseAdmin, userId),
      fetchLogs(supabaseAdmin, userId),
    ]);

    const feed = buildPierreOperationalFeed({ missions, tasks, documents, logs, now });
    const briefing = buildOperationalBriefing(feed.items, period, now);

    // Build MC briefing
    const mcDataWindow = buildMissionControlDataWindow();
    const tasksByMissionIdBrf: Record<string, DbRow[]> = {};
    const logsByMissionIdBrf: Record<string, DbRow[]> = {};
    const docsByMissionIdBrf: Record<string, DbRow[]> = {};
    for (const t of tasks) { const m = (t.mission_id as string | null); if (m) { if (!tasksByMissionIdBrf[m]) tasksByMissionIdBrf[m] = []; tasksByMissionIdBrf[m].push(t); } }
    for (const l of logs) { const m = (l.mission_id as string | null); if (m) { if (!logsByMissionIdBrf[m]) logsByMissionIdBrf[m] = []; logsByMissionIdBrf[m].push(l); } }
    for (const d of documents) { const m = (d.mission_id as string | null); if (m) { if (!docsByMissionIdBrf[m]) docsByMissionIdBrf[m] = []; docsByMissionIdBrf[m].push(d); } }
    const continuityBrf = buildContinuityDashboard(userId, missions, tasksByMissionIdBrf, { now, logsByMissionId: logsByMissionIdBrf, documentsByMissionId: docsByMissionIdBrf });
    const mcDashboard = buildMissionControlDashboard({ missions, tasks, documents, logs, employeeSnapshots: [], feedItems: feed.items, continuityDashboard: continuityBrf, now, maxSafeActions: mcDataWindow.safe_execution_hard_limit });
    const mcBriefingPeriod = (period === "monthly" ? "weekly" : period) as "instant" | "daily" | "weekly";
    const missionControlBriefing = buildMissionControlBriefing({ dashboard: mcDashboard, period: mcBriefingPeriod, now });
    const missionControlPreview = buildMissionControlPreview(mcDashboard);

    // Premium feed context for feed_preview
    const premium_summary = buildPremiumFeedSummary(feed.items);
    const command_center = buildOperationalCommandCenter(feed.items);

    // feed_preview: top 5 items from command_center recommended_order
    const feed_preview = command_center.recommended_order.slice(0, 5);

    // Write log — non-blocking on failure, uses correct DB schema
    try {
      await supabaseAdmin.from("pierre_task_logs").insert({
        user_id: userId,
        agent_slug: "pierre",
        event_type: "operational_briefing_generated",
        message: `Briefing ${period} généré — ${briefing.stats.total} message(s), ${briefing.stats.alert} alerte(s).`,
        meta_json: {
          briefing_id: briefing.id,
          period,
          stats: briefing.stats,
          generated_at: now.toISOString(),
        },
        created_at: now.toISOString(),
      });
    } catch {
      // non-blocking
    }

    const briefAuditEvents = buildAuditTrailEvents({ missions, tasks, documents, logs });
    const briefAuditDiag = buildAuditTrailDiagnostics(briefAuditEvents);
    const briefAuditHealth = scoreAuditTrailHealth(briefAuditEvents);
    const briefAuditDigest = buildAuditTrailDigest(briefAuditEvents);
    const briefAuditAlerts = buildAuditTrailAlerts(briefAuditEvents);

    return NextResponse.json({
      ok: true,
      briefing,
      premium_summary,
      command_center,
      feed_preview,
      mission_control_briefing: missionControlBriefing,
      mission_control_preview: missionControlPreview,
      audit_trail_summary: {
        diagnostics: briefAuditDiag,
        health: briefAuditHealth,
        digest: briefAuditDigest,
        alerts_count: briefAuditAlerts.length,
        critical_count: briefAuditDiag.critical_count,
        human_required_count: briefAuditDiag.human_required_count,
      },
      meta: {
        userId,
        generatedAt: now.toISOString(),
        period,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status as number,
        { code: asString(error.code), details: isObject(error.details) ? error.details : null },
      );
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
