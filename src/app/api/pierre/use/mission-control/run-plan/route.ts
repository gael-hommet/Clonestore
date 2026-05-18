import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionControlActionFromTask,
  buildMissionControlRunPlan,
  buildMissionControlScaleProfile,
  buildMissionControlDataWindow,
  sortMissionControlActions,
} from "../../../../../../lib/pierre/hr/mission-control";
import {
  evaluatePierreCloneGuard,
  applyCloneGuardToTask,
} from "../../../../../../lib/pierre/hr/cloneguard";
import {
  evaluateGovernance,
  applyGovernanceToTask,
} from "../../../../../../lib/pierre/hr/governance";
import {
  buildAuditTrailEvents,
  buildAuditTrailDiagnostics,
  scoreAuditTrailHealth,
  buildAuditTrailDigest,
  buildAuditTrailAlerts,
} from "../../../../../../lib/pierre/hr/audit-trail";

const HARD_MAX_TASKS = 10;

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
function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "1";
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

// ── GET /api/pierre/use/mission-control/run-plan ──────────

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const url = new URL(request.url);
    const rawMax = parseInt(url.searchParams.get("max") ?? "5", 10);
    const maxTasks = Number.isFinite(rawMax) ? Math.min(Math.max(rawMax, 1), HARD_MAX_TASKS) : 5;
    const dryRun = url.searchParams.get("dry_run") !== "false";

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
    const runPlan = buildMissionControlRunPlan(sortedActions, maxTasks, dryRun);

    // CloneGuard + Governance annotation — each action flagged with both evaluations
    let cgBlockedCount = 0;
    let govBlockedCount = 0;
    const cgAnnotatedActions = sortedActions.map((a) => {
      const taskRow = tasks.find((t) => asString(t.id) === a.task_id);
      const cgEval = evaluatePierreCloneGuard({
        task_type: asString(taskRow?.type ?? a.task_id),
        task_title: asString(taskRow?.title ?? null),
        approval_required:
          taskRow?.approval_required === true ||
          taskRow?.approval_required === "true" ||
          asBool(taskRow?.approval_required),
        now: now.toISOString(),
      });
      if (cgEval.decision === "refuse" || cgEval.decision === "block") cgBlockedCount++;
      const withCg = applyCloneGuardToTask(a as Record<string, unknown>, cgEval);
      const govEval = evaluateGovernance({
        task_type: asString(taskRow?.type ?? a.task_id),
        task_title: asString(taskRow?.title ?? null),
        approval_required:
          taskRow?.approval_required === true ||
          taskRow?.approval_required === "true" ||
          asBool(taskRow?.approval_required),
        guard_evaluation: cgEval,
        now: now.toISOString(),
      });
      if (govEval.decision === "refuse" || govEval.decision === "block") govBlockedCount++;
      return applyGovernanceToTask(withCg, govEval);
    });

    const rpAuditEvents = buildAuditTrailEvents({ tasks });
    const rpAuditDiag = buildAuditTrailDiagnostics(rpAuditEvents);
    const rpAuditHealth = scoreAuditTrailHealth(rpAuditEvents);
    const rpAuditDigest = buildAuditTrailDigest(rpAuditEvents);
    const rpAuditAlerts = buildAuditTrailAlerts(rpAuditEvents);

    return NextResponse.json({
      ok: true,
      run_plan: runPlan,
      actions: cgAnnotatedActions,
      cloneguard_summary: {
        evaluated: cgAnnotatedActions.length,
        blocked: cgBlockedCount,
        safe: cgAnnotatedActions.length - cgBlockedCount,
      },
      governance_summary: {
        evaluated: cgAnnotatedActions.length,
        blocked: govBlockedCount,
        auto_allowed: cgAnnotatedActions.length - govBlockedCount,
      },
      audit_trail_summary: {
        diagnostics: rpAuditDiag,
        health: rpAuditHealth,
        digest: rpAuditDigest,
        alerts_count: rpAuditAlerts.length,
        critical_count: rpAuditDiag.critical_count,
        human_required_count: rpAuditDiag.human_required_count,
      },
      scale_profile: scaleProfile,
      meta: {
        canonical_route: "/api/pierre/use/mission-control/run-plan",
        compatibility_route: "/api/pierre/use/dashboard/run-plan",
        userId,
        fetchedAt: now.toISOString(),
        tasks_loaded: tasks.length,
        actions_evaluated: actions.length,
        max_tasks: maxTasks,
        dry_run: dryRun,
        hard_max_tasks: HARD_MAX_TASKS,
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
