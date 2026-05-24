// src/app/api/pierre/use/brain/contracts/route.ts
// Pierre Brain Contracts — lists all brain-related prompt contracts.
// GET only. Auth required. Never exposes full system prompts.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { listCloneAIPromptContracts } from "../../../../../../lib/cloneos/ai/prompt-registry";

type JsonErrorExtra = {
  code?: string | null;
  details?: unknown;
};

const BRAIN_USE_CASE_PREFIX = "pierre.brain.";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
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
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

async function authenticate(request: NextRequest, supabaseAdmin: SupabaseClient): Promise<string> {
  const token = tryReadBearerToken(request);
  if (!token) {
    throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
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
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    const userId = await authenticate(request, supabaseAdmin);

    const access = await hasPierreAccess(supabaseAdmin, userId);
    if (!access) {
      return jsonError(
        "Accès Pierre requis. Activez votre abonnement Pierre pour continuer.",
        403,
        { code: "PIERRE_ACCESS_DENIED" },
      );
    }

    const allContracts = listCloneAIPromptContracts();
    const brainContracts = allContracts
      .filter((c) => c.use_case.startsWith(BRAIN_USE_CASE_PREFIX))
      .map((c) => ({
        id: c.id,
        use_case: c.use_case,
        version: c.version,
        model_profile: c.model_profile,
        output_mode: c.output_mode,
        required_variables: c.required_variables,
        optional_variables: c.optional_variables,
        max_input_chars: c.max_input_chars,
        system_prompt_preview: c.system_prompt.slice(0, 200),
        has_json_schema: !!(c.json_schema && Object.keys(c.json_schema).length > 0),
      }));

    return NextResponse.json({
      ok: true,
      brain_contracts: brainContracts,
      count: brainContracts.length,
      use_cases: brainContracts.map((c) => c.use_case),
      meta: {
        userId,
        fetchedAt: new Date().toISOString(),
        note: "System prompts are truncated to 200 chars for security.",
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status,
        { code: asString(error.code) },
      );
    }
    const msg = error instanceof Error ? error.message : "Unexpected error.";
    return jsonError(msg, 500, { code: "INTERNAL_ERROR" });
  }
}
