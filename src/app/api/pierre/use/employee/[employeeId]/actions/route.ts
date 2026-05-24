import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
} from "../../../../../../../lib/pierre/hr/employee";
import {
  getEmployeeActionCatalog,
  getEmployeeActionById,
  buildEmployeeActionSuggestions,
  buildEmployeeActionPlan,
  buildEmployeeActionSummary,
  buildEmployeeActionTaskDraft,
  resolveEmployeeActionResult,
  buildEmployeeActionTrace,
  buildEmployeeActionAuditMeta,
} from "../../../../../../../lib/pierre/hr/employee-actions";

// ── Types ──────────────────────────────────────────────────

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

// ── Helpers ────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
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

// ── Supabase ───────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured.");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── Auth ───────────────────────────────────────────────────

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

// ── Data fetching ──────────────────────────────────────────

async function resolveEmployee(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
) {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();
    if (!data || !isObject(data.reusable_rh_context_json)) return null;
    const employees = sanitizePierreEmployeeList(
      (data.reusable_rh_context_json as Record<string, unknown>).employees,
    );
    return findPierreEmployeeById(employees, employeeId);
  } catch { return null; }
}

async function fetchEmployeeTasks(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
): Promise<DbRow[]> {
  try {
    const [{ data: direct }, { data: nested }] = await Promise.all([
      supabaseAdmin
        .from("pierre_tasks")
        .select("id, mission_id, type, title, status, approval_required, execute_at, created_at, payload_json")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .contains("payload_json", { employee_id: employeeId })
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("pierre_tasks")
        .select("id, mission_id, type, title, status, approval_required, execute_at, created_at, payload_json")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .contains("payload_json", { employee_context: { employee_id: employeeId } })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    const seen = new Set<string>();
    const merged: DbRow[] = [];
    for (const row of [...(direct ?? []), ...(nested ?? [])]) {
      const id = asString((row as DbRow).id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row as DbRow);
    }
    return merged;
  } catch { return []; }
}

async function fetchEmployeeMissions(
  supabaseAdmin: SupabaseClient,
  userId: string,
  tasks: DbRow[],
): Promise<DbRow[]> {
  if (!tasks.length) return [];
  const missionIds = [
    ...new Set(
      tasks.map((t) => asString(t.mission_id)).filter((id): id is string => id !== null),
    ),
  ].slice(0, 50);
  if (!missionIds.length) return [];
  try {
    const { data } = await supabaseAdmin
      .from("pierre_missions")
      .select("id, status, mission_summary, intent, created_at")
      .eq("user_id", userId)
      .in("id", missionIds)
      .order("created_at", { ascending: false });
    return (data ?? []) as DbRow[];
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────
// GET /api/pierre/use/employee/[employeeId]/actions
// ─────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const { employeeId } = await params;
    if (!employeeId) return jsonError("Employee ID requis.", 400, { code: "EMPLOYEE_ID_REQUIRED" });

    const url = new URL(request.url);
    const domainFilter = asString(url.searchParams.get("domain"));
    const governanceFilter = asString(url.searchParams.get("governance"));
    const includeAll = asBool(url.searchParams.get("include_all"));

    const employee = await resolveEmployee(supabaseAdmin, userId, employeeId);
    if (!employee) return jsonError("Salarié introuvable.", 404, { code: "EMPLOYEE_NOT_FOUND" });

    const now = new Date();
    const tasks = await fetchEmployeeTasks(supabaseAdmin, userId, employeeId);
    const missions = await fetchEmployeeMissions(supabaseAdmin, userId, tasks);

    const plan = buildEmployeeActionPlan(employee, missions, tasks, now);
    const summary = buildEmployeeActionSummary(plan.suggested_actions);

    let suggestions = plan.suggested_actions;
    if (domainFilter) suggestions = suggestions.filter((s) => s.domain === domainFilter);
    if (governanceFilter) suggestions = suggestions.filter((s) => s.governance === governanceFilter);

    const catalog = includeAll ? getEmployeeActionCatalog() : null;

    return NextResponse.json({
      ok: true,
      employee_id: employeeId,
      employee_name: employee.full_name,
      plan: {
        ...plan,
        suggested_actions: suggestions,
      },
      summary,
      catalog: catalog ?? undefined,
      meta: {
        userId,
        fetchedAt: now.toISOString(),
        tasks_loaded: tasks.length,
        missions_loaded: missions.length,
        suggestions_total: plan.suggested_actions.length,
        filters_applied: { domain: domainFilter, governance: governanceFilter },
        employee_actions_endpoint: `/api/pierre/use/employee/${employeeId}/actions`,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code), details: isObject(error.details) ? error.details : null,
      });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/pierre/use/employee/[employeeId]/actions
// ─────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const { employeeId } = await params;
    if (!employeeId) return jsonError("Employee ID requis.", 400, { code: "EMPLOYEE_ID_REQUIRED" });

    let body: unknown;
    try { body = await request.json(); } catch { body = {}; }

    const rawActionType = isObject(body) ? asString(body.action_type) : null;
    if (!rawActionType) return jsonError("action_type requis.", 400, { code: "ACTION_TYPE_REQUIRED" });

    const catalogItem = getEmployeeActionById(rawActionType);
    if (!catalogItem) return jsonError(`Action inconnue : "${rawActionType}".`, 400, { code: "UNKNOWN_ACTION_TYPE" });

    const dryRun = isObject(body) ? asBool(body.dry_run ?? true) : true;
    const bodyContext = isObject(body) && isObject(body.context) ? body.context : {};

    const employee = await resolveEmployee(supabaseAdmin, userId, employeeId);
    if (!employee) return jsonError("Salarié introuvable.", 404, { code: "EMPLOYEE_NOT_FOUND" });

    const now = new Date();

    const actionContext = {
      employee_id: employee.id,
      employee_name: employee.full_name,
      department: employee.department ?? null,
      contract_type: employee.contract_type ?? null,
      status: employee.status ?? null,
      action_type: rawActionType,
      meta: bodyContext,
    };

    const result = resolveEmployeeActionResult(rawActionType, actionContext);

    // Blocked/manual_only actions cannot be created automatically
    if (result.governance === "blocked") {
      return NextResponse.json({
        ok: false,
        action_type: rawActionType,
        governance: "blocked",
        allowed_to_auto_execute: false,
        explanation: result.explanation,
        task_created: null,
        dry_run: dryRun,
        meta: { userId, generatedAt: now.toISOString() },
      });
    }

    if (result.governance === "manual_only") {
      const trace = buildEmployeeActionTrace(rawActionType, employeeId, { dry_run: dryRun }, now);
      void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert({
        user_id: userId,
        agent_slug: "pierre",
        event_type: "human_action_required",
        message: `Action manuelle requise : ${catalogItem.label_fr} pour ${employee.full_name}.`,
        meta_json: buildEmployeeActionAuditMeta(rawActionType, employeeId, result.governance, result.risk),
        created_at: now.toISOString(),
      })).catch(() => {});
      return NextResponse.json({
        ok: false,
        action_type: rawActionType,
        governance: "manual_only",
        allowed_to_auto_execute: false,
        explanation: result.explanation,
        task_created: null,
        trace,
        dry_run: dryRun,
        meta: { userId, generatedAt: now.toISOString() },
      });
    }

    const taskDraft = buildEmployeeActionTaskDraft(rawActionType, actionContext);

    if (dryRun) {
      const trace = buildEmployeeActionTrace(rawActionType, employeeId, { dry_run: true }, now);
      return NextResponse.json({
        ok: true,
        action_type: rawActionType,
        governance: result.governance,
        allowed_to_auto_execute: result.allowed_to_auto_execute,
        explanation: result.explanation,
        task_draft: taskDraft,
        task_created: null,
        trace,
        dry_run: true,
        meta: { userId, generatedAt: now.toISOString() },
      });
    }

    // Create the task in DB
    const { data: createdTask, error: taskError } = await supabaseAdmin
      .from("pierre_tasks")
      .insert({
        user_id: userId,
        agent_slug: "pierre",
        type: taskDraft.type,
        title: taskDraft.title,
        status: taskDraft.status,
        approval_required: taskDraft.approval_required,
        execute_at: taskDraft.execute_at,
        payload_json: taskDraft.payload_json,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("id")
      .single();

    if (taskError || !createdTask) {
      const mapped = mapDbError(taskError);
      return jsonError(`Impossible de créer la tâche : ${mapped.message}`, 500, { code: "TASK_CREATE_FAILED" });
    }

    const taskId = asString(createdTask.id);
    const trace = buildEmployeeActionTrace(rawActionType, employeeId, { task_id: taskId }, now);

    // Non-blocking audit log
    void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert({
      user_id: userId,
      agent_slug: "pierre",
      task_id: taskId,
      event_type: "task_created",
      message: `Action RH créée : ${catalogItem.label_fr} pour ${employee.full_name}.`,
      meta_json: buildEmployeeActionAuditMeta(rawActionType, employeeId, result.governance, result.risk),
      created_at: now.toISOString(),
    })).catch(() => {});

    return NextResponse.json({
      ok: true,
      action_type: rawActionType,
      governance: result.governance,
      allowed_to_auto_execute: result.allowed_to_auto_execute,
      explanation: result.explanation,
      task_created: { id: taskId, ...taskDraft },
      trace,
      dry_run: false,
      meta: { userId, generatedAt: now.toISOString() },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code), details: isObject(error.details) ? error.details : null,
      });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
