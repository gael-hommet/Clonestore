import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sanitizePierreEmployeeList } from "../../../../../../lib/pierre/hr/employee";
import {
  getEmployeeActionCatalog,
  buildEmployeeActionPlan,
  buildEmployeeActionSummary,
  buildEmployeeActionsIndex,
  filterEmployeeActionsByGovernance,
  filterEmployeeActionsByRisk,
  type PierreEmployeeActionGovernance,
  type PierreEmployeeActionRisk,
} from "../../../../../../lib/pierre/hr/employee-actions";

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

async function loadEmployees(supabaseAdmin: SupabaseClient, userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();
    if (!data || !isObject(data.reusable_rh_context_json)) return [];
    return sanitizePierreEmployeeList(
      (data.reusable_rh_context_json as Record<string, unknown>).employees,
    );
  } catch { return []; }
}

async function fetchAllTasks(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_tasks")
      .select("id, mission_id, type, title, status, approval_required, execute_at, created_at, payload_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(500);
    return (data ?? []) as DbRow[];
  } catch { return []; }
}

async function fetchAllMissions(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_missions")
      .select("id, status, mission_summary, intent, created_at")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(300);
    return (data ?? []) as DbRow[];
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────
// GET /api/pierre/use/employees/actions
// ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const url = new URL(request.url);
    const governanceFilter = asString(url.searchParams.get("governance")) as PierreEmployeeActionGovernance | null;
    const riskFilter = asString(url.searchParams.get("risk")) as PierreEmployeeActionRisk | null;
    const includeCatalog = asBool(url.searchParams.get("catalog") ?? "false");

    const now = new Date();

    const [employees, allTasks, allMissions] = await Promise.all([
      loadEmployees(supabaseAdmin, userId),
      fetchAllTasks(supabaseAdmin, userId),
      fetchAllMissions(supabaseAdmin, userId),
    ]);

    const rawEmployees = employees as unknown as Record<string, unknown>[];
    const actionsIndex = buildEmployeeActionsIndex(rawEmployees, allMissions, allTasks);

    // Build aggregate summary across all employees
    let totalAutoSafe = 0;
    let totalApprovalRequired = 0;
    let totalManualOnly = 0;
    let totalBlocked = 0;
    let hasSensitive = false;

    const perEmployee = Object.entries(actionsIndex).map(([empId, plan]) => {
      let suggestions = plan.suggested_actions;
      if (governanceFilter) suggestions = filterEmployeeActionsByGovernance(suggestions, governanceFilter);
      if (riskFilter) suggestions = filterEmployeeActionsByRisk(suggestions, riskFilter);
      const summary = buildEmployeeActionSummary(suggestions);
      totalAutoSafe += summary.auto_safe;
      totalApprovalRequired += summary.approval_required;
      totalManualOnly += summary.manual_only;
      totalBlocked += summary.blocked;
      if (summary.has_sensitive) hasSensitive = true;
      return { employee_id: empId, employee_name: plan.employee_name, plan: { ...plan, suggested_actions: suggestions }, summary };
    });

    const globalSummary = {
      total_employees: employees.length,
      employees_with_actions: perEmployee.filter((e) => e.summary.total_actions > 0).length,
      total_auto_safe: totalAutoSafe,
      total_approval_required: totalApprovalRequired,
      total_manual_only: totalManualOnly,
      total_blocked: totalBlocked,
      has_sensitive: hasSensitive,
    };

    // Urgent employees: those with manual_only or approval_required actions
    const urgentEmployees = perEmployee
      .filter((e) => e.summary.approval_required > 0 || e.summary.manual_only > 0)
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      global_summary: globalSummary,
      urgent_employees: urgentEmployees,
      employees_actions: perEmployee,
      catalog: includeCatalog ? getEmployeeActionCatalog() : undefined,
      meta: {
        userId,
        fetchedAt: now.toISOString(),
        employees_loaded: employees.length,
        tasks_loaded: allTasks.length,
        missions_loaded: allMissions.length,
        filters_applied: { governance: governanceFilter, risk: riskFilter },
        employee_actions_endpoint: "/api/pierre/use/employees/actions",
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
// POST /api/pierre/use/employees/actions
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    let body: unknown;
    try { body = await request.json(); } catch { body = {}; }

    const rawEmployeeId = isObject(body) ? asString(body.employee_id) : null;
    if (!rawEmployeeId) return jsonError("employee_id requis.", 400, { code: "EMPLOYEE_ID_REQUIRED" });

    const now = new Date();

    const employees = await loadEmployees(supabaseAdmin, userId);
    const rawEmployees = employees as unknown as Record<string, unknown>[];

    const targetEmployee = rawEmployees.find((e) => asString(e.id) === rawEmployeeId);
    if (!targetEmployee) return jsonError("Salarié introuvable.", 404, { code: "EMPLOYEE_NOT_FOUND" });

    const allTasks = await fetchAllTasks(supabaseAdmin, userId);
    const allMissions = await fetchAllMissions(supabaseAdmin, userId);

    const plan = buildEmployeeActionPlan(targetEmployee, allMissions, allTasks, now);
    const summary = buildEmployeeActionSummary(plan.suggested_actions);

    return NextResponse.json({
      ok: true,
      employee_id: rawEmployeeId,
      employee_name: asString(targetEmployee.full_name),
      plan,
      summary,
      meta: {
        userId,
        generatedAt: now.toISOString(),
        employee_actions_endpoint: `/api/pierre/use/employee/${rawEmployeeId}/actions`,
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
