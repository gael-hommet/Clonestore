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
import {
  getCloneStoreTechnologyDefinitions,
  buildDefaultTechnologyCompanySettings,
  buildTechnologyRegistry,
} from "../../../../../lib/clonestore/technologies/registry";
import {
  mapRowsToSettings,
  legacyExtractSettings,
} from "../../../../../lib/clonestore/technologies/storage";
import {
  buildRuntimeSnapshot,
} from "../../../../../lib/clonestore/runtime/engine";
import type { CloneRuntimeSnapshot } from "../../../../../lib/clonestore/runtime/contracts";
import {
  buildEmployeeFile360,
  buildEmployeeFileSnapshot,
  type PierreEmployeeFileSnapshot,
} from "../../../../../lib/pierre/hr/employee-file";
import {
  evaluatePierreCloneGuard,
  buildCloneGuardPreview,
  type PierreCloneGuardEvaluation,
} from "../../../../../lib/pierre/hr/cloneguard";
import {
  evaluateGovernance,
  buildGovernancePreview,
  buildGovernanceAuditEvent,
  type PierreGovernanceEvaluation,
} from "../../../../../lib/pierre/hr/governance";
import {
  inferPremiumDocumentFamily,
} from "../../../../../lib/pierre/documents/premium-document-system";
import {
  buildCloneDocumentTemplateIndex,
} from "../../../../../lib/clonestore/documents/template-registry";
import {
  runPierreFinalBrain,
} from "../../../../../lib/pierre/brain/final-brain";
import {
  convertPierreBrainTaskPlanToTaskDrafts,
} from "../../../../../lib/pierre/brain/task-bridge";
import type { PierreBrainFinalOutput } from "../../../../../lib/pierre/brain/types";
import type { PierreTaskDraft } from "../../../../../lib/pierre/types";
import {
  readPierreCloneADNFromReusableContext,
  buildPierreCompanyContextFromCloneADN,
  buildPierreCloneADNHint,
} from "../../../../../lib/pierre/adn/cloneadn";
import type { CloneADNProfile } from "../../../../../lib/clonestore/adn/types";

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
  ai_mode?: string | null;
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
      .in("status", ["active", "trialing"])
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

async function tryReadCloneADNForPierre(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<CloneADNProfile | null> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();

    if (!data) return null;
    return readPierreCloneADNFromReusableContext(
      isObject(data.reusable_rh_context_json) ? data.reusable_rh_context_json : null,
    );
  } catch {
    return null;
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
    return { input: "", missionId: null, source: null, context: null, autonomy_level: null, ai_mode: null };
  }
  return {
    input: asString(raw.input) || "",
    missionId: asString(raw.missionId),
    source: asString(raw.source),
    autonomy_level: asString(raw.autonomy_level),
    ai_mode: asString(raw.ai_mode),
    employee_id: asString(raw.employee_id),
    employee_name: asString(raw.employee_name),
    context: raw.context ?? null,
  };
}

function resolveAiMode(body: SubmitBody): "off" | "assist" | "primary" {
  const raw = body.ai_mode || (isObject(body.context) ? asString((body.context as Record<string, unknown>).ai_mode) : null);
  if (raw === "primary") return "primary";
  if (raw === "assist") return "assist";
  if (process.env.CLONESTORE_AI_ENABLED === "true") return "assist";
  return "off";
}

// ── Employee file snapshot (non-bloquant) ──────────────────────────────────

async function tryBuildEmployeeFileSnapshot(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
  employeeRaw: Record<string, unknown>,
): Promise<PierreEmployeeFileSnapshot | null> {
  try {
    const [
      { data: directTasks },
      { data: nestedTasks },
    ] = await Promise.all([
      supabaseAdmin
        .from("pierre_tasks")
        .select("id, mission_id, type, title, status, approval_required, execute_at, created_at, updated_at, payload_json, risk_level")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .contains("payload_json", { employee_id: employeeId })
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("pierre_tasks")
        .select("id, mission_id, type, title, status, approval_required, execute_at, created_at, updated_at, payload_json, risk_level")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .contains("payload_json", { employee_context: { employee_id: employeeId } })
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const seen = new Set<string>();
    const tasks: Record<string, unknown>[] = [];
    for (const row of [...(directTasks ?? []), ...(nestedTasks ?? [])]) {
      const id = typeof row.id === "string" ? row.id : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      tasks.push(row as Record<string, unknown>);
    }

    const missionIds = [
      ...new Set(
        tasks.map((t) => (typeof t.mission_id === "string" ? t.mission_id : null))
          .filter((id): id is string => id !== null),
      ),
    ].slice(0, 50);

    const [{ data: missions }, { data: logs }] = await Promise.all([
      missionIds.length
        ? supabaseAdmin
            .from("pierre_missions")
            .select("id, status, risk_level, approval_required, mission_summary, intent, created_at, updated_at, brain_output_json, context_snapshot_json")
            .eq("user_id", userId)
            .in("id", missionIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from("pierre_task_logs")
        .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .contains("meta_json", { employee_id: employeeId })
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const file = buildEmployeeFile360({
      employee: employeeRaw,
      missions: (missions ?? []) as Record<string, unknown>[],
      tasks,
      documents: [],
      logs: (logs ?? []) as Record<string, unknown>[],
    });

    return buildEmployeeFileSnapshot(file);
  } catch {
    return null;
  }
}

// ── Runtime snapshot loader (non-blocking) ────────────────────────────────

type CloneRuntimeResult = {
  snapshot: CloneRuntimeSnapshot | null;
  unavailable: boolean;
  error: string | null;
  storage_source: "platform_table" | "legacy_json" | "defaults" | "unavailable";
};

async function tryBuildCloneRuntimeForPierre(
  supabaseAdmin: SupabaseClient,
  userId: string,
  now: string,
): Promise<CloneRuntimeResult> {
  try {
    const defs = getCloneStoreTechnologyDefinitions();

    const { data: tableData } = await supabaseAdmin
      .from("clonestore_company_technologies")
      .select("*")
      .eq("user_id", userId);

    let dbSettings = tableData && tableData.length > 0
      ? mapRowsToSettings(tableData, defs)
      : [];
    let storageSource: CloneRuntimeResult["storage_source"] = tableData && tableData.length > 0 ? "platform_table" : "defaults";

    if (dbSettings.length === 0) {
      const { data: legacyData } = await supabaseAdmin
        .from("pierre_company_memory")
        .select("reusable_rh_context_json")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .maybeSingle();
      if (legacyData && isObject(legacyData.reusable_rh_context_json)) {
        dbSettings = legacyExtractSettings(legacyData.reusable_rh_context_json as Record<string, unknown>, defs);
        if (dbSettings.length > 0) storageSource = "legacy_json";
      }
    }

    const defaults = buildDefaultTechnologyCompanySettings(defs);
    const mergedSettings = defs.map((def) => {
      const db = dbSettings.find((s) => s.technology_slug === def.slug);
      return db ?? defaults.find((s) => s.technology_slug === def.slug)!;
    });

    const registry = buildTechnologyRegistry({ definitions: defs, rawSettings: mergedSettings });
    const snapshot = buildRuntimeSnapshot(registry, "pierre", now);
    return { snapshot, unavailable: false, error: null, storage_source: storageSource };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Runtime indisponible.";
    return { snapshot: null, unavailable: true, error: msg, storage_source: "unavailable" };
  }
}

// ── Premium document enrichment ────────────────────────────────────────────

const DOC_GENERATION_TASK_TYPES = new Set([
  "doc.generate", "document.generate", "contract.generate", "amendment.generate",
  "onboarding.document", "absence.document", "prepayroll.summary", "employee.summary",
  "hr.document", "document.prepare",
]);

function enrichDocumentTaskPayload(
  taskType: string,
  payload: Record<string, unknown>,
  title: string | null,
): Record<string, unknown> {
  if (!DOC_GENERATION_TASK_TYPES.has(taskType.toLowerCase().trim())) return payload;
  const family = inferPremiumDocumentFamily({
    doc_type: payload.doc_type ?? null,
    type: taskType,
    title: title ?? payload.title ?? null,
    instructions: payload.instructions ?? payload.context ?? null,
  });
  return { ...payload, document_family: family, channel: "document" };
}

// ── DB inserts ─────────────────────────────────────────────────────────────

async function insertBrainTasks(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionId: string,
  brainTaskDrafts: PierreTaskDraft[],
  employeeContext: PierreEmployeeContext | null,
  fileSnapshot: PierreEmployeeFileSnapshot | null,
): Promise<DbRow[]> {
  if (!brainTaskDrafts.length) return [];
  const taskRows = brainTaskDrafts.map((task) => {
    const basePayload = enrichPayloadWithEmployeeContext(task.payload_json, employeeContext);
    const withSnapshot = fileSnapshot
      ? { ...basePayload, employee_file_snapshot: fileSnapshot }
      : basePayload;
    const payload_json = enrichDocumentTaskPayload(task.type, withSnapshot, task.title ?? null);
    return {
      mission_id: missionId,
      user_id: userId,
      agent_slug: "pierre",
      type: task.type,
      title: task.title,
      description: task.description || "",
      status: task.status,
      approval_required: task.approval_required,
      execute_at: task.execute_at ?? null,
      payload_json,
    };
  });

  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .insert(taskRows)
    .select("*");

  if (error) {
    throw {
      status: 500,
      message: "Unable to create brain tasks.",
      code: "BRAIN_TASKS_CREATE_FAILED",
      details: mapDbError(error),
    };
  }
  return (data ?? []) as DbRow[];
}

async function insertMission(
  supabaseAdmin: SupabaseClient,
  userId: string,
  body: SubmitBody,
  plan: PierreHrWorkflowPlan,
  employeeContext: PierreEmployeeContext | null,
  employeeWarning: string | null,
  employeeResolutionSource: "explicit_id" | "explicit_name" | "text_detection" | "none",
  fileSnapshot: PierreEmployeeFileSnapshot | null,
  governanceEvaluation: PierreGovernanceEvaluation | null,
  cloneRuntime: CloneRuntimeResult,
  brainOutput: PierreBrainFinalOutput | null,
  aiMode: "off" | "assist" | "primary",
  cloneADNProfile: CloneADNProfile | null,
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
      ...(fileSnapshot ? { employee_file_snapshot: fileSnapshot } : {}),
      ...(governanceEvaluation
        ? {
            governance_snapshot: {
              decision: governanceEvaluation.decision,
              risk_level: governanceEvaluation.risk_level,
              guard_decision: governanceEvaluation.guard_decision,
              policy_decision: governanceEvaluation.policy_decision,
              trust_decision: governanceEvaluation.trust_decision,
              trust_level: governanceEvaluation.trust_level,
              allowed_to_auto_execute: governanceEvaluation.allowed_to_auto_execute,
            },
          }
        : {}),
      clone_runtime_snapshot: cloneRuntime.snapshot,
      clone_runtime_unavailable: cloneRuntime.unavailable,
      ...(cloneRuntime.error ? { clone_runtime_error: cloneRuntime.error } : {}),
      premium_document_task_count: plan.tasks.filter((t) => DOC_GENERATION_TASK_TYPES.has(t.type.toLowerCase())).length,
      premium_document_families: plan.tasks
        .filter((t) => DOC_GENERATION_TASK_TYPES.has(t.type.toLowerCase()))
        .map((t) => inferPremiumDocumentFamily({ type: t.type, title: t.title ?? null })),
      brain_mode: aiMode,
      ...(brainOutput
        ? {
            brain_final: {
              source: brainOutput.source,
              ai_enabled: brainOutput.ai_enabled,
              ai_ok: brainOutput.ai_ok,
              provider: brainOutput.provider,
              interpretation: brainOutput.interpretation,
              risk_review: brainOutput.risk_review,
              task_plan_summary: {
                task_count: brainOutput.task_plan.tasks.length,
                task_types: brainOutput.task_plan.tasks.map((t) => t.type),
                validation_points: brainOutput.task_plan.validation_points,
              },
              quality_gate: brainOutput.quality_gate,
              warnings: brainOutput.warnings,
              errors: brainOutput.errors,
            },
          }
        : {}),
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
      ...(fileSnapshot ? { employee_file_snapshot: fileSnapshot } : {}),
      clone_runtime_snapshot: cloneRuntime.snapshot,
      clone_runtime_context: cloneRuntime.snapshot !== null && cloneRuntime.snapshot !== undefined && typeof cloneRuntime.snapshot === "object" ? (cloneRuntime.snapshot as Record<string, unknown>).context ?? null : null,
      clone_runtime_storage_source: cloneRuntime.storage_source,
      clone_runtime_unavailable: cloneRuntime.unavailable,
      ...(cloneRuntime.error ? { clone_runtime_error: cloneRuntime.error } : {}),
      brain_mode: aiMode,
      brain_runtime: {
        source: brainOutput ? brainOutput.source : null,
        ai_enabled: brainOutput ? brainOutput.ai_enabled : false,
        ai_ok: brainOutput ? brainOutput.ai_ok : false,
        provider: brainOutput ? brainOutput.provider : null,
        warnings: brainOutput ? brainOutput.warnings : [],
        errors: brainOutput ? brainOutput.errors : [],
      },
      document_template_capability: (() => {
        try {
          const idx = buildCloneDocumentTemplateIndex();
          return {
            available: true,
            total_templates: idx.totals.templates,
            platform_default: idx.totals.platform_default,
            available_types: Object.keys(idx.by_type),
          };
        } catch {
          return { available: false };
        }
      })(),
      cloneadn_hint: buildPierreCloneADNHint(cloneADNProfile),
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
  fileSnapshot: PierreEmployeeFileSnapshot | null,
): Promise<DbRow[]> {
  const taskRows = plan.tasks.map((task) => {
    const dbTask = mapPierreWorkflowTaskToDbTask(task);
    const basePayload = enrichPayloadWithEmployeeContext(dbTask.payload_json, employeeContext);
    const withSnapshot = fileSnapshot
      ? { ...basePayload, employee_file_snapshot: fileSnapshot }
      : basePayload;
    const payload_json = enrichDocumentTaskPayload(dbTask.type, withSnapshot, dbTask.title ?? null);
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
      payload_json,
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

    // Load employees and CloneADN in parallel
    const [employees, cloneADNProfile] = await Promise.all([
      readEmployeeList(supabaseAdmin, auth.userId),
      tryReadCloneADNForPierre(supabaseAdmin, auth.userId),
    ]);
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

    // Snapshot salarié 360 (non-bloquant — null si l'employé n'est pas résolu)
    let fileSnapshot: import("../../../../../lib/pierre/hr/employee-file").PierreEmployeeFileSnapshot | null = null;
    if (employeeContext?.employee_id) {
      const empProfile = employees.find((e) => e.id === employeeContext?.employee_id);
      if (empProfile) {
        fileSnapshot = await tryBuildEmployeeFileSnapshot(
          supabaseAdmin,
          auth.userId,
          employeeContext.employee_id,
          empProfile as unknown as Record<string, unknown>,
        );
      }
    }

    // Build workflow plan (replaces old interpretMission)
    const plan = buildPierreHrWorkflowPlan(body.input, {
      autonomy_level: autonomyLevel,
      employee_context: employeeContext ? { ...employeeContext } : null,
    });

    // CloneGuard evaluation — pure, runs on the plan before any DB writes
    const nowIso = new Date().toISOString();
    let cloneguardEvaluation: PierreCloneGuardEvaluation | null = null;
    try {
      cloneguardEvaluation = evaluatePierreCloneGuard({
        task_type: null,
        task_title: null,
        task_description: body.input,
        domain: plan.domain,
        risk_level_hint: plan.risk_level,
        approval_required: plan.approval_required,
        text_corpus: body.input,
        autonomy_level: autonomyLevel,
        now: nowIso,
      });
    } catch {
      cloneguardEvaluation = null;
    }

    // Governance evaluation — combines CloneGuard + ClonePolicy + CloneTrust
    let governanceEvaluation: PierreGovernanceEvaluation | null = null;
    try {
      governanceEvaluation = evaluateGovernance({
        task_type: null,
        task_title: null,
        task_description: body.input,
        domain: plan.domain,
        risk_level_hint: plan.risk_level,
        approval_required: plan.approval_required,
        text_corpus: body.input,
        autonomy_level: autonomyLevel,
        guard_evaluation: cloneguardEvaluation ?? undefined,
        now: nowIso,
      });
    } catch {
      governanceEvaluation = null;
    }

    // CloneOS runtime snapshot — loaded from DB, never throws
    const cloneRuntime = await tryBuildCloneRuntimeForPierre(supabaseAdmin, auth.userId, nowIso);

    const aiMode = resolveAiMode(body);

    // Build CloneADN company context for brain (best-effort, null-safe)
    const cloneADNCompanyContext = buildPierreCompanyContextFromCloneADN(cloneADNProfile);

    // Pierre Brain Final — best-effort, never blocks submit flow. Fallback = null.
    let brainOutput: PierreBrainFinalOutput | null = null;
    if (aiMode !== "off") {
      try {
        brainOutput = await runPierreFinalBrain({
          input: body.input,
          aiMode,
          companyContext: cloneADNCompanyContext,
          employeeContext: employeeContext as Record<string, unknown> | null,
          deterministicInterpretation: {
            domain: plan.domain,
            risk_level: mapToDbRiskLevel(plan.risk_level),
            approval_required: plan.approval_required,
            missing_info: plan.missing_info,
            summary: plan.summary,
          },
          deterministicTasks: plan.tasks.map((t) => ({
            type: t.type,
            title: t.title,
            description: t.description,
            priority: 50,
            approval_required: t.approval_required,
            risk_level: mapToDbRiskLevel(plan.risk_level),
            expected_artifact: null,
            payload: t.payload_json,
          })),
        });
      } catch {
        brainOutput = null;
      }
    }

    const mission = await insertMission(
      supabaseAdmin,
      auth.userId,
      body,
      plan,
      employeeContext,
      employeeWarning,
      employeeResolutionSource,
      fileSnapshot,
      governanceEvaluation,
      cloneRuntime,
      brainOutput,
      aiMode,
      cloneADNProfile,
    );

    const tasks = await insertTasks(
      supabaseAdmin,
      auth.userId,
      mission.id as string,
      plan,
      employeeContext,
      fileSnapshot,
    );

    // In "primary" mode, also insert brain-derived tasks alongside deterministic tasks
    let brainTasks: DbRow[] = [];
    if (
      aiMode === "primary" &&
      brainOutput !== null &&
      brainOutput.ai_ok &&
      brainOutput.quality_gate.safe_to_use
    ) {
      const sensitiveTopics = Array.isArray(brainOutput.risk_review.sensitive_topics)
        ? brainOutput.risk_review.sensitive_topics
        : [];
      const brainDrafts = convertPierreBrainTaskPlanToTaskDrafts(brainOutput.task_plan, {
        sensitiveTopics,
        globalApprovalRequired: brainOutput.risk_review.approval_required,
        maxTasks: 10,
        cloneADNContext: cloneADNProfile ? {
          blocked_task_types: cloneADNProfile.autonomy.blocked_auto_task_types,
          never_auto_execute: cloneADNProfile.validation.never_auto_execute,
          always_require_human_for: cloneADNProfile.validation.always_require_human_for,
          sensitive_topics: cloneADNProfile.validation.sensitive_topics,
          validation_mode: cloneADNProfile.validation.default_mode,
          autonomy_level: cloneADNProfile.autonomy.level,
        } : null,
      });
      if (brainDrafts.length > 0) {
        try {
          brainTasks = await insertBrainTasks(
            supabaseAdmin,
            auth.userId,
            mission.id as string,
            brainDrafts,
            employeeContext,
            fileSnapshot,
          );
        } catch {
          brainTasks = [];
        }
      }
    }

    const logs = await insertLogs(
      supabaseAdmin,
      auth.userId,
      mission.id as string,
      tasks,
      plan,
    );

    // Non-blocking governance audit log
    if (governanceEvaluation) {
      const auditEvent = buildGovernanceAuditEvent(governanceEvaluation, {
        task_type: null,
        domain: plan.domain,
        mission_id: mission.id as string,
        now: nowIso,
      });
      void Promise.resolve(supabaseAdmin
        .from("pierre_task_logs")
        .insert({
          mission_id: mission.id as string,
          task_id: null,
          user_id: auth.userId,
          agent_slug: "pierre",
          event_type: auditEvent.event_type,
          message: auditEvent.message,
          meta_json: auditEvent.meta_json,
        })).catch(() => {});
    }

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

    const cloneguardPreview = cloneguardEvaluation
      ? buildCloneGuardPreview(cloneguardEvaluation)
      : null;

    const allTasks = brainTasks.length > 0 ? [...tasks, ...brainTasks] : tasks;

    return NextResponse.json({
      ok: true,
      mission,
      interpretation,
      workflow_plan: plan,
      tasks: allTasks,
      logs,
      brain_runtime: {
        mode: aiMode,
        source: brainOutput ? brainOutput.source : null,
        ai_enabled: brainOutput ? brainOutput.ai_enabled : false,
        ai_ok: brainOutput ? brainOutput.ai_ok : false,
        provider: brainOutput ? brainOutput.provider : null,
        quality_safe: brainOutput ? brainOutput.quality_gate.safe_to_use : false,
        brain_task_count: brainTasks.length,
        warnings: brainOutput ? brainOutput.warnings : [],
        errors: brainOutput ? brainOutput.errors : [],
      },
      cloneguard: cloneguardEvaluation
        ? {
            evaluation: cloneguardEvaluation,
            preview: cloneguardPreview,
          }
        : null,
      governance: governanceEvaluation
        ? {
            evaluation: governanceEvaluation,
            preview: buildGovernancePreview(governanceEvaluation),
          }
        : null,
      clone_runtime: {
        snapshot: cloneRuntime.snapshot,
        unavailable: cloneRuntime.unavailable,
        storage_source: cloneRuntime.storage_source,
        error: cloneRuntime.error,
      },
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
          tasks: allTasks.length,
          deterministic_tasks: tasks.length,
          brain_tasks: brainTasks.length,
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
