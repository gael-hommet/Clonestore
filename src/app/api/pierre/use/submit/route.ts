import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type PierreAutonomyLevel } from "../../../../../lib/pierre/hr/contracts";
import { resolvePierreAutonomyLevel } from "../../../../../lib/pierre/hr/autonomy";
import {
  type PierreEmployeeContext,
  type PierreEmployeeProfile,
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
  findPierreEmployeeByName,
  buildPierreEmployeeContext,
  detectEmployeeReferenceFromText,
  enrichPayloadWithEmployeeContext,
} from "../../../../../lib/pierre/hr/employee";
import {
  buildPierreHrWorkflowPlan,
  mapPierreWorkflowTaskToDbTask,
  type PierreHrWorkflowPlan,
  type PierreHrWorkflowRiskLevel,
} from "../../../../../lib/pierre/hr/workflows";

// ── Types ──────────────────────────────────────────────────────────────────

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

type SubmitBody = {
  input: string;
  missionId?: string | null;
  source?: string | null;
  autonomy_level?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  context?: unknown;
};

type DbMissionStatus =
  | "active"
  | "awaiting_info"
  | "awaiting_approval"
  | "draft";

type JsonErrorExtra = {
  code?: string | null;
  details?: unknown;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function getNestedObject(
  source: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!source) return null;
  const value = source[key];
  return isObject(value) ? value : null;
}

function getNestedString(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!source) return null;
  return asString(source[key]);
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ?? {}) },
    { status },
  );
}

function mapToDbRiskLevel(risk: PierreHrWorkflowRiskLevel): "low" | "medium" | "high" {
  if (risk === "black" || risk === "red") return "high";
  if (risk === "orange") return "medium";
  return "low";
}

function mapToDbMissionStatus(
  missingInfoCount: number,
  approvalRequired: boolean,
): DbMissionStatus {
  if (missingInfoCount > 0) return "awaiting_info";
  if (approvalRequired) return "awaiting_approval";
  return "active";
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message:
        asString(error.message) ||
        asString(error.error_description) ||
        "Unexpected database error.",
      code: asString(error.code),
      details: error,
    };
  }
  if (error instanceof Error) {
    return { message: error.message, code: null, details: null };
  }
  return { message: "Unexpected database error.", code: null, details: null };
}

// ── Supabase client ────────────────────────────────────────────────────────

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

// ── Auth ───────────────────────────────────────────────────────────────────

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
        if (typeof candidate === "string") return candidate;
      }

      if (isObject(parsed)) {
        const currentSession = getNestedObject(parsed, "currentSession");
        const candidate =
          getNestedString(parsed, "access_token") ||
          getNestedString(currentSession, "access_token");
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
): Promise<AuthenticatedContext> {
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw {
      status: 401,
      message: "Auth session missing.",
      code: "AUTH_SESSION_MISSING",
    };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw {
      status: 401,
      message: "Unable to authenticate request.",
      code: "AUTH_INVALID",
      details: error?.message || null,
    };
  }

  return { userId: data.user.id, accessToken };
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

async function readEmployeeList(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<PierreEmployeeProfile[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();

    if (!data) return [];

    const context = isObject(data.reusable_rh_context_json)
      ? (data.reusable_rh_context_json as Record<string, unknown>)
      : null;

    if (!context) return [];

    return sanitizePierreEmployeeList(context.employees);
  } catch {
    return [];
  }
}

async function readAutonomyLevel(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<PierreAutonomyLevel> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("memory_json, preferences")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return "validation_smart";

    const memoryJson: Record<string, unknown> | null = isObject(data.memory_json)
      ? (data.memory_json as Record<string, unknown>)
      : null;

    const hrPrefs = getNestedObject(memoryJson, "hr_preferences");
    const fromHrPrefs = getNestedString(hrPrefs, "autonomy_level");
    if (fromHrPrefs) return resolvePierreAutonomyLevel(fromHrPrefs);

    const fromMemory = getNestedString(memoryJson, "autonomy_level");
    if (fromMemory) return resolvePierreAutonomyLevel(fromMemory);

    const preferences: Record<string, unknown> | null = isObject(data.preferences)
      ? (data.preferences as Record<string, unknown>)
      : null;
    const fromPrefs = getNestedString(preferences, "autonomy_level");
    if (fromPrefs) return resolvePierreAutonomyLevel(fromPrefs);

    return "validation_smart";
  } catch {
    return "validation_smart";
  }
}

// ── Body parsing ───────────────────────────────────────────────────────────

function normalizeBody(raw: unknown): SubmitBody {
  if (!isObject(raw)) {
    return { input: "", missionId: null, source: null, context: null, autonomy_level: null };
  }
  return {
    input: asString(raw.input) || "",
    missionId: asString(raw.missionId),
    source: asString(raw.source),
    autonomy_level: asString(raw.autonomy_level),
    employee_id: asString(raw.employee_id),
    employee_name: asString(raw.employee_name),
    context: raw.context ?? null,
  };
}

// ── DB inserts ─────────────────────────────────────────────────────────────

async function insertMission(
  supabaseAdmin: SupabaseClient,
  userId: string,
  body: SubmitBody,
  plan: PierreHrWorkflowPlan,
  employeeContext: PierreEmployeeContext | null,
  employeeWarning: string | null,
  employeeResolutionSource: "explicit_id" | "explicit_name" | "text_detection" | "none",
): Promise<DbRow> {
  const missionTitle =
    body.input.length > 120
      ? `${body.input.slice(0, 117).trim()}…`
      : body.input || "Mission RH";

  const understandingStatus =
    plan.missing_info.length > 0 ? "missing_info" : "understood";

  const insertPayload = {
    user_id: userId,
    agent_slug: "pierre",
    source: body.source || "use_submit",
    raw_input: body.input,
    mission_summary: plan.summary,
    intent: plan.domain,
    understanding_status: understandingStatus,
    risk_level: mapToDbRiskLevel(plan.risk_level),
    approval_required: plan.approval_required,
    status: mapToDbMissionStatus(plan.missing_info.length, plan.approval_required),
    missing_info_json: plan.missing_info,
    brain_output_json: {
      title: missionTitle,
      workflow_domain: plan.domain,
      workflow_priority: plan.priority,
      workflow_risk_level: plan.risk_level,
      workflow_explanation: plan.explanation,
      approval_required: plan.approval_required,
      validation_policy: plan.validation_policy,
      blocked_actions: plan.blocked_actions,
      recommended_next_action: plan.recommended_next_action,
      missing_info: plan.missing_info,
      missing_info_questions: plan.missing_info_questions,
      task_count: plan.tasks.length,
      task_types: plan.tasks.map((t) => t.type),
      can_execute_low_risk_tasks: plan.can_execute_low_risk_tasks,
      employee_resolution_source: employeeResolutionSource,
      ...(employeeContext
        ? {
            employee_id: employeeContext.employee_id,
            employee_name: employeeContext.employee_name,
            employee_context: employeeContext,
          }
        : {}),
      ...(employeeWarning ? { employee_resolution_warning: employeeWarning } : {}),
    },
    context_snapshot_json: {
      ...(isObject(body.context) ? body.context : {}),
      employee_resolution_source: employeeResolutionSource,
      ...(employeeContext
        ? {
            employee_id: employeeContext.employee_id,
            employee_name: employeeContext.employee_name,
            employee_context: employeeContext,
          }
        : {}),
      ...(employeeWarning ? { employee_resolution_warning: employeeWarning } : {}),
    },
  };

  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    throw {
      status: 500,
      message: "Unable to create mission.",
      code: "MISSION_CREATE_FAILED",
      details: mapDbError(error),
    };
  }

  return data satisfies DbRow;
}

async function insertTasks(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionId: string,
  plan: PierreHrWorkflowPlan,
  employeeContext: PierreEmployeeContext | null,
): Promise<DbRow[]> {
  const taskRows = plan.tasks.map((task) => {
    const dbTask = mapPierreWorkflowTaskToDbTask(task);
    return {
      mission_id: missionId,
      user_id: userId,
      agent_slug: "pierre",
      type: dbTask.type,
      title: dbTask.title,
      description: dbTask.description,
      status: dbTask.status,
      approval_required: dbTask.approval_required,
      execute_at: dbTask.execute_at,
      payload_json: enrichPayloadWithEmployeeContext(dbTask.payload_json, employeeContext),
    };
  });

  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .insert(taskRows)
    .select("*");

  if (error) {
    throw {
      status: 500,
      message: "Unable to create mission tasks.",
      code: "TASKS_CREATE_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function insertLogs(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionId: string,
  tasks: DbRow[],
  plan: PierreHrWorkflowPlan,
): Promise<DbRow[]> {
  const logs: Array<Record<string, unknown>> = [
    {
      mission_id: missionId,
      task_id: null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "mission_created",
      message: "Mission créée et structurée par Pierre.",
      meta_json: {
        workflow_domain: plan.domain,
        risk_level: plan.risk_level,
        approval_required: plan.approval_required,
        task_count: tasks.length,
      },
    },
    {
      mission_id: missionId,
      task_id: null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "workflow_analyzed",
      message: plan.explanation,
      meta_json: {
        domain: plan.domain,
        priority: plan.priority,
        risk_level: plan.risk_level,
        approval_required: plan.approval_required,
        missing_info_count: plan.missing_info.length,
        task_count: tasks.length,
        blocked_actions_count: plan.blocked_actions.length,
        recommended_next_action: plan.recommended_next_action,
      },
    },
  ];

  if (plan.approval_required) {
    logs.push({
      mission_id: missionId,
      task_id: null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "human_validation_required",
      message:
        plan.validation_policy.approval_reason ||
        "Validation humaine requise avant toute exécution.",
      meta_json: {
        domain: plan.domain,
        risk_level: plan.risk_level,
        approval_reason: plan.validation_policy.approval_reason,
        blocked: plan.validation_policy.blocked,
        blocked_actions: plan.blocked_actions,
      },
    });
  }

  if (plan.missing_info.length > 0) {
    logs.push({
      mission_id: missionId,
      task_id: null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "missing_info_detected",
      message: `Informations manquantes détectées (${plan.missing_info.length}) : ${plan.missing_info.join(", ")}.`,
      meta_json: {
        domain: plan.domain,
        missing_info: plan.missing_info,
        missing_info_questions: plan.missing_info_questions,
      },
    });
  }

  if (plan.domain === "sensitive_case") {
    logs.push({
      mission_id: missionId,
      task_id: null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "sensitive_case_detected",
      message:
        "Cas sensible RH détecté. Pierre prépare uniquement — toute décision est réservée à l'humain.",
      meta_json: {
        risk_level: plan.risk_level,
        blocked_actions: plan.blocked_actions,
        recommended_next_action: plan.recommended_next_action,
      },
    });
  }

  for (const task of tasks) {
    logs.push({
      mission_id: missionId,
      task_id: task.id ?? null,
      user_id: userId,
      agent_slug: "pierre",
      event_type: "task_created",
      message: `Tâche créée : ${asString(task.title) || asString(task.type) || "task"}`,
      meta_json: {
        task_type: asString(task.type),
        task_status: asString(task.status),
        approval_required: task.approval_required,
      },
    });
  }

  const { data, error } = await supabaseAdmin
    .from("pierre_task_logs")
    .insert(logs)
    .select("*");

  if (error) {
    throw {
      status: 500,
      message: "Unable to create mission logs.",
      code: "LOGS_CREATE_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

// ── POST handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = normalizeBody(await request.json());

    if (!body.input || !body.input.trim()) {
      return jsonError("Mission input is required.", 400, {
        code: "MISSION_INPUT_REQUIRED",
      });
    }

    const supabaseAdmin = createAdminClient();
    const auth = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, auth.userId);
    if (!access) {
      return jsonError(
        "Accès Pierre requis. Activez votre abonnement Pierre pour continuer.",
        403,
        { code: "PIERRE_ACCESS_DENIED" },
      );
    }

    // Autonomy level: body override > mémoire entreprise > "validation_smart"
    const autonomyLevel = body.autonomy_level
      ? resolvePierreAutonomyLevel(body.autonomy_level)
      : await readAutonomyLevel(supabaseAdmin, auth.userId);

    // Employee context: résolution depuis la liste mémoire entreprise
    const employees = await readEmployeeList(supabaseAdmin, auth.userId);
    let employeeContext: PierreEmployeeContext | null = null;
    let employeeResolutionSource: "explicit_id" | "explicit_name" | "text_detection" | "none" =
      "none";
    const employeeWarnings: string[] = [];

    if (body.employee_id) {
      const found = findPierreEmployeeById(employees, body.employee_id);
      if (found) {
        employeeContext = buildPierreEmployeeContext(found);
        employeeResolutionSource = "explicit_id";
      } else {
        employeeWarnings.push(`employee_id "${body.employee_id}" not found in registry`);
        if (body.employee_name) {
          const foundByName = findPierreEmployeeByName(employees, body.employee_name);
          if (foundByName) {
            employeeContext = buildPierreEmployeeContext(foundByName);
            employeeResolutionSource = "explicit_name";
          } else {
            employeeWarnings.push(
              `employee_name "${body.employee_name}" not found in registry`,
            );
          }
        }
      }
    } else if (body.employee_name) {
      const found = findPierreEmployeeByName(employees, body.employee_name);
      if (found) {
        employeeContext = buildPierreEmployeeContext(found);
        employeeResolutionSource = "explicit_name";
      } else {
        employeeWarnings.push(`employee_name "${body.employee_name}" not found in registry`);
      }
    }

    if (!employeeContext && employees.length > 0) {
      const detected = detectEmployeeReferenceFromText(body.input, employees);
      if (detected) {
        employeeContext = buildPierreEmployeeContext(detected);
        employeeResolutionSource = "text_detection";
      }
    }

    const employeeWarning = employeeWarnings.length > 0 ? employeeWarnings.join("; ") : null;

    // Build workflow plan (replaces old interpretMission)
    const plan = buildPierreHrWorkflowPlan(body.input, {
      autonomy_level: autonomyLevel,
      employee_context: employeeContext ? { ...employeeContext } : null,
    });

    const mission = await insertMission(
      supabaseAdmin,
      auth.userId,
      body,
      plan,
      employeeContext,
      employeeWarning,
      employeeResolutionSource,
    );

    const tasks = await insertTasks(
      supabaseAdmin,
      auth.userId,
      mission.id as string,
      plan,
      employeeContext,
    );

    const logs = await insertLogs(
      supabaseAdmin,
      auth.userId,
      mission.id as string,
      tasks,
      plan,
    );

    // Backward-compatible interpretation shape for front-end consumers
    const interpretation = {
      intent: plan.domain,
      classification: plan.domain,
      summary: plan.summary,
      language: "fr" as const,
      tone: "professionnel",
      risk_level: plan.risk_level,
      approval_required: plan.approval_required,
      missing_info: plan.missing_info,
      missing_info_questions: plan.missing_info_questions,
    };

    return NextResponse.json({
      ok: true,
      mission,
      interpretation,
      workflow_plan: plan,
      tasks,
      logs,
      threadEntries: [
        {
          id: `assistant-${mission.id as string}`,
          role: "assistant",
          content:
            plan.missing_info.length > 0
              ? "Mission comprise partiellement. Pierre a structuré la demande mais a détecté des informations manquantes avant exécution complète."
              : plan.approval_required
                ? "Mission comprise. Pierre a structuré l'action et positionné une validation humaine avant exécution sensible."
                : "Mission comprise et structurée. Pierre a créé les tâches nécessaires pour lancer le traitement RH.",
          created_at: new Date().toISOString(),
        },
      ],
      meta: {
        missionId: mission.id,
        userId: auth.userId,
        autonomyLevel,
        fetchedAt: new Date().toISOString(),
        counts: {
          tasks: tasks.length,
          logs: logs.length,
        },
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status,
        {
          code: asString(error.code),
          details: (error as Record<string, unknown>).details ?? null,
        },
      );
    }

    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, {
      code: mapped.code,
      details: mapped.details,
    });
  }
}
