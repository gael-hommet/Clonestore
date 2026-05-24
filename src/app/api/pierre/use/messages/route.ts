import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildPierreOperationalFeed,
  buildFeedItemFromEmployeeFileSnapshot,
  buildFeedSummary,
  buildFeedSections,
  buildPremiumFeedSummary,
  buildOperationalCommandCenter,
  normalizeFeedCategoryAlias,
  type PierreOperationalFeedItem,
} from "../../../../../lib/pierre/hr/operational-feed";
import {
  buildMissionControlActionFromTask,
  sortMissionControlActions,
} from "../../../../../lib/pierre/hr/mission-control";
import {
  buildEmployeeFileIndex,
} from "../../../../../lib/pierre/hr/employee-file";
import {
  sanitizePierreEmployeeList,
} from "../../../../../lib/pierre/hr/employee";
import {
  buildEmployeeActionsIndex,
  buildEmployeeActionSummary,
} from "../../../../../lib/pierre/hr/employee-actions";
import {
  buildAuditTrailEvents,
  buildAuditTrailDiagnostics,
  scoreAuditTrailHealth,
  buildAuditTrailDigest,
  buildAuditTrailAlerts,
} from "../../../../../lib/pierre/hr/audit-trail";

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

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
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

async function fetchCompanyMemory(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  const { data } = await supabaseAdmin
    .from("pierre_company_memory")
    .select("id, user_id, agent_slug, reusable_rh_context_json, memory_json, created_at, updated_at")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .limit(1)
    .maybeSingle();
  return data ? [data as DbRow] : [];
}

// ── Employee file snapshots ────────────────────────────────

function buildEmployeeSnapshots(
  employees: unknown[],
  missions: DbRow[],
  tasks: DbRow[],
  documents: DbRow[],
  logs: DbRow[],
): PierreOperationalFeedItem[] {
  try {
    const safeEmployees = employees.filter(isObject) as Record<string, unknown>[];
    const index = buildEmployeeFileIndex(safeEmployees, missions, tasks, documents, logs);
    const snapshots = [
      ...index.sensitive,
      ...index.attention_required,
      ...index.incomplete,
    ];
    return snapshots
      .map((s) => {
        try {
          return buildFeedItemFromEmployeeFileSnapshot(s as unknown as Record<string, unknown>);
        } catch {
          return null;
        }
      })
      .filter((item): item is PierreOperationalFeedItem => item !== null);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// GET /api/pierre/use/messages
// ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    // Query params — existing
    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 100;
    const includeRaw = asBool(url.searchParams.get("include_raw"));
    const filterPriority = asString(url.searchParams.get("priority"));
    const filterSeverity = asString(url.searchParams.get("severity"));
    const filterActionRequired = url.searchParams.get("action_required");
    const requireActionRequired =
      filterActionRequired === "true" || filterActionRequired === "1"
        ? true
        : null;

    // Query params — new Bloc 12.1
    const rawCategory = asString(url.searchParams.get("category"));
    const filterCategory = rawCategory ? normalizeFeedCategoryAlias(rawCategory) : null;
    const filterEmployeeId = asString(url.searchParams.get("employee_id"));
    const filterMissionId = asString(url.searchParams.get("mission_id"));
    const filterTaskId = asString(url.searchParams.get("task_id"));
    const filterIntent = asString(url.searchParams.get("intent"));
    const filterSensitive = url.searchParams.get("sensitive");
    const requireSensitive = filterSensitive === "true" || filterSensitive === "1" ? true : null;
    const filterBlocking = url.searchParams.get("blocking");
    const requireBlocking = filterBlocking === "true" || filterBlocking === "1" ? true : null;

    const now = new Date();

    // Fetch all data in parallel
    const [missions, tasks, documents, logs, companyMemoryRows] =
      await Promise.all([
        fetchMissions(supabaseAdmin, userId),
        fetchTasks(supabaseAdmin, userId),
        fetchDocuments(supabaseAdmin, userId),
        fetchLogs(supabaseAdmin, userId),
        fetchCompanyMemory(supabaseAdmin, userId),
      ]);

    // Extract employees from company memory
    let employees: unknown[] = [];
    if (companyMemoryRows.length > 0) {
      const mem = companyMemoryRows[0];
      try {
        const rhCtx = isObject(mem.reusable_rh_context_json)
          ? mem.reusable_rh_context_json
          : null;
        const rawEmployees = Array.isArray(rhCtx?.employees) ? rhCtx.employees : [];
        employees = sanitizePierreEmployeeList(rawEmployees);
      } catch {
        employees = [];
      }
    }

    const employeeFileSnapshots = buildEmployeeSnapshots(employees, missions, tasks, documents, logs);

    // Build feed
    const feed = buildPierreOperationalFeed({
      missions,
      tasks,
      documents,
      logs,
      now,
      limit,
    });

    // Merge employee file snapshot items into feed items
    let items = [...feed.items, ...employeeFileSnapshots];

    // Apply filters — existing
    if (filterPriority) {
      items = items.filter((it) => it.priority === filterPriority);
    }
    if (filterSeverity) {
      items = items.filter((it) => it.severity === filterSeverity);
    }
    if (requireActionRequired !== null) {
      items = items.filter((it) => it.action_required === requireActionRequired);
    }

    // Apply filters — new Bloc 12.1
    if (filterCategory) {
      items = items.filter((it) => it.category === filterCategory);
    }
    if (filterEmployeeId) {
      items = items.filter((it) => it.employee_id === filterEmployeeId);
    }
    if (filterMissionId) {
      items = items.filter((it) => it.mission_id === filterMissionId);
    }
    if (filterTaskId) {
      items = items.filter((it) => it.task_id === filterTaskId);
    }
    if (filterIntent) {
      items = items.filter((it) => it.intent === filterIntent);
    }
    if (requireSensitive !== null) {
      items = items.filter((it) => it.is_sensitive === requireSensitive);
    }
    if (requireBlocking !== null) {
      items = items.filter((it) => it.is_blocking === requireBlocking);
    }

    // Strip raw if not requested
    if (!includeRaw) {
      items = items.map((it) => {
        const { raw, ...rest } = it;
        void raw;
        return rest as PierreOperationalFeedItem;
      });
    }

    // Recompute summary and sections from filtered items
    const summary = buildFeedSummary(items);
    const sections = buildFeedSections(items);
    const premium_summary = buildPremiumFeedSummary(items);
    const command_center = buildOperationalCommandCenter(items);

    // Derived premium helpers
    const top_alert = items.find((it) => it.category === "alert" && it.priority === "urgent")
      ?? items.find((it) => it.category === "alert") ?? null;
    const latest_delivery = items.find((it) => it.is_delivery) ?? null;
    const latest_briefing = items.find((it) => it.is_briefing) ?? null;
    const next_action = premium_summary.next_action_label;

    const inbox_counters = {
      alerts: summary.alert,
      follow_ups: summary.follow_up,
      deliveries: summary.delivery,
      briefings: summary.briefing,
      action_required: summary.action_required,
      urgent: summary.urgent,
    };

    const TERMINAL_MSG = new Set(["done", "cancelled"]);
    const mcMsgActions = tasks
      .filter((t) => !TERMINAL_MSG.has((asString(t.status) ?? "").toLowerCase()))
      .map((t) => {
        try { return buildMissionControlActionFromTask(t, now); }
        catch (_e) { /* skip malformed row */ return null; }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
    const mcMsgSorted = sortMissionControlActions(mcMsgActions);
    const mcMsgSensitive = mcMsgSorted.filter((a) => a.is_sensitive).length;
    const mcMsgBlockers = mcMsgSorted.filter((a) => a.is_blocking).length;
    const mcMsgStatus =
      mcMsgSensitive > 0 ? "sensitive" as const
      : mcMsgBlockers > 0 ? "blocked" as const
      : mcMsgSorted.some((a) => a.priority === "urgent") ? "attention_required" as const
      : mcMsgSorted.length > 0 ? "active" as const
      : "clear" as const;
    const missionControlPreview = {
      status: mcMsgStatus,
      top_actions: mcMsgSorted.slice(0, 5),
      counts: {
        safe_to_run: mcMsgSorted.filter((a) => a.is_safe_to_run && !a.requires_human).length,
        needs_human: mcMsgSorted.filter((a) => a.requires_human).length,
        blockers: mcMsgBlockers,
        sensitive: mcMsgSensitive,
        deliveries: mcMsgSorted.filter((a) => a.is_delivery).length,
      },
    };

    const msgAuditEvents = buildAuditTrailEvents({ missions, tasks, documents, logs });
    const msgAuditDiag = buildAuditTrailDiagnostics(msgAuditEvents);
    const msgAuditHealth = scoreAuditTrailHealth(msgAuditEvents);
    const msgAuditDigest = buildAuditTrailDigest(msgAuditEvents);
    const msgAuditAlerts = buildAuditTrailAlerts(msgAuditEvents);

    return NextResponse.json({
      ok: true,
      feed: { ...feed, items, summary, sections },
      summary,
      sections,
      premium_summary,
      command_center,
      inbox_counters,
      next_action,
      top_alert,
      latest_delivery,
      latest_briefing,
      mission_control: missionControlPreview,
      audit_trail_summary: {
        diagnostics: msgAuditDiag,
        health: msgAuditHealth,
        digest: msgAuditDigest,
        alerts_count: msgAuditAlerts.length,
        critical_count: msgAuditDiag.critical_count,
        human_required_count: msgAuditDiag.human_required_count,
      },
      employee_actions_summary: (() => {
        try {
          const actIndex = buildEmployeeActionsIndex(
            employees as unknown as Record<string, unknown>[],
            missions as unknown as Record<string, unknown>[],
            tasks as unknown as Record<string, unknown>[],
          );
          const allSugg = Object.values(actIndex).flatMap((p) => p.suggested_actions);
          return buildEmployeeActionSummary(allSugg);
        } catch { return null; }
      })(),
      meta: {
        userId,
        fetchedAt: now.toISOString(),
        missions_loaded: missions.length,
        tasks_loaded: tasks.length,
        documents_loaded: documents.length,
        logs_loaded: logs.length,
        employees_loaded: employees.length,
        employee_file_snapshots_loaded: employeeFileSnapshots.length,
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
