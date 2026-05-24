import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sanitizePierreEmployeeList } from "../../../../../../lib/pierre/hr/employee";
import { buildEmployeeFileIndex } from "../../../../../../lib/pierre/hr/employee-file";
import { buildEmployeeActionsIndex, buildEmployeeActionSummary } from "../../../../../../lib/pierre/hr/employee-actions";

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
  return null;
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ?? {}) },
    { status },
  );
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return { message: asString(error.message) || "Unexpected database error.", code: asString(error.code) };
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
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
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
        const c = parsed.find(
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
        );
        if (c) return c;
      }
      if (isObject(parsed)) {
        const cs = isObject(parsed.currentSession) ? parsed.currentSession : null;
        const c = asString(parsed.access_token) || (cs ? asString(cs.access_token) : null);
        if (c) return c;
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
  const token = tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
  if (!token) {
    throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
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

async function fetchAllEmployees(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown>[]> {
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
    ) as unknown as Record<string, unknown>[];
  } catch {
    return [];
  }
}

async function fetchRecentMissions(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_missions")
      .select(
        "id, status, risk_level, approval_required, mission_summary, intent, created_at, updated_at, brain_output_json, context_snapshot_json",
      )
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(500);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

async function fetchRecentTasks(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_tasks")
      .select(
        "id, mission_id, type, title, status, approval_required, execute_at, created_at, updated_at, payload_json, risk_level",
      )
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(1000);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

async function fetchRecentDocuments(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_documents")
      .select("id, mission_id, task_id, doc_type, title, created_at, meta_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(500);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

async function fetchRecentLogs(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_task_logs")
      .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(500);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

// ── GET handler ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const [employees, missions, tasks, documents, logs] = await Promise.all([
      fetchAllEmployees(supabaseAdmin, userId),
      fetchRecentMissions(supabaseAdmin, userId),
      fetchRecentTasks(supabaseAdmin, userId),
      fetchRecentDocuments(supabaseAdmin, userId),
      fetchRecentLogs(supabaseAdmin, userId),
    ]);

    const index = buildEmployeeFileIndex(employees, missions, tasks, documents, logs);

    const rawEmployees = employees as unknown as Record<string, unknown>[];
    const actionsIndex = buildEmployeeActionsIndex(rawEmployees, missions, tasks);
    const allSuggestions = Object.values(actionsIndex).flatMap((p) => p.suggested_actions);
    const actionsGlobalSummary = buildEmployeeActionSummary(allSuggestions);

    return NextResponse.json({
      ok: true,
      index,
      employee_actions_index: actionsIndex,
      employee_actions_global_summary: actionsGlobalSummary,
      employee_actions_endpoint: "/api/pierre/use/employees/actions",
      meta: {
        userId,
        fetchedAt: new Date().toISOString(),
        employees_count: employees.length,
        missions_loaded: missions.length,
        tasks_loaded: tasks.length,
        documents_loaded: documents.length,
        logs_loaded: logs.length,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status as number,
        { code: asString(error.code) },
      );
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
