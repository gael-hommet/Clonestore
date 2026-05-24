import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildPierreGoldenScenarios,
  evaluateGoldenScenario,
  type PierreGoldenScenarioKey,
} from "../../../../../../../lib/pierre/hr/operational-readiness";
import {
  sanitizePierreEmployeeList,
} from "../../../../../../../lib/pierre/hr/employee";
import {
  buildEmployeeFile360,
} from "../../../../../../../lib/pierre/hr/employee-file";

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

const VALID_SCENARIO_KEYS = new Set<PierreGoldenScenarioKey>([
  "hiring_onboarding",
  "absence_management",
  "contract_generation",
  "prepay_preparation",
  "offboarding",
  "sensitive_hr_case",
  "multi_site_reporting",
  "employee_file_review",
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

async function authenticateRequest(request: NextRequest, supabaseAdmin: SupabaseClient): Promise<string> {
  const accessToken = tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
  if (!accessToken) throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
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
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

async function loadCompanyMemory(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow | null> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .limit(1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

async function loadMissions(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_missions")
      .select("*")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(500);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

async function loadTasks(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(1000);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

async function loadDocuments(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_documents")
      .select("*")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(500);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

async function loadLogs(supabaseAdmin: SupabaseClient, userId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_task_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .order("created_at", { ascending: false })
      .limit(1000);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

// ── POST /api/pierre/use/readiness/scenarios/dry-run ─────

export async function POST(request: NextRequest) {
  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return jsonError("Server configuration error.", 500, { code: "CONFIG_ERROR" });
  }

  try {
    const userId = await authenticateRequest(request, supabaseAdmin);

    const hasAccess = await hasPierreAccess(supabaseAdmin, userId);
    if (!hasAccess) {
      return jsonError("Pierre access required.", 403, { code: "PIERRE_ACCESS_REQUIRED" });
    }

    // Parse body
    let body: { scenario_key?: string; include_prompt?: boolean } = {};
    try {
      body = await request.json() as typeof body;
    } catch {
      // empty body is ok
    }

    const requestedKey = asString(body.scenario_key) as PierreGoldenScenarioKey | null;
    const includePrompt = body.include_prompt === true;

    if (requestedKey && !VALID_SCENARIO_KEYS.has(requestedKey)) {
      return jsonError(
        `Invalid scenario_key: "${requestedKey}". Valid keys: ${Array.from(VALID_SCENARIO_KEYS).join(", ")}.`,
        400,
        { code: "INVALID_SCENARIO_KEY" },
      );
    }

    const fetchedAt = new Date().toISOString();

    // Load data (read-only — dry-run creates nothing)
    const [companyMemoryRow, missions, tasks, documents, logs] = await Promise.all([
      loadCompanyMemory(supabaseAdmin, userId),
      loadMissions(supabaseAdmin, userId),
      loadTasks(supabaseAdmin, userId),
      loadDocuments(supabaseAdmin, userId),
      loadLogs(supabaseAdmin, userId),
    ]);

    const rrhContext = isObject(companyMemoryRow)
      ? (isObject(companyMemoryRow.reusable_rh_context_json) ? companyMemoryRow.reusable_rh_context_json : null)
      : null;

    const employees = Array.isArray(rrhContext?.employees)
      ? sanitizePierreEmployeeList(rrhContext.employees)
      : [];

    const documentSystemConfig = rrhContext && isObject(rrhContext.document_system)
      ? rrhContext.document_system
      : null;

    const employeeFiles: unknown[] = [];
    for (const emp of employees) {
      try {
        const empRow: Record<string, unknown> = {
          id: emp.id,
          full_name: emp.full_name,
          email: emp.email ?? null,
          status: emp.status,
        };
        const file = buildEmployeeFile360({ employee: empRow, missions, tasks, documents, logs });
        if (file) employeeFiles.push(file);
      } catch {
        // Non-blocking
      }
    }

    const allScenarios = buildPierreGoldenScenarios();
    const scenariosToEval = requestedKey
      ? allScenarios.filter((s) => s.key === requestedKey)
      : allScenarios;

    const evalContext = {
      missions,
      tasks,
      documents,
      logs,
      employeeFiles,
      companyMemory: rrhContext,
      documentSystemConfig,
    };

    const evaluations = scenariosToEval.map((s) => evaluateGoldenScenario(s, evalContext));

    return NextResponse.json({
      ok: true,
      scenario_key: requestedKey ?? null,
      evaluations,
      ...(includePrompt ? { prompts: scenariosToEval } : {}),
      meta: {
        userId,
        fetchedAt,
        dry_run: true,
        missions_loaded: missions.length,
        tasks_loaded: tasks.length,
        documents_loaded: documents.length,
        logs_loaded: logs.length,
        employees_loaded: employees.length,
        scenarios_evaluated: evaluations.length,
      },
    });
  } catch (err: unknown) {
    if (isObject(err) && typeof err.status === "number") {
      return jsonError(
        asString(err.message) || "Request failed.",
        err.status as number,
        { code: asString(err.code) },
      );
    }
    return jsonError("Internal server error.", 500, { code: "INTERNAL_ERROR" });
  }
}
