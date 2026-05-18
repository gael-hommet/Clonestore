import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionControlDashboard,
  buildMissionControlBriefing,
  buildMissionControlPreview,
  buildMissionControlScaleProfile,
  buildMissionControlDataWindow,
} from "../../../../../../lib/pierre/hr/mission-control";
import {
  evaluatePierreCloneGuard,
} from "../../../../../../lib/pierre/hr/cloneguard";
import {
  evaluateGovernance,
} from "../../../../../../lib/pierre/hr/governance";
import { buildContinuityDashboard } from "../../../../../../lib/pierre/hr/continuity";
import {
  buildPierreOperationalFeed,
  buildFeedItemFromEmployeeFileSnapshot,
  type PierreOperationalFeedItem,
} from "../../../../../../lib/pierre/hr/operational-feed";
import {
  buildEmployeeFileIndex,
  type PierreEmployeeFileSnapshot,
} from "../../../../../../lib/pierre/hr/employee-file";
import { sanitizePierreEmployeeList } from "../../../../../../lib/pierre/hr/employee";

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

// ── POST /api/pierre/use/mission-control/briefing ─────────

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    let body: Record<string, unknown> = {};
    try { const raw = await request.json(); if (isObject(raw)) body = raw; } catch { /* empty body ok */ }

    const rawPeriod = asString(body.period);
    const period = (rawPeriod === "daily" || rawPeriod === "weekly") ? rawPeriod : "instant";

    const dataWindow = buildMissionControlDataWindow();
    const now = new Date();

    // Fetch all data
    const [mRes, tRes, dRes, lRes, memoRes, empRes] = await Promise.all([
      supabaseAdmin.from("pierre_missions").select("id, status, understanding_status, risk_level, approval_required, mission_summary, intent, missing_info_json, brain_output_json, created_at, updated_at").eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(dataWindow.missions_limit),
      supabaseAdmin.from("pierre_tasks").select("id, mission_id, type, title, status, approval_required, execute_at, priority, last_error, brain_output_json, context_snapshot_json, result_json, created_at, updated_at").eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(dataWindow.tasks_limit),
      supabaseAdmin.from("pierre_documents").select("id, mission_id, task_id, doc_type, title, status, text_content, created_at, updated_at, meta_json").eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(dataWindow.documents_limit),
      supabaseAdmin.from("pierre_task_logs").select("id, mission_id, task_id, event_type, message, meta_json, created_at").eq("user_id", userId).eq("agent_slug", "pierre").order("created_at", { ascending: false }).limit(dataWindow.logs_limit),
      supabaseAdmin.from("pierre_company_memory").select("id, user_id, agent_slug, reusable_rh_context_json, memory_json, created_at, updated_at").eq("user_id", userId).eq("agent_slug", "pierre").limit(1).maybeSingle(),
      Promise.resolve(null), // placeholder
    ]);

    const missions = Array.isArray(mRes.data) ? (mRes.data as DbRow[]) : [];
    const tasks = Array.isArray(tRes.data) ? (tRes.data as DbRow[]) : [];
    const documents = Array.isArray(dRes.data) ? (dRes.data as DbRow[]) : [];
    const logs = Array.isArray(lRes.data) ? (lRes.data as DbRow[]) : [];

    let employees: DbRow[] = [];
    try {
      if (memoRes.data && isObject(memoRes.data.reusable_rh_context_json)) {
        employees = sanitizePierreEmployeeList((memoRes.data.reusable_rh_context_json as Record<string, unknown>).employees) as unknown as DbRow[];
      }
    } catch (_e) { /* skip malformed row */ }

    void empRes; // unused placeholder

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

    const dashboard = buildMissionControlDashboard({
      missions, tasks, documents, logs, employeeSnapshots, feedItems: allFeedItems,
      continuityDashboard, now, maxSafeActions: 10,
    });

    const briefing = buildMissionControlBriefing({ dashboard, period, now });
    const preview = buildMissionControlPreview(dashboard);

    // Non-blocking log
    let logged = false;
    try {
      await supabaseAdmin.from("pierre_task_logs").insert({
        user_id: userId,
        agent_slug: "pierre",
        event_type: "mission_control_briefing_generated",
        message: `Briefing Mission Control généré — period: ${period}`,
        meta_json: {
          period,
          briefing_id: briefing.id,
          status: briefing.status,
          safe_actions_count: briefing.safe_actions_available.length,
          decisions_required_count: briefing.decisions_required.length,
        },
      });
      logged = true;
    } catch (_e) { /* skip malformed row */ }

    // CloneGuard evaluation over briefing safe actions
    const cgBriefingActions = Array.isArray(briefing.safe_actions_available)
      ? briefing.safe_actions_available
      : [];
    let cgBriefingBlocked = 0;
    let govBriefingBlocked = 0;
    let govBriefingAutoAllowed = 0;
    for (const a of cgBriefingActions) {
      const row = typeof a === "object" && a !== null ? (a as Record<string, unknown>) : {};
      const taskType = String(row.task_type ?? "");
      const cgEval = evaluatePierreCloneGuard({
        task_type: taskType || null,
        now: now.toISOString(),
      });
      if (cgEval.decision === "refuse" || cgEval.decision === "block") cgBriefingBlocked++;
      const govEval = evaluateGovernance({
        task_type: taskType || null,
        guard_evaluation: cgEval,
        now: now.toISOString(),
      });
      if (govEval.decision === "refuse" || govEval.decision === "block") govBriefingBlocked++;
      if (govEval.allowed_to_auto_execute) govBriefingAutoAllowed++;
    }

    return NextResponse.json({
      ok: true,
      briefing,
      preview,
      cloneguard: {
        safe_actions_evaluated: cgBriefingActions.length,
        blocked_in_safe: cgBriefingBlocked,
      },
      governance_summary: {
        safe_actions_evaluated: cgBriefingActions.length,
        blocked_in_safe: govBriefingBlocked,
        auto_allowed: govBriefingAutoAllowed,
      },
      meta: {
        canonical_route: "/api/pierre/use/mission-control/briefing",
        userId,
        fetchedAt: now.toISOString(),
        period,
        logged,
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
