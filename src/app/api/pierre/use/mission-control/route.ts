import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionControlDashboard,
  buildMissionControlPreview,
  buildMissionControlScaleProfile,
  buildMissionControlDataWindow,
} from "../../../../../lib/pierre/hr/mission-control";
import {
  buildAuditTrailEvents,
  buildAuditTrailDiagnostics,
  scoreAuditTrailHealth,
  buildAuditTrailDigest,
  buildAuditTrailAlerts,
} from "../../../../../lib/pierre/hr/audit-trail";
import {
  evaluatePierreCloneGuard,
  summarizeCloneGuardEvaluation,
} from "../../../../../lib/pierre/hr/cloneguard";
import {
  evaluateGovernance,
} from "../../../../../lib/pierre/hr/governance";
import { buildContinuityDashboard } from "../../../../../lib/pierre/hr/continuity";
import {
  buildPierreOperationalFeed,
  buildFeedItemFromEmployeeFileSnapshot,
  type PierreOperationalFeedItem,
} from "../../../../../lib/pierre/hr/operational-feed";
import {
  buildEmployeeFileIndex,
  type PierreEmployeeFileSnapshot,
} from "../../../../../lib/pierre/hr/employee-file";
import { sanitizePierreEmployeeList } from "../../../../../lib/pierre/hr/employee";
import {
  buildEmployeeActionsIndex,
  buildEmployeeActionSummary,
} from "../../../../../lib/pierre/hr/employee-actions";
import {
  getCloneStoreTechnologyDefinitions,
  buildDefaultTechnologyCompanySettings,
  buildTechnologyRegistry,
} from "../../../../../lib/clonestore/technologies/registry";
import {
  mapRowsToSettings,
  legacyExtractSettings,
} from "../../../../../lib/clonestore/technologies/storage";
import {
  buildRuntimeSnapshot,
} from "../../../../../lib/clonestore/runtime/engine";
import type { TechnologyCompanySetting } from "../../../../../lib/clonestore/technologies/contracts";
import type { CloneRuntimeSnapshot } from "../../../../../lib/clonestore/runtime/contracts";

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

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

async function fetchMissions(supabaseAdmin: SupabaseClient, userId: string, limit: number): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin.from("pierre_missions")
    .select("id, status, understanding_status, risk_level, approval_required, mission_summary, intent, missing_info_json, brain_output_json, created_at, updated_at")
    .eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(limit);
  if (error) throw { status: 500, message: "Unable to load missions.", code: "MISSIONS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchTasks(supabaseAdmin: SupabaseClient, userId: string, limit: number): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin.from("pierre_tasks")
    .select("id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, brain_output_json, context_snapshot_json, result_json, created_at, updated_at")
    .eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(limit);
  if (error) throw { status: 500, message: "Unable to load tasks.", code: "TASKS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchDocuments(supabaseAdmin: SupabaseClient, userId: string, limit: number): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin.from("pierre_documents")
    .select("id, mission_id, task_id, doc_type, title, status, text_content, created_at, updated_at, meta_json")
    .eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(limit);
  if (error) throw { status: 500, message: "Unable to load documents.", code: "DOCUMENTS_FETCH_FAILED", details: error };
  return Array.isArray(data) ? (data as DbRow[]) : [];
}

async function fetchLogs(supabaseAdmin: SupabaseClient, userId: string, limit: number): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin.from("pierre_task_logs")
      .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
      .eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(limit);
    return Array.isArray(data) ? (data as DbRow[]) : [];
  } catch { return []; }
}

async function fetchEmployees(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin.from("pierre_company_memory")
      .select("id, user_id, agent_slug, reusable_rh_context_json, memory_json, created_at, updated_at")
      .eq("user_id", userId).eq("agent_slug", "pierre").limit(1).maybeSingle();
    if (!data || !isObject(data.reusable_rh_context_json)) return [];
    return sanitizePierreEmployeeList((data.reusable_rh_context_json as Record<string, unknown>).employees) as unknown as DbRow[];
  } catch { return []; }
}

function buildEmployeeSnapshots(
  employees: DbRow[], missions: DbRow[], tasks: DbRow[], documents: DbRow[], logs: DbRow[],
): { snapshots: PierreEmployeeFileSnapshot[]; feedItems: PierreOperationalFeedItem[] } {
  try {
    const index = buildEmployeeFileIndex(employees, missions, tasks, documents, logs);
    const snapshots = [...index.sensitive, ...index.attention_required, ...index.incomplete] as PierreEmployeeFileSnapshot[];
    const feedItems = snapshots.map((s) => {
      try { return buildFeedItemFromEmployeeFileSnapshot(s as unknown as Record<string, unknown>); }
      catch (_e) { /* skip malformed row */ return null; }
    }).filter((i): i is PierreOperationalFeedItem => i !== null);
    return { snapshots, feedItems };
  } catch (_e) { /* skip malformed row */ return { snapshots: [], feedItems: [] }; }
}

// ── CloneOS Runtime summary helper ────────────────────────

type CloneRuntimeSummary = {
  snapshot: CloneRuntimeSnapshot | null;
  unavailable: boolean;
  storage_source: "platform_table" | "legacy_json" | "defaults" | "unavailable";
  error: string | null;
};

async function tryBuildCloneRuntimeSummaryForPierre(
  supabaseAdmin: SupabaseClient,
  userId: string,
  now: string,
): Promise<CloneRuntimeSummary> {
  try {
    const defs = getCloneStoreTechnologyDefinitions();
    let settings: TechnologyCompanySetting[];
    let source: CloneRuntimeSummary["storage_source"];

    const { data: tableData, error: tableError } = await supabaseAdmin
      .from("clonestore_company_technologies")
      .select("*")
      .eq("user_id", userId);

    if (!tableError && tableData && tableData.length > 0) {
      settings = mapRowsToSettings(tableData as DbRow[], defs);
      source = "platform_table";
    } else {
      const { data: legacyData } = await supabaseAdmin
        .from("pierre_company_memory")
        .select("reusable_rh_context_json")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .maybeSingle();

      if (legacyData && isObject(legacyData.reusable_rh_context_json)) {
        settings = legacyExtractSettings(
          legacyData.reusable_rh_context_json as Record<string, unknown>,
          defs,
        );
        source = settings.length > 0 ? "legacy_json" : "defaults";
      } else {
        settings = [];
        source = "defaults";
      }
    }

    const defaults = buildDefaultTechnologyCompanySettings(defs);
    const mergedSettings: TechnologyCompanySetting[] = defs.map((def) => {
      const db = settings.find((s) => s.technology_slug === def.slug);
      return db ?? defaults.find((s) => s.technology_slug === def.slug)!;
    });

    const registry = buildTechnologyRegistry({ definitions: defs, rawSettings: mergedSettings });
    const snapshot = buildRuntimeSnapshot(registry, "pierre", now);
    return { snapshot, unavailable: false, storage_source: source, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Runtime unavailable.";
    return { snapshot: null, unavailable: true, storage_source: "unavailable", error: msg };
  }
}

// ── GET /api/pierre/use/mission-control ───────────────────

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const url = new URL(request.url);
    const rawMax = parseInt(url.searchParams.get("max_safe_actions") ?? "10", 10);
    const maxSafeActions = Number.isFinite(rawMax) ? Math.min(Math.max(rawMax, 1), 10) : 10;

    const now = new Date();
    const dataWindow = buildMissionControlDataWindow();
    const scaleProfile = buildMissionControlScaleProfile();

    const [missions, tasks, documents, logs, employees, cloneRuntime] = await Promise.all([
      fetchMissions(supabaseAdmin, userId, dataWindow.missions_limit),
      fetchTasks(supabaseAdmin, userId, dataWindow.tasks_limit),
      fetchDocuments(supabaseAdmin, userId, dataWindow.documents_limit),
      fetchLogs(supabaseAdmin, userId, dataWindow.logs_limit),
      fetchEmployees(supabaseAdmin, userId),
      tryBuildCloneRuntimeSummaryForPierre(supabaseAdmin, userId, now.toISOString()),
    ]);

    const { snapshots: employeeSnapshots, feedItems: employeeFeedItems } =
      buildEmployeeSnapshots(employees, missions, tasks, documents, logs);

    const operationalFeed = buildPierreOperationalFeed({ missions, tasks, documents, logs, now });
    const allFeedItems = [...operationalFeed.items, ...employeeFeedItems];

    const tasksByMissionId: Record<string, DbRow[]> = {};
    for (const t of tasks) {
      const mId = asString(t.mission_id); if (!mId) continue;
      if (!tasksByMissionId[mId]) tasksByMissionId[mId] = [];
      tasksByMissionId[mId].push(t);
    }
    const logsByMissionId: Record<string, DbRow[]> = {};
    for (const l of logs) {
      const mId = asString(l.mission_id); if (!mId) continue;
      if (!logsByMissionId[mId]) logsByMissionId[mId] = [];
      logsByMissionId[mId].push(l);
    }
    const documentsByMissionId: Record<string, DbRow[]> = {};
    for (const d of documents) {
      const mId = asString(d.mission_id); if (!mId) continue;
      if (!documentsByMissionId[mId]) documentsByMissionId[mId] = [];
      documentsByMissionId[mId].push(d);
    }

    const continuityDashboard = buildContinuityDashboard(userId, missions, tasksByMissionId, {
      now, logsByMissionId, documentsByMissionId,
    });

    const missionControl = buildMissionControlDashboard({
      missions, tasks, documents, logs, employeeSnapshots,
      feedItems: allFeedItems, continuityDashboard, now, maxSafeActions,
    });

    const preview = buildMissionControlPreview(missionControl);

    // CloneGuard summary over safe_to_run actions
    const cgSafeActions = Array.isArray(missionControl.safe_to_run)
      ? missionControl.safe_to_run
      : [];
    let cgBlockedInSafe = 0;
    let govBlockedInSafe = 0;
    let govAutoAllowedInSafe = 0;
    const cgSafeEvals = cgSafeActions.map((a) => {
      const row = typeof a === "object" && a !== null ? (a as Record<string, unknown>) : {};
      const taskType = String(row.task_type ?? "");
      const taskTitle = String(row.title ?? "");
      const cgEval = evaluatePierreCloneGuard({
        task_type: taskType || null,
        task_title: taskTitle || null,
        now: now.toISOString(),
      });
      if (cgEval.decision === "refuse" || cgEval.decision === "block") cgBlockedInSafe++;
      const govEval = evaluateGovernance({
        task_type: taskType || null,
        task_title: taskTitle || null,
        guard_evaluation: cgEval,
        now: now.toISOString(),
      });
      if (govEval.decision === "refuse" || govEval.decision === "block") govBlockedInSafe++;
      if (govEval.allowed_to_auto_execute) govAutoAllowedInSafe++;
      return {
        task_id: row.task_id,
        decision: cgEval.decision,
        summary: summarizeCloneGuardEvaluation(cgEval),
        governance_decision: govEval.decision,
        governance_allowed_to_auto_execute: govEval.allowed_to_auto_execute,
      };
    });

    // Audit trail summary
    const mcAuditEvents = buildAuditTrailEvents({ missions, tasks, documents, logs });
    const mcAuditDiag = buildAuditTrailDiagnostics(mcAuditEvents);
    const mcAuditHealth = scoreAuditTrailHealth(mcAuditEvents);
    const mcAuditDigest = buildAuditTrailDigest(mcAuditEvents);
    const mcAuditAlerts = buildAuditTrailAlerts(mcAuditEvents);

    return NextResponse.json({
      ok: true,
      mission_control: missionControl,
      preview,
      cloneguard: {
        safe_actions_evaluated: cgSafeEvals.length,
        blocked_in_safe: cgBlockedInSafe,
        actions: cgSafeEvals,
      },
      governance_card: {
        safe_actions_evaluated: cgSafeEvals.length,
        blocked_in_safe: govBlockedInSafe,
        auto_allowed_in_safe: govAutoAllowedInSafe,
      },
      scale_profile: scaleProfile,
      data_window: dataWindow,
      audit_trail_summary: {
        diagnostics: mcAuditDiag,
        health: mcAuditHealth,
        digest: mcAuditDigest,
        alerts_count: mcAuditAlerts.length,
        critical_count: mcAuditDiag.critical_count,
        human_required_count: mcAuditDiag.human_required_count,
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
      clone_runtime_summary: {
        snapshot: cloneRuntime.snapshot,
        unavailable: cloneRuntime.unavailable,
        storage_source: cloneRuntime.storage_source,
        ...(cloneRuntime.error ? { error: cloneRuntime.error } : {}),
      },
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
        limits: dataWindow,
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
