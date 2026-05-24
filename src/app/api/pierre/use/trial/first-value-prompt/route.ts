import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildPierreTrialFirstValuePrompt,
  buildPierreTrialMissionTemplates,
  type PierreTrialMissionTemplateKey,
} from "../../../../../../lib/pierre/hr/trial-activation";

type JsonErrorExtra = { code?: string | null; details?: unknown };

const VALID_TEMPLATE_KEYS = new Set<PierreTrialMissionTemplateKey>([
  "audit_rh_initial",
  "create_employee_file",
  "generate_contract_or_document",
  "absence_followup",
  "onboarding_plan",
  "prepay_summary",
  "employee_file_review",
  "sensitive_case_review",
  "offboarding_plan",
  "hr_weekly_briefing",
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!isObject(body)) {
    return jsonError("Invalid request body.", 400, { code: "INVALID_BODY" });
  }

  const templateKey = asString(body["template_key"]);
  if (!templateKey) {
    return jsonError(
      "template_key is required.",
      400,
      { code: "MISSING_TEMPLATE_KEY" },
    );
  }

  if (!VALID_TEMPLATE_KEYS.has(templateKey as PierreTrialMissionTemplateKey)) {
    return jsonError(
      `Invalid template_key: "${templateKey}". Valid keys: ${Array.from(VALID_TEMPLATE_KEYS).join(", ")}`,
      400,
      { code: "INVALID_TRIAL_TEMPLATE_KEY" },
    );
  }

  const companyName = asString(body["company_name"]);
  const employeeName = asString(body["employee_name"]);
  const role = asString(body["role"]);

  const result = buildPierreTrialFirstValuePrompt({
    template_key: templateKey as PierreTrialMissionTemplateKey,
    company_name: companyName,
    employee_name: employeeName,
    role,
  });

  return NextResponse.json({
    ok: true,
    template_key: result.template_key,
    title: result.title,
    prompt: result.prompt,
    required_inputs: result.required_inputs,
    expected_outputs: result.expected_outputs,
    requires_human_validation: result.requires_human_validation,
    meta: {
      userId,
      generatedAt: new Date().toISOString(),
    },
  });
}

export async function GET(request: NextRequest) {
  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return jsonError("Server configuration error.", 500, { code: "CONFIG_ERROR" });
  }

  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
    }
    const [scheme, token] = authHeader.split(" ");
    if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
      throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token.trim());
    if (error || !data.user) {
      throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
    }
  } catch (e) {
    if (isObject(e) && typeof e.status === "number") {
      return jsonError(asString(e.message) || "Auth error.", e.status, { code: asString(e.code) });
    }
    return jsonError("Auth error.", 401, { code: "AUTH_ERROR" });
  }

  const templates = buildPierreTrialMissionTemplates();
  const validKeys = Array.from(VALID_TEMPLATE_KEYS);

  return NextResponse.json({
    ok: true,
    valid_template_keys: validKeys,
    templates: templates.map((t) => ({
      key: t.key,
      title: t.title,
      risk_level: t.risk_level,
      requires_human_validation: t.requires_human_validation,
      required_inputs: t.required_inputs,
    })),
    usage: "POST /api/pierre/use/trial/first-value-prompt with { template_key, company_name?, employee_name?, role? }",
  });
}
