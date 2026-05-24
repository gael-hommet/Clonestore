import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildPierreDemoScenarios,
  buildPierreReleaseReport,
  type PierreDemoScenarioKey,
} from "../../../../../../../lib/pierre/hr/release-proof";
import {
  buildEmployeeFile360,
} from "../../../../../../../lib/pierre/hr/employee-file";
import {
  sanitizePierreEmployeeList,
} from "../../../../../../../lib/pierre/hr/employee";

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

const VALID_SCENARIO_KEYS = new Set<PierreDemoScenarioKey>([
  "hiring_full_cycle",
  "absence_followup",
  "contract_and_pdf",
  "employee_file_review",
  "sensitive_case_blocked",
  "continuity_recovery",
  "prepay_summary",
  "offboarding_controlled",
]);

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

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 1 || v === "true" || v === "1") return true;
  if (v === 0 || v === "false" || v === "0") return false;
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

export async function POST(request: NextRequest) {
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

  // Parse body
  let body: Record<string, unknown> = {};
  try {
    const raw: unknown = await request.json();
    if (isObject(raw)) body = raw;
  } catch {
    // empty body is fine
  }

  const scenarioKeyRaw = asString(body["scenario_key"]);
  const includePrompt = asBool(body["include_prompt"]) ?? false;

  // Validate scenario_key if provided
  if (scenarioKeyRaw !== null && !VALID_SCENARIO_KEYS.has(scenarioKeyRaw as PierreDemoScenarioKey)) {
    return jsonError(
      `Invalid scenario_key '${scenarioKeyRaw}'. Valid keys: ${[...VALID_SCENARIO_KEYS].join(", ")}.`,
      400,
      { code: "INVALID_SCENARIO_KEY" },
    );
  }

  const scenarioKey = scenarioKeyRaw as PierreDemoScenarioKey | null;

  try {
    const now = new Date();

    // Load data (parallel)
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
      .select("*")
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
      .select("*")
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

    // Extract employees
    const rrh = isObject(companyMemory)
      ? (isObject(companyMemory["reusable_rh_context_json"])
          ? (companyMemory["reusable_rh_context_json"] as Record<string, unknown>)
          : null)
      : null;
    const rawEmployees = Array.isArray(rrh?.["employees"]) ? rrh!["employees"] : [];
    const employees = sanitizePierreEmployeeList(rawEmployees).filter(isObject);

    // Build employee files
    const employeeFiles: unknown[] = [];
    for (const empRow of employees.slice(0, 20)) {
      try {
        const file = buildEmployeeFile360({ employee: empRow, missions, tasks, documents, logs });
        employeeFiles.push(file);
      } catch {
        // best-effort
      }
    }

    const documentSystemConfig = rrh
      ? (isObject(rrh["document_system"]) ? (rrh["document_system"] as Record<string, unknown>) : null)
      : null;

    const evalParams = {
      missions,
      tasks,
      documents,
      logs,
      companyMemory: isObject(companyMemory) ? companyMemory : null,
      documentSystemConfig,
      employeeFiles,
      employees,
    };

    // Build full report to get evaluations
    const fullReport = buildPierreReleaseReport(evalParams);

    // Filter to requested scenario(s)
    const evaluations = scenarioKey
      ? fullReport.demo_scenarios.filter((e) => e.scenario_key === scenarioKey)
      : fullReport.demo_scenarios;

    // Optionally include scenario prompts
    let prompts: Record<string, string> | undefined;
    if (includePrompt) {
      const allScenarios = buildPierreDemoScenarios();
      const targetScenarios = scenarioKey
        ? allScenarios.filter((s) => s.key === scenarioKey)
        : allScenarios;
      prompts = {};
      for (const s of targetScenarios) {
        prompts[s.key] = s.prompt;
      }
    }

    return NextResponse.json({
      ok: true,
      scenario_key: scenarioKey ?? "all",
      evaluations,
      ...(prompts !== undefined ? { prompts } : {}),
      meta: {
        dry_run: true,
        userId,
        fetchedAt: now.toISOString(),
        missions_loaded: missions.length,
        tasks_loaded: tasks.length,
        documents_loaded: documents.length,
        logs_loaded: logs.length,
        scenarios_evaluated: evaluations.length,
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
