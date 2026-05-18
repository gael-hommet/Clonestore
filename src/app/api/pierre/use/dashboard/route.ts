import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionControlDashboard,
} from "../../../../../lib/pierre/hr/mission-control";
import {
  buildContinuityDashboard,
} from "../../../../../lib/pierre/hr/continuity";
import {
  buildPierreOperationalFeed,
  buildFeedItemFromEmployeeFileSnapshot,
  type PierreOperationalFeedItem,
} from "../../../../../lib/pierre/hr/operational-feed";
import {
  buildEmployeeFileIndex,
  type PierreEmployeeFileSnapshot,
} from "../../../../../lib/pierre/hr/employee-file";
import {
  sanitizePierreEmployeeList,
} from "../../../../../lib/pierre/hr/employee";

// ── Types ──────────────────────────────────────────────────

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

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
      "id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, brain_output_json, context_snapshot_json, result_json, created_at, updated_at",
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
      "id, mission_id, task_id, doc_type, title, status, text_content, created_at, updated_at, meta_json",
    )
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw { status: 500, message: "Unable to load documents.", code: "DOCUMENTS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchLogs(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_task_logs")
      .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(500);
    return Array.isArray(data) ? (data as DbRow[]) : [];
  } catch {
    return [];
  }
}

async function fetchEmployees(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("id, user_id, agent_slug, reusable_rh_context_json, memory_json, created_at, updated_at")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .limit(1)
      .maybeSingle();
    if (!data || !isObject(data.reusable_rh_context_json)) return [];
    return sanitizePierreEmployeeList(
      (data.reusable_rh_context_json as Record<string, unknown>).employees,
    ) as unknown as DbRow[];
  } catch {
    return [];
  }
}

// ── Employee snapshots ─────────────────────────────────────

function buildEmployeeSnapshots(
  employees: DbRow[],
  missions: DbRow[],
  tasks: DbRow[],
  documents: DbRow[],
  logs: DbRow[],
): { snapshots: PierreEmployeeFileSnapshot[]; feedItems: PierreOperationalFeedItem[] } {
  try {
    const index = buildEmployeeFileIndex(employees, missions, tasks, documents, logs);
    const snapshots = [
      ...index.sensitive,
      ...index.attention_required,
      ...index.incomplete,
    ] as PierreEmployeeFileSnapshot[];

    const feedItems = snapshots
      .map((s) => {
        try {
          return buildFeedItemFromEmployeeFileSnapshot(s as unknown as Record<string, unknown>);
        } catch (_e) {
          /* skip malformed row */
          return null;
        }
      })
      .filter((item): item is PierreOperationalFeedItem => item !== null);

    return { snapshots, feedItems };
  } catch (_e) {
    /* skip malformed row */
    return { snapshots: [], feedItems: [] };
  }
}

// ── GET /api/pierre/use/dashboard ─────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const url = new URL(request.url);
    const rawMax = parseInt(url.searchParams.get("max_safe_actions") ?? "10", 10);
    const maxSafeActions = Number.isFinite(rawMax) ? Math.min(Math.max(rawMax, 1), 10) : 10;

    const now = new Date();

    // Fetch all data in parallel
    const [missions, tasks, documents, logs, employees] = await Promise.all([
      fetchMissions(supabaseAdmin, userId),
      fetchTasks(supabaseAdmin, userId),
      fetchDocuments(supabaseAdmin, userId),
      fetchLogs(supabaseAdmin, userId),
      fetchEmployees(supabaseAdmin, userId),
    ]);

    // Build employee snapshots + employee feed items
    const { snapshots: employeeSnapshots, feedItems: employeeFeedItems } =
      buildEmployeeSnapshots(employees, missions, tasks, documents, logs);

    // Build operational feed (missions + tasks + docs + logs + employee items)
    const operationalFeed = buildPierreOperationalFeed({ missions, tasks, documents, logs, now });
    const allFeedItems = [...operationalFeed.items, ...employeeFeedItems];

    // Group tasks/logs/docs by mission for continuity dashboard
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

    // Build continuity dashboard
    const continuityDashboard = buildContinuityDashboard(userId, missions, tasksByMissionId, {
      now,
      logsByMissionId,
      documentsByMissionId,
    });

    // Build full mission control dashboard
    const dashboard = buildMissionControlDashboard({
      missions,
      tasks,
      documents,
      logs,
      employeeSnapshots,
      feedItems: allFeedItems,
      continuityDashboard,
      now,
      maxSafeActions,
    });

    return NextResponse.json({
      ok: true,
      dashboard,
      meta: {
        canonical_route: "/api/pierre/use/mission-control",
        compatibility_route: "/api/pierre/use/dashboard",
        userId,
        fetchedAt: now.toISOString(),
        missions_loaded: missions.length,
        tasks_loaded: tasks.length,
        documents_loaded: documents.length,
        logs_loaded: logs.length,
        employees_loaded: employees.length,
        feed_items: allFeedItems.length,
        max_safe_actions: maxSafeActions,
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
