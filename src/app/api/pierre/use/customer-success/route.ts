import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildPierreCustomerSuccessReport,
} from "../../../../../lib/pierre/hr/customer-success";
import {
  buildPierreTrialActivationReport,
} from "../../../../../lib/pierre/hr/trial-activation";
import {
  buildPierreReleaseReport,
} from "../../../../../lib/pierre/hr/release-proof";
import {
  buildPierreReadinessReport,
} from "../../../../../lib/pierre/hr/operational-readiness";
import {
  buildEmployeeFile360,
} from "../../../../../lib/pierre/hr/employee-file";
import {
  sanitizePierreEmployeeList,
} from "../../../../../lib/pierre/hr/employee";

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

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

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
          (item): item is string => typeof item === "string" && item.split(".").length === 3,
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
  const accessToken = tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
  if (!accessToken) {
    throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  }
  return data.user.id;
}

async function hasPierreAccess(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .eq("status", "active")
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

function mapDbError(error: unknown): { message: string; code: string; details: unknown } {
  if (isObject(error)) {
    return {
      message: asString(error.message) || "Database error.",
      code: asString(error.code) || "DB_ERROR",
      details: error.details ?? null,
    };
  }
  return { message: "Unexpected error.", code: "UNKNOWN", details: null };
}

async function loadAllData(supabaseAdmin: SupabaseClient, userId: string) {
  const loadCompanyMemory = supabaseAdmin
    .from("pierre_company_memory")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .limit(1)
    .then(({ data }) => (Array.isArray(data) && data.length > 0 ? (data[0] as DbRow) : null));

  const loadMissions = supabaseAdmin
    .from("pierre_missions")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(500)
    .then(({ data }) => (Array.isArray(data) ? (data as DbRow[]) : []));

  const loadTasks = supabaseAdmin
    .from("pierre_tasks")
    .select("id, mission_id, type, title, status, approval_required, execute_at, created_at, updated_at, payload_json, risk_level")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(1000)
    .then(({ data }) => (Array.isArray(data) ? (data as DbRow[]) : []));

  const loadDocuments = supabaseAdmin
    .from("pierre_documents")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(500)
    .then(({ data }) => (Array.isArray(data) ? (data as DbRow[]) : []));

  const loadLogs = supabaseAdmin
    .from("pierre_task_logs")
    .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
    .eq("user_id", userId)
    .eq("agent_slug", "pierre")
    .order("created_at", { ascending: false })
    .limit(1000)
    .then(({ data }) => (Array.isArray(data) ? (data as DbRow[]) : []));

  const [companyMemory, missions, tasks, documents, logs] = await Promise.all([
    loadCompanyMemory,
    loadMissions,
    loadTasks,
    loadDocuments,
    loadLogs,
  ]);

  return { companyMemory, missions, tasks, documents, logs };
}

export async function GET(request: NextRequest) {
  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return jsonError("Server configuration error.", 500, { code: "CONFIG_ERROR" });
  }

  let userId: string;
  try {
    userId = await authenticateRequest(request, supabaseAdmin);
  } catch (e) {
    if (isObject(e) && typeof e.status === "number") {
      return jsonError(asString(e.message) || "Auth error.", e.status, { code: asString(e.code) });
    }
    return jsonError("Auth error.", 401, { code: "AUTH_ERROR" });
  }

  const hasAccess = await hasPierreAccess(supabaseAdmin, userId);
  if (!hasAccess) {
    return jsonError("Pierre access required.", 403, { code: "PIERRE_ACCESS_DENIED" });
  }

  try {
    const now = new Date();

    const { companyMemory, missions, tasks, documents, logs } = await loadAllData(supabaseAdmin, userId);

    const rrh = isObject(companyMemory)
      ? (isObject(companyMemory["reusable_rh_context_json"])
          ? (companyMemory["reusable_rh_context_json"] as DbRow)
          : null)
      : null;
    const rawEmployees = Array.isArray(rrh?.["employees"]) ? rrh!["employees"] : [];
    const employees = sanitizePierreEmployeeList(rawEmployees).filter(isObject);

    const employeeFiles: unknown[] = [];
    let employeeFilesBuilt = 0;
    for (const empRow of employees.slice(0, 20)) {
      try {
        const file = buildEmployeeFile360({ employee: empRow, missions, tasks, documents, logs });
        employeeFiles.push(file);
        employeeFilesBuilt++;
      } catch {
        // best-effort
      }
    }

    const documentSystemConfig = rrh
      ? (isObject(rrh["document_system"]) ? (rrh["document_system"] as DbRow) : null)
      : null;

    // trialReport (best-effort)
    let trialReport: unknown = null;
    let trialAvailable = false;
    try {
      trialReport = buildPierreTrialActivationReport({
        companyMemory: isObject(companyMemory) ? companyMemory : null,
        missions,
        tasks,
        documents,
        logs,
        employees,
        employeeFiles,
        now,
      });
      trialAvailable = true;
    } catch {
      // best-effort
    }

    // releaseReport (best-effort)
    let releaseReport: unknown = null;
    let releaseAvailable = false;
    try {
      releaseReport = buildPierreReleaseReport({
        missions,
        tasks,
        documents,
        logs,
        companyMemory: isObject(companyMemory) ? companyMemory : null,
        documentSystemConfig,
        employeeFiles,
        employees,
      });
      releaseAvailable = true;
    } catch {
      // best-effort
    }

    // readinessReport (best-effort)
    let readinessReport: unknown = null;
    let readinessAvailable = false;
    try {
      readinessReport = buildPierreReadinessReport({
        missions,
        tasks,
        documents,
        logs,
        employees,
        employeeFiles,
        companyMemory: isObject(companyMemory) ? companyMemory : null,
        documentSystemConfig,
        now,
      });
      readinessAvailable = true;
    } catch {
      // best-effort
    }

    const report = buildPierreCustomerSuccessReport({
      companyMemory: isObject(companyMemory) ? companyMemory : null,
      missions,
      tasks,
      documents,
      logs,
      employees,
      employeeFiles,
      trialReport,
      releaseReport,
      readinessReport,
      now,
    });

    return NextResponse.json({
      ok: true,
      report,
      meta: {
        userId,
        fetchedAt: now.toISOString(),
        missions_loaded: missions.length,
        tasks_loaded: tasks.length,
        documents_loaded: documents.length,
        logs_loaded: logs.length,
        employees_loaded: employees.length,
        employee_files_built: employeeFilesBuilt,
        trial_available: trialAvailable,
        release_available: releaseAvailable,
        readiness_available: readinessAvailable,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status,
        { code: asString(error.code), details: error.details ?? null },
      );
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code, details: mapped.details });
  }
}
