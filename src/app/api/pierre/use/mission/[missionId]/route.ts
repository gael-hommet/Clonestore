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