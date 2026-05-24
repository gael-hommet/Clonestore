import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionContinuityInsight,
  buildContinuePlan,
} from "../../../../../../lib/pierre/hr/continuity";
import {
  buildMissionControlMissionCard,
  buildMissionControlActionFromTask,
  sortMissionControlActions,
} from "../../../../../../lib/pierre/hr/mission-control";
import {
  buildPierreOperationalFeed,
  buildFeedSummary,
  buildPremiumFeedSummary,
} from "../../../../../../lib/pierre/hr/operational-feed";
import {
  buildEmployeeFile360,
  buildEmployeeFileSnapshot,
  type PierreEmployeeFileSnapshot,
} from "../../../../../../lib/pierre/hr/employee-file";
import {
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
} from "../../../../../../lib/pierre/hr/employee";
import {
  evaluatePierreCloneGuard,
  buildCloneGuardPreview,
  summarizeCloneGuardEvaluation,
} from "../../../../../../lib/pierre/hr/cloneguard";
import {
  evaluateGovernance,
  buildGovernancePreview,
} from "../../../../../../lib/pierre/hr/governance";
import {
  buildAuditTrailEvents,
  buildAuditTrailTimeline,
  buildAuditTrailAlerts,
} from "../../../../../../lib/pierre/hr/audit-trail";
import {
  buildEmployeeActionSuggestions,
  buildEmployeeActionSummary,
  buildEmployeeActionTrace,
} from "../../../../../../lib/pierre/hr/employee-actions";
import {
  getCloneStoreTechnologyDefinitions,
  buildDefaultTechnologyCompanySettings,
  buildTechnologyRegistry,
} from "../../../../../../lib/clonestore/technologies/registry";
import {
  mapRowsToSettings,
  legacyExtractSettings,
} from "../../../../../../lib/clonestore/technologies/storage";
import {
  buildRuntimeSnapshot,
} from "../../../../../../lib/clonestore/runtime/engine";
import type { CloneRuntimeSnapshot } from "../../../../../../lib/clonestore/runtime/contracts";
import {
  buildMissionReadinessHint,
  type PierreReadinessHint,
} from "../../../../../../lib/pierre/hr/operational-readiness";
import {
  buildMissionReleaseProofHint,
  type PierreReleaseHint,
} from "../../../../../../lib/pierre/hr/release-proof";
import {
  buildMissionTrialActivationHint,
  type PierreTrialActivationHint,
} from "../../../../../../lib/pierre/hr/trial-activation";
import {
  buildPierreCustomerSuccessMissionHint,
} from "../../../../../../lib/pierre/hr/customer-success";
import {
  getCloneAIRuntimeStatus,
} from "../../../../../../lib/cloneos/ai/runtime";
import {
  readPierreCloneADNFromReusableContext,
  buildPierreCloneADNHint,
} from "../../../../../../lib/pierre/adn/cloneadn";
import {
  getGoldenScenarioRegistry,
  getPositiveScenarios,
  getNegativeScenarios,
  getCriticalScenarios,
} from "../../../../../../lib/pierre/scenarios/golden-registry";

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

type JsonErrorExtra = {
  code?: string | null;
  details?: unknown;
};

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
    {
      ok: false,
      error: message,
      ...(extra ?? {}),
    },
    { status },
  );
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

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

  const directCandidates = [
    "sb-access-token",
    "supabase-access-token",
    "access-token",
  ];

  for (const key of directCandidates) {
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

  return {
    userId: data.user.id,
    accessToken,
  };
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
    return {
      message: error.message,
      code: null,
      details: null,
    };
  }

  return {
    message: "Unexpected database error.",
    code: null,
    details: null,
  };
}

async function verifyMissionOwnership(
  supabaseAdmin: SupabaseClient,
  missionId: string,
  userId: string,
): Promise<DbRow> {
  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select("*")
    .eq("id", missionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission.",
      code: "MISSION_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  if (!data) {
    throw {
      status: 404,
      message: "Mission not found.",
      code: "MISSION_NOT_FOUND",
    };
  }

  return data satisfies DbRow;
}

async function fetchMissionTasks(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission tasks.",
      code: "TASKS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function fetchMissionLogs(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_task_logs")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission logs.",
      code: "LOGS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function fetchMissionDocuments(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_documents")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission documents.",
      code: "DOCUMENTS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function fetchMissionOutboundEmails(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_outbound_emails")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission outbound emails.",
      code: "EMAILS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

type MissionEmployeeFile = {
  available: boolean;
  employee_id: string | null;
  employee_name: string | null;
  snapshot: PierreEmployeeFileSnapshot | null;
};

function extractMissionEmployeeId(mission: DbRow, tasks: DbRow[]): string | null {
  const brain = isObject(mission.brain_output_json) ? mission.brain_output_json : null;
  const ctx = isObject(mission.context_snapshot_json) ? mission.context_snapshot_json : null;
  const empCtx = getNestedObject(brain, "employee_context");
  const snapEmp = getNestedObject(brain, "employee_file_snapshot");

  const fromMission =
    getNestedString(brain, "employee_id") ||
    getNestedString(empCtx, "employee_id") ||
    getNestedString(ctx, "employee_id") ||
    getNestedString(snapEmp, "employee_id");
  if (fromMission) return fromMission;

  for (const task of tasks) {
    const payload = isObject(task.payload_json) ? task.payload_json : null;
    if (!payload) continue;
    const direct = getNestedString(payload, "employee_id");
    if (direct) return direct;
    const nestedCtx = getNestedObject(payload, "employee_context");
    const nestedId = getNestedString(nestedCtx, "employee_id");
    if (nestedId) return nestedId;
  }
  return null;
}

function getMissionCachedSnapshot(mission: DbRow): PierreEmployeeFileSnapshot | null {
  const brain = isObject(mission.brain_output_json) ? mission.brain_output_json : null;
  const ctx = isObject(mission.context_snapshot_json) ? mission.context_snapshot_json : null;
  const snap =
    (brain ? getNestedObject(brain, "employee_file_snapshot") : null) ||
    (ctx ? getNestedObject(ctx, "employee_file_snapshot") : null);
  return snap ? (snap as unknown as PierreEmployeeFileSnapshot) : null;
}

async function fetchEmployeeRaw(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
): Promise<Record<string, unknown> | null> {
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
    const found = findPierreEmployeeById(employees, employeeId);
    return found ? (found as unknown as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function buildMissionEmployeeFile(
  supabaseAdmin: SupabaseClient,
  userId: string,
  mission: DbRow,
  tasks: DbRow[],
  documents: DbRow[],
  logs: DbRow[],
): Promise<MissionEmployeeFile> {
  try {
    const employeeId = extractMissionEmployeeId(mission, tasks);
    if (!employeeId) return { available: false, employee_id: null, employee_name: null, snapshot: null };

    const cached = getMissionCachedSnapshot(mission);
    if (cached) {
      return {
        available: true,
        employee_id: employeeId,
        employee_name: cached.employee_name,
        snapshot: cached,
      };
    }

    const brain = isObject(mission.brain_output_json) ? mission.brain_output_json : null;
    const ctx = isObject(mission.context_snapshot_json) ? mission.context_snapshot_json : null;
    const employeeRaw =
      getNestedObject(brain, "employee_context") ||
      getNestedObject(ctx, "employee_context") ||
      (await fetchEmployeeRaw(supabaseAdmin, userId, employeeId));

    if (!employeeRaw) {
      return { available: true, employee_id: employeeId, employee_name: null, snapshot: null };
    }

    const file = buildEmployeeFile360({
      employee: employeeRaw,
      missions: [mission],
      tasks,
      documents,
      logs,
    });
    const snapshot = buildEmployeeFileSnapshot(file);

    return {
      available: true,
      employee_id: employeeId,
      employee_name: file.profile.employee_name,
      snapshot,
    };
  } catch {
    return { available: false, employee_id: null, employee_name: null, snapshot: null };
  }
}

type MissionCloneRuntime = {
  snapshot: CloneRuntimeSnapshot | null;
  context: CloneRuntimeSnapshot["context"] | null;
  source: "mission_snapshot" | "rebuilt" | "unavailable";
  error?: string;
};

async function buildMissionCloneRuntime(
  supabaseAdmin: SupabaseClient,
  userId: string,
  mission: DbRow,
): Promise<MissionCloneRuntime> {
  try {
    const ctxJson = isObject(mission.context_snapshot_json) ? mission.context_snapshot_json : null;
    const cached = ctxJson ? ctxJson.clone_runtime_snapshot : null;
    if (isObject(cached) && isObject((cached as Record<string, unknown>).context)) {
      const snap = cached as unknown as CloneRuntimeSnapshot;
      return { snapshot: snap, context: snap.context, source: "mission_snapshot" };
    }

    const defs = getCloneStoreTechnologyDefinitions();
    const { data: tableData } = await supabaseAdmin
      .from("clonestore_company_technologies")
      .select("*")
      .eq("user_id", userId);

    let dbSettings = tableData && tableData.length > 0
      ? mapRowsToSettings(tableData, defs)
      : [];

    if (dbSettings.length === 0) {
      const { data: legacyData } = await supabaseAdmin
        .from("pierre_company_memory")
        .select("reusable_rh_context_json")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .maybeSingle();
      if (legacyData && isObject(legacyData.reusable_rh_context_json)) {
        dbSettings = legacyExtractSettings(legacyData.reusable_rh_context_json as Record<string, unknown>, defs);
      }
    }

    const defaults = buildDefaultTechnologyCompanySettings(defs);
    const mergedSettings = defs.map((def) => {
      const db = dbSettings.find((s) => s.technology_slug === def.slug);
      return db ?? defaults.find((s) => s.technology_slug === def.slug)!;
    });

    const registry = buildTechnologyRegistry({ definitions: defs, rawSettings: mergedSettings });
    const snapshot = buildRuntimeSnapshot(registry, "pierre", new Date().toISOString());
    return { snapshot, context: snapshot.context, source: "rebuilt" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Runtime indisponible.";
    return { snapshot: null, context: null, source: "unavailable", error: msg };
  }
}

function extractPdfCandidates(documents: DbRow[]): DbRow[] {
  return documents.filter((document) => {
    const docType = (asString(document.doc_type) || "").toLowerCase();
    const filename = (asString(document.filename) || "").toLowerCase();
    const storagePath = (asString(document.storage_path) || "").toLowerCase();
    const mimeType = (asString(document.mime_type) || "").toLowerCase();

    return (
      docType.includes("pdf") ||
      filename.endsWith(".pdf") ||
      storagePath.endsWith(".pdf") ||
      mimeType === "application/pdf"
    );
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ missionId: string }> },
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const missionId = asString(resolvedParams?.missionId);

    if (!missionId) {
      return jsonError("Mission id is required.", 400, {
        code: "MISSION_ID_REQUIRED",
      });
    }

    const supabaseAdmin = createAdminClient();
    const auth = await authenticateRequest(request, supabaseAdmin);

    const mission = await verifyMissionOwnership(
      supabaseAdmin,
      missionId,
      auth.userId,
    );

    const [tasks, logs, documents, outboundEmails] = await Promise.all([
      fetchMissionTasks(supabaseAdmin, missionId),
      fetchMissionLogs(supabaseAdmin, missionId),
      fetchMissionDocuments(supabaseAdmin, missionId),
      fetchMissionOutboundEmails(supabaseAdmin, missionId),
    ]);

    const pdfs = extractPdfCandidates(documents);

    const now = new Date();
    const missionInsight = buildMissionContinuityInsight(mission, tasks, { now, logs, documents });
    const continuePlan = buildContinuePlan(mission, tasks, { now });

    const employeeFile = await buildMissionEmployeeFile(
      supabaseAdmin,
      auth.userId,
      mission,
      tasks,
      documents,
      logs,
    );

    const cloneRuntime = await buildMissionCloneRuntime(supabaseAdmin, auth.userId, mission);

    const operationalFeed = buildPierreOperationalFeed({
      missions: [mission],
      tasks,
      documents,
      logs,
      now,
    });
    const operationalMessages = {
      items: operationalFeed.items,
      summary: buildFeedSummary(operationalFeed.items),
    };
    const operationalPremiumSummary = buildPremiumFeedSummary(operationalFeed.items);
    const operationalNextAction = operationalPremiumSummary.next_action_label;

    const mcCard = buildMissionControlMissionCard(mission, tasks as Record<string, unknown>[], now);
    const TERMINAL_MC = new Set(["done", "cancelled"]);
    const mcActions = tasks
      .filter((t) => !TERMINAL_MC.has((asString(t.status) ?? "").toLowerCase()))
      .map((t) => {
        try { return buildMissionControlActionFromTask(t, now); }
        catch (_e) { /* skip malformed row */ return null; }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
    const mcSorted = sortMissionControlActions(mcActions);
    const missionControl = {
      card: mcCard,
      actions: mcSorted,
      next_action: mcCard.next_action_label,
      is_blocked: mcCard.blocked_count > 0,
      requires_human: mcSorted.some((a) => a.requires_human),
      is_sensitive: mcSorted.some((a) => a.is_sensitive),
    };

    // CloneGuard + Governance evaluation for the mission context
    const cgMissionEval = evaluatePierreCloneGuard({
      task_type: null,
      task_title: asString(mission.mission_summary),
      domain: asString(mission.intent),
      risk_level_hint: asString(mission.risk_level),
      approval_required: mission.approval_required === true || mission.approval_required === "true",
      text_corpus: [asString(mission.mission_summary), asString(mission.intent)].filter(Boolean).join(" "),
      now: now.toISOString(),
    });
    const cgMissionPreview = buildCloneGuardPreview(cgMissionEval);
    const cgMissionSummary = summarizeCloneGuardEvaluation(cgMissionEval);

    const govMissionEval = evaluateGovernance({
      task_type: null,
      task_title: asString(mission.mission_summary),
      domain: asString(mission.intent),
      risk_level_hint: asString(mission.risk_level),
      approval_required: mission.approval_required === true || mission.approval_required === "true",
      guard_evaluation: cgMissionEval,
      now: now.toISOString(),
    });
    const govMissionPreview = buildGovernancePreview(govMissionEval);

    // Audit trail scoped to this mission
    const auditEvents = buildAuditTrailEvents({
      missions: [mission],
      tasks: tasks as Record<string, unknown>[],
      documents: documents as Record<string, unknown>[],
      logs: logs as Record<string, unknown>[],
    });
    const auditTimeline = buildAuditTrailTimeline(auditEvents);
    const auditAlerts = buildAuditTrailAlerts(auditEvents);

    return NextResponse.json({
      ok: true,
      mission,
      interpretation: mission.interpretation ?? null,
      tasks,
      logs,
      documents,
      outbound_emails: outboundEmails,
      pdfs,
      employee_file: employeeFile,
      cloneguard: {
        evaluation: cgMissionEval,
        preview: cgMissionPreview,
        summary: cgMissionSummary,
      },
      governance: {
        evaluation: govMissionEval,
        preview: govMissionPreview,
      },
      mission_control: {
        ...missionControl,
        cloneguard_card: {
          decision: cgMissionEval.decision,
          risk_level: cgMissionEval.risk_level,
          preview: cgMissionPreview,
          allowed_to_auto_execute: cgMissionEval.allowed_to_auto_execute,
        },
        governance_card: {
          decision: govMissionEval.decision,
          risk_level: govMissionEval.risk_level,
          preview: govMissionPreview,
          allowed_to_auto_execute: govMissionEval.allowed_to_auto_execute,
        },
      },
      operational_messages: operationalMessages,
      operational_premium_summary: operationalPremiumSummary,
      operational_next_action: operationalNextAction,
      continuity: {
        mission_insight: missionInsight,
        continue_plan: continuePlan,
        sections: missionInsight.sections ?? [],
        digest: missionInsight.digest ?? null,
        log_summary: missionInsight.log_summary ?? null,
        document_summary: missionInsight.document_summary ?? null,
      },
      audit_trail: {
        events: auditTimeline.events,
        sections: auditTimeline.sections,
        diagnostics: auditTimeline.diagnostics,
        health: auditTimeline.health,
        digest: auditTimeline.digest,
        alerts: auditAlerts,
      },
      employee_action_context: (() => {
        try {
          if (!employeeFile.available || !employeeFile.employee_id) return null;
          const empRow: Record<string, unknown> = {
            id: employeeFile.employee_id,
            full_name: employeeFile.employee_name ?? employeeFile.employee_id,
            status: null,
            contract_type: null,
            department: null,
          };
          const suggestions = buildEmployeeActionSuggestions(empRow, [mission], tasks);
          const summary = buildEmployeeActionSummary(suggestions);
          const trace = buildEmployeeActionTrace("general.action_reminder", employeeFile.employee_id);
          return {
            employee_id: employeeFile.employee_id,
            employee_name: employeeFile.employee_name,
            suggestions: suggestions.slice(0, 5),
            summary,
            trace,
            employee_actions_endpoint: `/api/pierre/use/employee/${employeeFile.employee_id}/actions`,
          };
        } catch { return null; }
      })(),
      clone_runtime: {
        snapshot: cloneRuntime.snapshot,
        context: cloneRuntime.context,
        source: cloneRuntime.source,
        ...(cloneRuntime.error ? { error: cloneRuntime.error } : {}),
      },
      readiness_hint: (() => {
        try {
          return buildMissionReadinessHint(mission, tasks, documents, logs);
        } catch {
          return null as PierreReadinessHint | null;
        }
      })(),
      release_proof_hint: (() => {
        try {
          return buildMissionReleaseProofHint(mission, tasks, documents, logs);
        } catch {
          return null as PierreReleaseHint | null;
        }
      })(),
      trial_activation_hint: (() => {
        try {
          return buildMissionTrialActivationHint(mission, tasks, documents, logs);
        } catch {
          return null as PierreTrialActivationHint | null;
        }
      })(),
      customer_success_hint: (() => {
        try {
          return buildPierreCustomerSuccessMissionHint({ mission, tasks, documents, logs });
        } catch {
          return {
            customer_stage: "activated" as const,
            health_score: 50,
            conversion_score: 50,
            retention_score: 50,
            main_risk: null,
            recommended_action: null,
          };
        }
      })(),
      ai_runtime_hint: (() => {
        try {
          const status = getCloneAIRuntimeStatus();
          const missionBrainOutput = typeof mission.brain_output_json === "object" && mission.brain_output_json !== null
            ? (mission.brain_output_json as Record<string, unknown>)
            : null;
          return {
            available: true,
            providers: status.providers,
            contracts_count: status.prompt_contracts_count,
            mission_ai_assist_present: !!(missionBrainOutput && ("ai_assist" in missionBrainOutput || "brain_final" in missionBrainOutput)),
          };
        } catch {
          return {
            available: false,
            providers: [],
            contracts_count: 0,
            mission_ai_assist_present: false,
          };
        }
      })(),
      cloneadn_hint: (() => {
        try {
          // Read CloneADN hint stored at mission creation time in context_snapshot_json
          const ctx = isObject(mission.context_snapshot_json) ? mission.context_snapshot_json : null;
          const storedHint = ctx ? ctx["cloneadn_hint"] : null;
          if (storedHint && isObject(storedHint)) return storedHint;
          // Fallback: try reading live CloneADN from company memory if stored in context
          const rh = ctx ? ctx["reusable_rh_context_json"] : null;
          if (isObject(rh)) {
            const profile = readPierreCloneADNFromReusableContext(rh);
            return buildPierreCloneADNHint(profile);
          }
          return null;
        } catch {
          return null;
        }
      })(),
      brain_final_hint: (() => {
        try {
          const brain = isObject(mission.brain_output_json) ? mission.brain_output_json : null;
          if (!brain) return null;
          const brainFinal = getNestedObject(brain, "brain_final");
          if (!brainFinal) return null;
          const brainMode = asString(brain.brain_mode);
          const qualityGate = getNestedObject(brainFinal, "quality_gate");
          const interpretation = getNestedObject(brainFinal, "interpretation");
          const riskReview = getNestedObject(brainFinal, "risk_review");
          return {
            available: true,
            source: asString(brainFinal.source),
            ai_enabled: Boolean(brainFinal.ai_enabled),
            ai_ok: Boolean(brainFinal.ai_ok),
            provider: asString(brainFinal.provider),
            brain_mode: brainMode,
            interpretation_intent: interpretation ? asString(interpretation.intent) : null,
            interpretation_domain: interpretation ? asString(interpretation.domain) : null,
            interpretation_summary: interpretation ? asString(interpretation.summary) : null,
            requires_human_validation: interpretation ? Boolean(interpretation.requires_human_validation) : false,
            risk_level: riskReview ? asString(riskReview.risk_level) : null,
            approval_required: riskReview ? Boolean(riskReview.approval_required) : false,
            quality_valid: qualityGate ? Boolean(qualityGate.valid) : false,
            quality_safe: qualityGate ? Boolean(qualityGate.safe_to_use) : false,
            quality_score: qualityGate && typeof qualityGate.score === "number" ? qualityGate.score : 0,
          };
        } catch {
          return null;
        }
      })(),
      golden_scenarios_hint: (() => {
        try {
          const registry = getGoldenScenarioRegistry();
          const positive = getPositiveScenarios();
          const negative = getNegativeScenarios();
          const critical = getCriticalScenarios();
          return {
            available: true,
            scenarios_total: registry.length,
            scenarios_positive: positive.length,
            scenarios_negative: negative.length,
            scenarios_critical: critical.length,
            critical_scenario_ids: critical.map((s) => s.id),
            modules_covered: Array.from(
              new Set(registry.flatMap((s) => s.modules)),
            ),
            dry_run_endpoint: "/api/pierre/use/scenarios/run-suite",
            report_endpoint: "/api/pierre/use/scenarios/report",
          };
        } catch {
          return null;
        }
      })(),
      release_candidate_hint: (() => {
        try {
          const brain = isObject(mission.brain_output_json) ? mission.brain_output_json : null;
          const ctx = isObject(mission.context_snapshot_json) ? mission.context_snapshot_json : null;
          const hasBrainFinal = !!(brain && getNestedObject(brain, "brain_final"));
          const cloneadnHint = ctx ? ctx["cloneadn_hint"] : null;
          const hasCloneADN = !!(cloneadnHint && isObject(cloneadnHint) && (cloneadnHint as Record<string, unknown>)["is_configured"] === true);
          const hasPremiumDocuments = (documents ?? []).some((d: DbRow) => {
            const payload = isObject(d.payload_json) ? d.payload_json : {};
            return Boolean(payload.template_id) || Boolean(payload.document_kind) || Boolean(d.doc_type);
          });
          const hasGoldenScenarios = (() => {
            try {
              const reg = getGoldenScenarioRegistry();
              return reg.length >= 13;
            } catch { return false; }
          })();
          const hasCustomerSuccess = !!(
            tasks.some((t: DbRow) => {
              const tp = typeof t.type === "string" ? t.type : "";
              return tp.includes("customer") || tp.includes("onboarding");
            }) || documents.length > 0
          );
          const backend_ready = hasBrainFinal || hasGoldenScenarios;
          const next_step: "cockpit" | "hotfix" | "review" =
            backend_ready && hasGoldenScenarios ? "cockpit" :
            !hasBrainFinal ? "hotfix" : "review";
          return {
            backend_ready,
            next_step,
            has_brain_final: hasBrainFinal,
            has_cloneadn: hasCloneADN,
            has_premium_documents: hasPremiumDocuments,
            has_customer_success: hasCustomerSuccess,
            has_golden_scenarios: hasGoldenScenarios,
          };
        } catch {
          return null;
        }
      })(),
      meta: {
        missionId,
        userId: auth.userId,
        fetchedAt: now.toISOString(),
        counts: {
          tasks: tasks.length,
          logs: logs.length,
          documents: documents.length,
          outbound_emails: outboundEmails.length,
          pdfs: pdfs.length,
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
          details: error.details ?? null,
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