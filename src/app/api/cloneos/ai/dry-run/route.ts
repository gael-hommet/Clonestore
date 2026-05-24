// src/app/api/cloneos/ai/dry-run/route.ts
// CloneOS AI dry-run — executes a prompt contract without side effects.
// Always uses mock provider unless AI is explicitly enabled and force_mock is false.
// Never sends email, never creates tasks or missions.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CloneAIUseCase, CloneAIRouterPolicy } from "../../../../../lib/cloneos/ai/types";
import { getCloneAIPromptContract, listCloneAIPromptContracts } from "../../../../../lib/cloneos/ai/prompt-registry";
import { runCloneAIContract } from "../../../../../lib/cloneos/ai/runtime";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
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
        if (typeof candidate === "string") return candidate;
      }
      if (isObject(parsed)) {
        const token =
          typeof parsed.access_token === "string" ? parsed.access_token : null;
        if (token) return token;
      }
    } catch {
      continue;
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

// ── Valid use cases ───────────────────────────────────────────────────────────

const VALID_USE_CASES = new Set<string>(
  listCloneAIPromptContracts().map((c) => c.use_case),
);

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let supabaseAdmin: SupabaseClient;

  try {
    supabaseAdmin = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Service unavailable.", detail: String(err) },
      { status: 503 },
    );
  }

  try {
    await authenticateRequest(request, supabaseAdmin);
  } catch (err) {
    if (isObject(err) && typeof err.status === "number") {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status as number },
      );
    }
    return NextResponse.json({ ok: false, error: "Authentication failed." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isObject(body)) {
    return NextResponse.json({ ok: false, error: "Body must be a JSON object." }, { status: 400 });
  }

  const useCase = body.use_case;
  const variables = body.variables;
  const forceMock = body.force_mock !== false;

  // Validate use_case
  if (typeof useCase !== "string" || !VALID_USE_CASES.has(useCase)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid or unsupported AI use_case.",
        code: "INVALID_AI_USE_CASE",
        valid_use_cases: [...VALID_USE_CASES],
      },
      { status: 400 },
    );
  }

  // Validate variables
  const contract = getCloneAIPromptContract(useCase as CloneAIUseCase);
  if (!contract) {
    return NextResponse.json(
      { ok: false, error: "Prompt contract not found.", code: "INVALID_AI_USE_CASE" },
      { status: 400 },
    );
  }

  if (!isObject(variables)) {
    return NextResponse.json(
      {
        ok: false,
        error: "variables must be a JSON object.",
        code: "AI_VARIABLES_REQUIRED",
        required_variables: contract.required_variables,
      },
      { status: 400 },
    );
  }

  const missingVars = contract.required_variables.filter(
    (v) => !(v in variables) || variables[v] === undefined || variables[v] === null || variables[v] === "",
  );
  if (missingVars.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing required variables for this AI use case.",
        code: "AI_VARIABLES_REQUIRED",
        missing_variables: missingVars,
        required_variables: contract.required_variables,
      },
      { status: 400 },
    );
  }

  // Build policy — force mock if requested (default) or if AI not enabled
  const aiEnabled = process.env.CLONESTORE_AI_ENABLED === "true";
  const shouldUseMock = forceMock || !aiEnabled;

  const policyOverride: Partial<CloneAIRouterPolicy> | undefined = shouldUseMock
    ? { preferred_provider: "mock", fallback_providers: ["mock"] }
    : undefined;

  try {
    const result = await runCloneAIContract({
      useCase: useCase as CloneAIUseCase,
      variables: variables as Record<string, unknown>,
      policy: policyOverride,
    });

    return NextResponse.json(
      {
        ok: result.ok,
        dry_run: true,
        forced_mock: shouldUseMock,
        use_case: useCase,
        provider: result.provider,
        model_profile: result.model_profile,
        output_mode: contract.output_mode,
        content: result.content,
        json: result.json,
        usage: result.usage,
        latency_ms: result.latency_ms,
        warnings: result.warnings,
        error: result.error,
      },
      { status: result.ok ? 200 : 502 },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "AI dry-run failed unexpectedly.", detail: String(err) },
      { status: 500 },
    );
  }
}
