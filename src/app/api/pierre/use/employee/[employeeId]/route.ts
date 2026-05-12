import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
  buildEmployee360Summary,
  type PierreEmployeeProfile,
} from "../../../../../../lib/pierre/hr/employee";

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
    return {
      message: asString(error.message) || "Unexpected database error.",
      code: asString(error.code),
    };
  }
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

// ═══════════════════════════════════════════════════════════
// CLIENT SUPABASE
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
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  const cookies = request.cookies.getAll();

  for (const key of ["sb-access-token", "supabase-access-token", "access-token"]) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }

  for (const cookie of cookies) {
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
// EMPLOYEE RESOLUTION
// ═══════════════════════════════════════════════════════════

async function resolveEmployeeProfile(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
): Promise<PierreEmployeeProfile | null> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();

    if (!data || !isObject(data.reusable_rh_context_json)) return null;

    const context = data.reusable_rh_context_json as Record<string, unknown>;
    const employees = sanitizePierreEmployeeList(context.employees);

    return findPierreEmployeeById(employees, employeeId);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// 360 AGGREGATION — requêtes jsonb sans migration
// ═══════════════════════════════════════════════════════════

/**
 * Cherche les tâches Pierre dont payload_json contient l'employee_id.
 * Utilise l'opérateur @> (jsonb containment) de Postgres — pas d'index requis
 * pour les volumes actuels (<10k tasks/user).
 */
async function fetchEmployeeTasks(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
): Promise<DbRow[]> {
  try {
    // Cherche dans payload_json.employee_id (champ direct)
    const { data: direct } = await supabaseAdmin
      .from("pierre_tasks")
      .select("id, mission_id, type, title, status, approval_required, execute_at, created_at, payload_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .contains("payload_json", { employee_id: employeeId })
      .order("created_at", { ascending: false })
      .limit(100);

    // Cherche dans payload_json.employee_context.employee_id (champ structuré Bloc 4)
    const { data: nested } = await supabaseAdmin
      .from("pierre_tasks")
      .select("id, mission_id, type, title, status, approval_required, execute_at, created_at, payload_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .contains("payload_json", { employee_context: { employee_id: employeeId } })
      .order("created_at", { ascending: false })
      .limit(100);

    const directRows = (direct ?? []) as DbRow[];
    const nestedRows = (nested ?? []) as DbRow[];

    // Déduplique par id
    const seen = new Set<string>();
    const merged: DbRow[] = [];

    for (const row of [...directRows, ...nestedRows]) {
      const id = asString(row.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
    }

    return merged;
  } catch {
    return [];
  }
}

/**
 * Charge les missions liées aux tâches trouvées.
 */
async function fetchMissionsForTasks(
  supabaseAdmin: SupabaseClient,
  userId: string,
  tasks: DbRow[],
): Promise<DbRow[]> {
  if (!tasks.length) return [];

  const missionIds = [
    ...new Set(
      tasks
        .map((t) => asString(t.mission_id))
        .filter((id): id is string => id !== null),
    ),
  ].slice(0, 50);

  if (!missionIds.length) return [];

  try {
    const { data } = await supabaseAdmin
      .from("pierre_missions")
      .select("id, status, understanding_status, risk_level, approval_required, mission_summary, created_at, brain_output_json")
      .eq("user_id", userId)
      .in("id", missionIds)
      .order("created_at", { ascending: false });

    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

/**
 * Charge les documents Pierre liés aux missions de l'employé.
 */
async function fetchDocumentsForMissions(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missions: DbRow[],
): Promise<DbRow[]> {
  if (!missions.length) return [];

  const missionIds = missions
    .map((m) => asString(m.id))
    .filter((id): id is string => id !== null)
    .slice(0, 50);

  if (!missionIds.length) return [];

  try {
    const { data } = await supabaseAdmin
      .from("pierre_documents")
      .select("id, mission_id, task_id, doc_type, title, source_kind, created_at")
      .eq("user_id", userId)
      .in("mission_id", missionIds)
      .order("created_at", { ascending: false })
      .limit(100);

    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

/**
 * Fetches logs linked to an employee — by meta_json containment OR by mission membership.
 */
async function fetchEmployeeLogs(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
  missionIds: string[],
): Promise<DbRow[]> {
  try {
    const { data: direct } = await supabaseAdmin
      .from("pierre_task_logs")
      .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .contains("meta_json", { employee_id: employeeId })
      .order("created_at", { ascending: false })
      .limit(100);

    const directRows = (direct ?? []) as DbRow[];

    if (!missionIds.length) return directRows.slice(0, 100);

    const { data: byMission } = await supabaseAdmin
      .from("pierre_task_logs")
      .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .in("mission_id", missionIds.slice(0, 50))
      .order("created_at", { ascending: false })
      .limit(100);

    const byMissionRows = (byMission ?? []) as DbRow[];

    const seen = new Set<string>();
    const merged: DbRow[] = [];

    for (const row of [...directRows, ...byMissionRows]) {
      const id = asString(row.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row);
    }

    return merged.slice(0, 100);
  } catch {
    return [];
  }
}

type TimelineItem = {
  type: "mission" | "task" | "document" | "log";
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  source_table: string;
};

/**
 * Merges missions, tasks, documents and logs into a single chronological timeline.
 */
function buildTimeline(
  missions: DbRow[],
  tasks: DbRow[],
  documents: DbRow[],
  logs: DbRow[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...missions.map((m) => ({
      type: "mission" as const,
      id: asString(m.id) ?? "",
      title: asString(m.mission_summary) ?? asString(m.raw_input) ?? null,
      status: asString(m.status),
      created_at: asString(m.created_at),
      source_table: "pierre_missions",
    })),
    ...tasks.map((t) => ({
      type: "task" as const,
      id: asString(t.id) ?? "",
      title: asString(t.title),
      status: asString(t.status),
      created_at: asString(t.created_at),
      source_table: "pierre_tasks",
    })),
    ...documents.map((d) => ({
      type: "document" as const,
      id: asString(d.id) ?? "",
      title: asString(d.title),
      status: null,
      created_at: asString(d.created_at),
      source_table: "pierre_documents",
    })),
    ...logs.map((l) => ({
      type: "log" as const,
      id: asString(l.id) ?? "",
      title: asString(l.message),
      status: null,
      created_at: asString(l.created_at),
      source_table: "pierre_task_logs",
    })),
  ];

  return items
    .filter((item) => item.id)
    .sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
}

// ═══════════════════════════════════════════════════════════
// GET HANDLER
// ═══════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const { employeeId } = await params;

    if (!employeeId || !employeeId.trim()) {
      return jsonError("Employee ID is required.", 400, { code: "EMPLOYEE_ID_REQUIRED" });
    }

    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError(
        "Accès Pierre requis.",
        403,
        { code: "PIERRE_ACCESS_DENIED" },
      );
    }

    const employee = await resolveEmployeeProfile(supabaseAdmin, userId, employeeId);

    if (!employee) {
      return jsonError(
        `Aucun profil salarié trouvé pour l'identifiant : ${employeeId}`,
        404,
        { code: "EMPLOYEE_NOT_FOUND" },
      );
    }

    const tasks = await fetchEmployeeTasks(supabaseAdmin, userId, employeeId);
    const missions = await fetchMissionsForTasks(supabaseAdmin, userId, tasks);
    const documents = await fetchDocumentsForMissions(supabaseAdmin, userId, missions);

    const missionIds = missions
      .map((m) => asString(m.id))
      .filter((id): id is string => id !== null);

    const logs = await fetchEmployeeLogs(supabaseAdmin, userId, employeeId, missionIds);
    const summary = buildEmployee360Summary(employee, missions, tasks, documents, logs);
    const timeline = buildTimeline(missions, tasks, documents, logs);

    return NextResponse.json({
      ok: true,
      employee,
      missions,
      tasks,
      documents,
      logs: logs.slice(0, 100),
      summary,
      timeline,
      meta: {
        employeeId,
        userId,
        fetchedAt: new Date().toISOString(),
        counts: {
          missions: missions.length,
          tasks: tasks.length,
          documents: documents.length,
          logs: logs.length,
          timeline_items: timeline.length,
        },
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
