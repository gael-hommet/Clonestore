import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateGovernance,
  buildGovernancePreview,
  buildGovernanceAuditEvent,
  buildGovernanceBriefing,
  buildGovernanceCard,
  type PierreGovernanceContext,
} from "../../../../../../lib/pierre/hr/governance";
import { evaluatePierreCloneGuard } from "../../../../../../lib/pierre/hr/cloneguard";
import { evaluatePierreClonePolicy } from "../../../../../../lib/pierre/hr/clonepolicy";
import { evaluatePierreCloneTrust } from "../../../../../../lib/pierre/hr/clonetrust";

type JsonErrorExtra = { code?: string | null; details?: unknown };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asString(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}
function asBool(v: unknown): boolean | undefined {
  if (v === true || v === "true" || v === "1") return true;
  if (v === false || v === "false" || v === "0") return false;
  return undefined;
}
function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = parseFloat(v); if (Number.isFinite(n)) return n; }
  return undefined;
}
function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}
function mapDbError(error: unknown) {
  if (isObject(error)) return { message: asString(error.message) || "Unexpected database error.", code: asString(error.code) };
  if (error instanceof Error) return { message: error.message, code: null };
  return { message: "Unexpected database error.", code: null };
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured.");
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

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

// ── POST /api/pierre/use/governance/evaluate ──────────────

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticateRequest(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) return jsonError("Accès Pierre requis.", 403, { code: "PIERRE_ACCESS_DENIED" });

    let body: Record<string, unknown> = {};
    try { const raw = await request.json(); if (isObject(raw)) body = raw; } catch { /* empty body ok */ }

    const now = new Date();

    const ctx: PierreGovernanceContext = {
      task_type: asString(body.task_type),
      task_title: asString(body.task_title),
      task_description: asString(body.task_description),
      payload_json: isObject(body.payload_json) ? body.payload_json : null,
      domain: asString(body.domain),
      action_kind: asString(body.action_kind),
      risk_level_hint: asString(body.risk_level_hint),
      autonomy_level: asString(body.autonomy_level),
      approval_required: asBool(body.approval_required),
      employee_id: asString(body.employee_id),
      employee_name: asString(body.employee_name),
      employee_site: asString(body.employee_site),
      employee_department: asString(body.employee_department),
      mission_id: asString(body.mission_id),
      mission_summary: asString(body.mission_summary),
      text_corpus: asString(body.text_corpus),
      company_trust_score: asNumber(body.company_trust_score),
      historical_success_rate: asNumber(body.historical_success_rate),
      historical_task_count: asNumber(body.historical_task_count),
      employee_file_risk: asString(body.employee_file_risk),
      company_memory: isObject(body.company_memory) ? body.company_memory : null,
      runtime_policy_rules: Array.isArray(body.runtime_policy_rules) ? body.runtime_policy_rules : undefined,
      now: now.toISOString(),
    };

    const guardEval = evaluatePierreCloneGuard({ ...ctx, now: ctx.now });
    const policyEval = evaluatePierreClonePolicy({ ...ctx });
    const trustEval = evaluatePierreCloneTrust({ ...ctx });
    const evaluation = evaluateGovernance({
      ...ctx,
      guard_evaluation: guardEval,
      policy_evaluation: policyEval,
      trust_evaluation: trustEval,
    });
    const preview = buildGovernancePreview(evaluation);
    const briefing = buildGovernanceBriefing(evaluation, guardEval, policyEval, trustEval);
    const card = buildGovernanceCard(evaluation, ctx);
    const auditEvent = buildGovernanceAuditEvent(evaluation, ctx);

    // Non-blocking audit log
    void Promise.resolve(supabaseAdmin.from("pierre_task_logs").insert({
      user_id: userId,
      agent_slug: "pierre",
      event_type: auditEvent.event_type,
      message: auditEvent.message,
      meta_json: {
        ...auditEvent.meta_json,
        task_type: ctx.task_type,
        task_id: asString(body.task_id),
        mission_id: ctx.mission_id,
      },
    })).catch(() => {});

    return NextResponse.json({
      ok: true,
      evaluation,
      preview,
      briefing,
      card,
      meta: {
        canonical_route: "/api/pierre/use/governance/evaluate",
        userId,
        evaluatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status as number, {
        code: asString(error.code),
        details: isObject(error.details) ? error.details : null,
      });
    }
    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, { code: mapped.code });
  }
}
