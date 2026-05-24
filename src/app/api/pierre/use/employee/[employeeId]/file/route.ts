import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sanitizePierreEmployeeList,
  findPierreEmployeeById,
} from "../../../../../../../lib/pierre/hr/employee";
import {
  buildEmployeeFile360,
  buildEmployeeFileSnapshot,
} from "../../../../../../../lib/pierre/hr/employee-file";
import {
  buildPierreOperationalFeed,
  buildFeedSummary,
  buildFeedItemFromEmployeeFileSnapshot,
  buildPremiumFeedSummary,
} from "../../../../../../../lib/pierre/hr/operational-feed";
import {
  buildMissionControlEmployeeCard,
  buildMissionControlActionFromTask,
  sortMissionControlActions,
} from "../../../../../../../lib/pierre/hr/mission-control";
import {
  evaluatePierreCloneGuard,
  buildCloneGuardPreview,
} from "../../../../../../../lib/pierre/hr/cloneguard";
import {
  evaluateGovernance,
  buildGovernancePreview,
} from "../../../../../../../lib/pierre/hr/governance";
import {
  buildAuditTrailEvents,
  buildAuditTrailDiagnostics,
  scoreAuditTrailHealth,
  buildAuditTrailDigest,
  buildAuditTrailAlerts,
} from "../../../../../../../lib/pierre/hr/audit-trail";
import {
  buildEmployeeActionSuggestions,
  buildEmployeeActionSummary,
  buildEmployeeActionPlan,
} from "../../../../../../../lib/pierre/hr/employee-actions";

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
    return {
      message: asString(error.message) || "Unexpected database error.",
      code: asString(error.code),
    };
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
        const c =
          asString(parsed.access_token) ||
          (cs ? asString(cs.access_token) : null);
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
  const token =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
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

async function resolveEmployee(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
) {
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
    return findPierreEmployeeById(employees, employeeId);
  } catch {
    return null;
  }
}

async function fetchEmployeeTasksBroad(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
): Promise<DbRow[]> {
  try {
    const [{ data: direct }, { data: nested }] = await Promise.all([
      supabaseAdmin
        .from("pierre_tasks")
        .select(
          "id, mission_id, type, title, status, approval_required, execute_at, created_at, updated_at, payload_json, risk_level",
        )
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .contains("payload_json", { employee_id: employeeId })
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin
        .from("pierre_tasks")
        .select(
          "id, mission_id, type, title, status, approval_required, execute_at, created_at, updated_at, payload_json, risk_level",
        )
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .contains("payload_json", { employee_context: { employee_id: employeeId } })
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const seen = new Set<string>();
    const merged: DbRow[] = [];
    for (const row of [...(direct ?? []), ...(nested ?? [])]) {
      const id = asString((row as DbRow).id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row as DbRow);
    }
    return merged;
  } catch {
    return [];
  }
}

async function fetchMissionsForTasks(
  supabaseAdmin: SupabaseClient,
  userId: string,
  tasks: DbRow[],
): Promise<DbRow[]> {
  if (!tasks.length) return [];
  const missionIds = [
    ...new Set(
      tasks.map((t) => asString(t.mission_id)).filter((id): id is string => id !== null),
    ),
  ].slice(0, 100);
  if (!missionIds.length) return [];
  try {
    const { data } = await supabaseAdmin
      .from("pierre_missions")
      .select(
        "id, status, risk_level, approval_required, mission_summary, intent, created_at, updated_at, brain_output_json, context_snapshot_json",
      )
      .eq("user_id", userId)
      .in("id", missionIds)
      .order("created_at", { ascending: false });
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

async function fetchDocumentsForMissions(
  supabaseAdmin: SupabaseClient,
  userId: string,
  missionIds: string[],
): Promise<DbRow[]> {
  if (!missionIds.length) return [];
  try {
    const { data } = await supabaseAdmin
      .from("pierre_documents")
      .select("id, mission_id, task_id, doc_type, title, created_at, meta_json")
      .eq("user_id", userId)
      .in("mission_id", missionIds.slice(0, 100))
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []) as DbRow[];
  } catch {
    return [];
  }
}

async function fetchLogsForEmployee(
  supabaseAdmin: SupabaseClient,
  userId: string,
  employeeId: string,
  missionIds: string[],
): Promise<DbRow[]> {
  try {
    const [{ data: direct }, { data: byMission }] = await Promise.all([
      supabaseAdmin
        .from("pierre_task_logs")
        .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
        .eq("user_id", userId)
        .eq("agent_slug", "pierre")
        .contains("meta_json", { employee_id: employeeId })
        .order("created_at", { ascending: false })
        .limit(200),
      missionIds.length
        ? supabaseAdmin
            .from("pierre_task_logs")
            .select("id, mission_id, task_id, event_type, message, meta_json, created_at")
            .eq("user_id", userId)
            .eq("agent_slug", "pierre")
            .in("mission_id", missionIds.slice(0, 50))
            .order("created_at", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [] }),
    ]);

    const seen = new Set<string>();
    const merged: DbRow[] = [];
    const byMissionRows = Array.isArray((byMission as unknown as { data: unknown[] })?.data)
      ? ((byMission as unknown as { data: unknown[] }).data as DbRow[])
      : Array.isArray(byMission)
        ? (byMission as DbRow[])
        : [];
    for (const row of [...(direct ?? []), ...byMissionRows]) {
      const id = asString((row as DbRow).id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(row as DbRow);
    }
    return merged.slice(0, 300);
  } catch {
    return [];
  }
}

// ── GET handler ────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  try {
    const { employeeId } = await params;

    if (!employeeId?.trim()) {
      return jsonError("Employee ID requis.", 400, { code: "EMPLOYEE_ID_REQUIRED" });
    }

    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });
    }

    const employee = await resolveEmployee(supabaseAdmin, userId, employeeId);
    if (!employee) {
      return jsonError(
        `Aucun profil salarié trouvé pour l'identifiant : ${employeeId}`,
        404,
        { code: "EMPLOYEE_NOT_FOUND" },
      );
    }

    const tasks = await fetchEmployeeTasksBroad(supabaseAdmin, userId, employeeId);

    const missionIds = [
      ...new Set(
        tasks.map((t) => asString(t.mission_id)).filter((id): id is string => id !== null),
      ),
    ];

    const [missions, documents, logs] = await Promise.all([
      fetchMissionsForTasks(supabaseAdmin, userId, tasks),
      fetchDocumentsForMissions(supabaseAdmin, userId, missionIds),
      fetchLogsForEmployee(supabaseAdmin, userId, employeeId, missionIds),
    ]);

    const file = buildEmployeeFile360({
      employee: employee as unknown as Record<string, unknown>,
      missions,
      tasks,
      documents,
      logs,
    });

    const snapshot = buildEmployeeFileSnapshot(file);

    const operationalFeed = buildPierreOperationalFeed({ missions, tasks, documents, logs });
    let snapshotFeedItem = null;
    try {
      snapshotFeedItem = buildFeedItemFromEmployeeFileSnapshot(snapshot as unknown as Record<string, unknown>);
    } catch {
      snapshotFeedItem = null;
    }
    const operationalItems = snapshotFeedItem
      ? [...operationalFeed.items, snapshotFeedItem]
      : operationalFeed.items;
    const operationalMessages = {
      items: operationalItems,
      summary: buildFeedSummary(operationalItems),
    };
    const operationalPremiumSummary = buildPremiumFeedSummary(operationalItems);
    const operationalNextAction = operationalPremiumSummary.next_action_label;

    const mcCard = buildMissionControlEmployeeCard(snapshot as unknown as Record<string, unknown>);
    const now = new Date();
    const TERMINAL_MC_EMP = new Set(["done", "cancelled"]);
    const mcEmpActions = tasks
      .filter((t) => !TERMINAL_MC_EMP.has((asString(t.status) ?? "").toLowerCase()))
      .map((t) => {
        try { return buildMissionControlActionFromTask(t, now); }
        catch (_e) { /* skip malformed row */ return null; }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
    const mcEmpSorted = sortMissionControlActions(mcEmpActions);

    // CloneGuard summary — scan file snapshot for risk signals
    const cgFileText = [
      asString(snapshot.risk_level),
      typeof file === "object" && file !== null
        ? (Array.isArray((file as Record<string, unknown>).risks)
          ? ((file as Record<string, unknown>).risks as unknown[])
              .map((r) => (typeof r === "object" && r !== null ? asString((r as Record<string, unknown>).label) : null))
              .filter(Boolean).join(" ")
          : null)
        : null,
    ].filter(Boolean).join(" ");

    let cgHighestRisk = "green";
    let cgSensitiveSignals = 0;
    let cgApprovalRequired = 0;
    const RISK_RANK_EMP: Record<string, number> = { green: 0, orange: 1, red: 2, black: 3 };

    const cgEmpEvals = mcEmpActions.slice(0, 20).map((a) => {
      const taskRow = tasks.find((t) => asString(t.id) === a.task_id);
      const cgEval = evaluatePierreCloneGuard({
        task_type: asString(taskRow?.type ?? null),
        task_title: asString(taskRow?.title ?? null),
        approval_required: taskRow?.approval_required === true || taskRow?.approval_required === "true",
        text_corpus: cgFileText,
        now: now.toISOString(),
      });
      if ((RISK_RANK_EMP[cgEval.risk_level] ?? 0) > (RISK_RANK_EMP[cgHighestRisk] ?? 0)) {
        cgHighestRisk = cgEval.risk_level;
      }
      const blackOrRed = cgEval.signals.filter((s) => s.level === "black" || s.level === "red").length;
      cgSensitiveSignals += blackOrRed;
      if (cgEval.decision === "require_approval" || cgEval.decision === "block") cgApprovalRequired++;
      return cgEval;
    });

    const cgTopEval = cgEmpEvals.length > 0
      ? cgEmpEvals.reduce((worst, e) =>
          (RISK_RANK_EMP[e.risk_level] ?? 0) >= (RISK_RANK_EMP[worst.risk_level] ?? 0) ? e : worst,
          cgEmpEvals[0])
      : evaluatePierreCloneGuard({ text_corpus: cgFileText, now: now.toISOString() });

    const govEmpEval = evaluateGovernance({
      task_type: null,
      task_title: asString(snapshot.employee_name),
      domain: asString(snapshot.risk_level),
      risk_level_hint: asString(snapshot.risk_level),
      employee_file_risk: asString(snapshot.risk_level),
      text_corpus: cgFileText,
      guard_evaluation: cgTopEval,
      now: now.toISOString(),
    });
    const govEmpPreview = buildGovernancePreview(govEmpEval);

    return NextResponse.json({
      ok: true,
      employee_id: employeeId,
      file,
      snapshot,
      cloneguard_summary: {
        highest_risk_level: cgHighestRisk,
        sensitive_signals_count: cgSensitiveSignals,
        approval_required_count: cgApprovalRequired,
        preview: buildCloneGuardPreview(cgTopEval),
      },
      governance_summary: {
        decision: govEmpEval.decision,
        risk_level: govEmpEval.risk_level,
        allowed_to_auto_execute: govEmpEval.allowed_to_auto_execute,
        preview: govEmpPreview,
      },
      mission_control: {
        card: mcCard,
        actions: mcEmpSorted,
        next_action: mcCard.next_action_label,
        requires_human: mcEmpSorted.some((a) => a.requires_human),
        is_sensitive: mcEmpSorted.some((a) => a.is_sensitive),
      },
      operational_messages: operationalMessages,
      operational_premium_summary: operationalPremiumSummary,
      operational_next_action: operationalNextAction,
      audit_trail_summary: (() => {
        try {
          const auditEvts = buildAuditTrailEvents({ missions, tasks, documents, logs });
          const auditDiag = buildAuditTrailDiagnostics(auditEvts);
          const auditHealth = scoreAuditTrailHealth(auditEvts);
          const auditDigestObj = buildAuditTrailDigest(auditEvts);
          const auditAlerts = buildAuditTrailAlerts(auditEvts);
          return {
            diagnostics: auditDiag,
            health: auditHealth,
            digest: auditDigestObj,
            alerts_count: auditAlerts.length,
            critical_count: auditDiag.critical_count,
            human_required_count: auditDiag.human_required_count,
          };
        } catch {
          return null;
        }
      })(),
      employee_actions_summary: (() => {
        try {
          const empRow = {
            id: employeeId,
            full_name: employee.full_name,
            status: employee.status,
            contract_type: employee.contract_type ?? null,
            department: employee.department ?? null,
          } as Record<string, unknown>;
          const suggestions = buildEmployeeActionSuggestions(empRow, missions, tasks);
          return buildEmployeeActionSummary(suggestions);
        } catch { return null; }
      })(),
      employee_action_suggestions: (() => {
        try {
          const empRow = {
            id: employeeId,
            full_name: employee.full_name,
            status: employee.status,
            contract_type: employee.contract_type ?? null,
            department: employee.department ?? null,
          } as Record<string, unknown>;
          return buildEmployeeActionPlan(
            empRow, missions, tasks, now,
          ).suggested_actions.slice(0, 5);
        } catch { return []; }
      })(),
      employee_actions_endpoint: `/api/pierre/use/employee/${employeeId}/actions`,
      meta: {
        userId,
        fetchedAt: now.toISOString(),
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
    return jsonError(mapped.message, 500, { code: "EMPLOYEE_FILE_FETCH_FAILED" });
  }
}
