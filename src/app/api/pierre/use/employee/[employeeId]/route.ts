import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
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
      .select("memory_json")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data || !isObject(data.memory_json)) return null;

    const memoryJson = data.memory_json as Record<string, unknown>;
    const employees = sanitizePierreEmployeeList(memoryJson.employees);

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
 * Construit un résumé 360 calculé à la volée.
 */
function buildSummary(
  employee: PierreEmployeeProfile,
  missions: DbRow[],
  tasks: DbRow[],
  documents: DbRow[],
): Record<string, unknown> {
  const tasksByStatus = tasks.reduce<Record<string, number>>((acc, t) => {
    const s = asString(t.status) ?? "unknown";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const pendingApproval = tasks.filter((t) => t.approval_required === true && t.status === "awaiting_approval").length;

  return {
    employee_name: employee.full_name,
    employee_status: employee.status,
    contract_type: employee.contract_type ?? null,
    department: employee.department ?? null,
    total_missions: missions.length,
    total_tasks: tasks.length,
    total_documents: documents.length,
    tasks_by_status: tasksByStatus,
    tasks_pending_approval: pendingApproval,
    last_mission_at: missions[0] ? asString(missions[0].created_at) : null,
    last_task_at: tasks[0] ? asString(tasks[0].created_at) : null,
    last_document_at: documents[0] ? asString(documents[0].created_at) : null,
  };
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
    const summary = buildSummary(employee, missions, tasks, documents);

    return NextResponse.json({
      ok: true,
      employee,
      missions,
      tasks,
      documents,
      summary,
      meta: {
        employeeId,
        userId,
        fetchedAt: new Date().toISOString(),
        counts: {
          missions: missions.length,
          tasks: tasks.length,
          documents: documents.length,
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
