import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sanitizePierreEmployeeList, findPierreEmployeeById, findPierreEmployeeByName } from "../../../../../../lib/pierre/hr/employee";
import {
  detectPierreHrWorkflowDomain,
  detectPierreHrWorkflowRisk,
  detectPierreHrWorkflowPriority,
  buildPierreHrWorkflowPlan,
  mapPierreWorkflowTaskToDbTask,
  type PierreHrWorkflowDomain,
} from "../../../../../../lib/pierre/hr/workflows";
import {
  getEmployeeActionCatalog,
  buildEmployeeActionSuggestions,
  buildEmployeeActionSummary,
  inferEmployeeActionDomain,
  getEmployeeActionsByDomain,
  type PierreEmployeeActionDomain,
} from "../../../../../../lib/pierre/hr/employee-actions";

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
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "1";
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function mapDbError(error: unknown) {
  if (isObject(error)) return { message: asString(error.message) || "Unexpected database error.", code: asString(error.code) };
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

// ── Supabase ───────────────────────────────────────────────

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured.");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ── Auth ───────────────────────────────────────────────────

function tryReadBearerToken(request: NextRequest): string | null {
  const h = request.headers.get("authorization");
  if (!h) return null;
  const [scheme, token] = h.split(" ");
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
        const c = parsed.find((i): i is string => typeof i === "string" && i.split(".").length === 3);
        if (c) return c;
      }
      if (isObject(parsed)) {
        const cs = isObject(parsed.currentSession) ? parsed.currentSession : null;
        const c = asString(parsed.access_token) || (cs ? asString(cs.access_token) : null);
        if (c) return c;
      }
    } catch { if (raw.split(".").length === 3) return raw; }
  }
  return null;
}

async function authenticateRequest(request: NextRequest, supabaseAdmin: SupabaseClient): Promise<string> {
  const token = tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);
  if (!token) throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  return data.user.id;
}

async function hasPierreAccess(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin.from("orders").select("id").eq("user_id", userId).eq("agent_slug", "pierre").eq("status", "active").limit(1).maybeSingle();
    return Boolean(data);
  } catch { return false; }
}

// ── Data fetching ──────────────────────────────────────────

async function loadEmployees(supabaseAdmin: SupabaseClient, userId: string) {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_company_memory")
      .select("reusable_rh_context_json")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .maybeSingle();
    if (!data || !isObject(data.reusable_rh_context_json)) return [];
    return sanitizePierreEmployeeList(
      (data.reusable_rh_context_json as Record<string, unknown>).employees,
    );
  } catch { return []; }
}

async function fetchTasksForMission(supabaseAdmin: SupabaseClient, userId: string, missionId: string): Promise<DbRow[]> {
  try {
    const { data } = await supabaseAdmin
      .from("pierre_tasks")
      .select("id, type, title, status, approval_required, execute_at")
      .eq("user_id", userId)
      .eq("agent_slug", "pierre")
      .eq("mission_id", missionId)
      .order("created_at", { ascending: false });
    return (data ?? []) as DbRow[];
  } catch { return []; }
}

// ── Safety matrix ──────────────────────────────────────────

type WorkflowDomainCatalogEntry = {
  domain: PierreHrWorkflowDomain;
  label_fr: string;
  risk_baseline: string;
  approval_required: boolean;
  auto_executable: boolean;
  employee_action_domains: PierreEmployeeActionDomain[];
};

const WORKFLOW_DOMAIN_CATALOG: WorkflowDomainCatalogEntry[] = [
  { domain: "onboarding", label_fr: "Intégration salarié", risk_baseline: "green", approval_required: false, auto_executable: true, employee_action_domains: ["onboarding", "document", "communication"] },
  { domain: "offboarding", label_fr: "Départ salarié", risk_baseline: "orange", approval_required: true, auto_executable: false, employee_action_domains: ["offboarding", "document", "communication"] },
  { domain: "contract", label_fr: "Gestion des contrats", risk_baseline: "red", approval_required: true, auto_executable: false, employee_action_domains: ["contract", "document"] },
  { domain: "absence", label_fr: "Gestion des absences", risk_baseline: "green", approval_required: false, auto_executable: true, employee_action_domains: ["absence", "communication", "followup"] },
  { domain: "payroll_prep", label_fr: "Préparation paie", risk_baseline: "orange", approval_required: true, auto_executable: false, employee_action_domains: ["payroll", "document"] },
  { domain: "employee_file", label_fr: "Dossier salarié", risk_baseline: "green", approval_required: false, auto_executable: true, employee_action_domains: ["document", "note"] },
  { domain: "training", label_fr: "Formation", risk_baseline: "green", approval_required: false, auto_executable: true, employee_action_domains: ["training", "followup"] },
  { domain: "interview", label_fr: "Entretiens RH", risk_baseline: "green", approval_required: false, auto_executable: true, employee_action_domains: ["interview", "document"] },
  { domain: "hiring", label_fr: "Recrutement", risk_baseline: "orange", approval_required: true, auto_executable: false, employee_action_domains: ["contract", "onboarding", "communication"] },
  { domain: "sensitive_case", label_fr: "Cas sensible", risk_baseline: "black", approval_required: true, auto_executable: false, employee_action_domains: ["communication", "document"] },
  { domain: "general_hr", label_fr: "RH général", risk_baseline: "green", approval_required: false, auto_executable: true, employee_action_domains: ["general", "note", "followup"] },
];

// ─────────────────────────────────────────────────────────
// GET /api/pierre/use/workflows/rh
// ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    const url = new URL(request.url);
    const includeCatalog = asBool(url.searchParams.get("include_actions") ?? "false");
    const now = new Date();

    // Safety matrix: maps domain → governance levels available
    const safetyMatrix = WORKFLOW_DOMAIN_CATALOG.map((entry) => ({
      domain: entry.domain,
      label_fr: entry.label_fr,
      risk_baseline: entry.risk_baseline,
      approval_required: entry.approval_required,
      auto_executable: entry.auto_executable,
      employee_action_domains: entry.employee_action_domains,
      sample_actions: entry.employee_action_domains.flatMap(
        (d) => getEmployeeActionsByDomain(d as PierreEmployeeActionDomain).slice(0, 2).map((a) => a.action_type),
      ),
    }));

    const actionCatalog = includeCatalog ? getEmployeeActionCatalog() : undefined;

    return NextResponse.json({
      ok: true,
      workflow_domains: WORKFLOW_DOMAIN_CATALOG,
      safety_matrix: safetyMatrix,
      action_catalog: actionCatalog,
      meta: {
        userId,
        fetchedAt: now.toISOString(),
        total_domains: WORKFLOW_DOMAIN_CATALOG.length,
        total_actions: getEmployeeActionCatalog().length,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code), details: isObject(error.details) ? error.details : null,
      });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/pierre/use/workflows/rh
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    let body: unknown;
    try { body = await request.json(); } catch { body = {}; }

    const input = isObject(body) ? asString(body.input) : null;
    if (!input) return jsonError("input requis.", 400, { code: "INPUT_REQUIRED" });

    const rawEmployeeId = isObject(body) ? asString(body.employee_id) : null;
    const rawEmployeeName = isObject(body) ? asString(body.employee_name) : null;
    const bodyContext = isObject(body) && isObject(body.context) ? body.context : {};
    const dryRun = isObject(body) ? asBool(body.dry_run ?? true) : true;

    const now = new Date();

    const employees = await loadEmployees(supabaseAdmin, userId);
    const rawEmployees = employees as unknown as Record<string, unknown>[];

    // Resolve employee if provided
    const targetEmployee = rawEmployeeId
      ? findPierreEmployeeById(employees, rawEmployeeId)
      : rawEmployeeName
      ? findPierreEmployeeByName(employees, rawEmployeeName)
      : null;

    const employeeContext = targetEmployee
      ? {
          employee_id: targetEmployee.id,
          employee_name: targetEmployee.full_name,
          contract_type: targetEmployee.contract_type ?? null,
          department: targetEmployee.department ?? null,
          status: targetEmployee.status ?? null,
          ...bodyContext,
        }
      : (Object.keys(bodyContext).length > 0 ? bodyContext : null);

    // Workflow analysis
    const domain = detectPierreHrWorkflowDomain(input, employeeContext);
    const riskLevel = detectPierreHrWorkflowRisk(input, domain, employeeContext);
    const priority = detectPierreHrWorkflowPriority(input, domain, riskLevel);

    const plan = buildPierreHrWorkflowPlan(input, {
      employee_context: employeeContext ?? null,
    });

    // Employee action suggestions if employee resolved
    const targetEmployeeRow = targetEmployee
      ? rawEmployees.find((e) => asString(e.id) === targetEmployee!.id)
      : null;

    let employeeActionSuggestions = null;
    let employeeActionSummary = null;

    if (targetEmployeeRow) {
      const suggestions = buildEmployeeActionSuggestions(targetEmployeeRow, [], []);
      employeeActionSuggestions = suggestions;
      employeeActionSummary = buildEmployeeActionSummary(suggestions);
    }

    // Map domain to employee action domain
    const actionDomain = inferEmployeeActionDomain(input);
    const relatedActions = getEmployeeActionsByDomain(actionDomain);

    // Log non-blocking
    void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert({
      user_id: userId,
      agent_slug: "pierre",
      event_type: "workflow_rh_analyzed",
      message: `Workflow RH analysé : ${domain} / ${riskLevel} — ${plan.tasks.length} tâche(s) planifiée(s).`,
      meta_json: {
        domain,
        risk_level: riskLevel,
        priority,
        dry_run: dryRun,
        has_employee: Boolean(targetEmployee),
        employee_id: targetEmployee?.id ?? null,
        tasks_planned: plan.tasks.length,
        analyzed_at: now.toISOString(),
      },
      created_at: now.toISOString(),
    })).catch(() => {});

    // If not dry_run and plan has auto-executable tasks, insert them
    const createdTaskIds: string[] = [];
    if (!dryRun && plan.can_execute_low_risk_tasks && plan.tasks.length > 0) {
      const autoTasks = plan.tasks.filter((t) => !t.approval_required && t.status === "ready");
      for (const t of autoTasks) {
        try {
          const dbTask = mapPierreWorkflowTaskToDbTask(t);
          const { data } = await supabaseAdmin
            .from("pierre_tasks")
            .insert({
              user_id: userId,
              agent_slug: "pierre",
              ...dbTask,
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .select("id")
            .single();
          if (data && asString((data as DbRow).id)) createdTaskIds.push(asString((data as DbRow).id)!);
        } catch (_e) { /* skip individual failures */ }
      }
    }

    return NextResponse.json({
      ok: true,
      analysis: {
        input,
        domain,
        risk_level: riskLevel,
        priority,
        has_employee: Boolean(targetEmployee),
        employee_id: targetEmployee?.id ?? null,
        employee_name: targetEmployee?.full_name ?? null,
      },
      plan,
      related_actions: relatedActions.slice(0, 5),
      employee_action_suggestions: employeeActionSuggestions,
      employee_action_summary: employeeActionSummary,
      tasks_created: dryRun ? null : createdTaskIds,
      dry_run: dryRun,
      meta: {
        userId,
        generatedAt: now.toISOString(),
        employees_loaded: employees.length,
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code), details: isObject(error.details) ? error.details : null,
      });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
