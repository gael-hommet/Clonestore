// src/app/api/pierre/use/brain/final/dry-run/route.ts
// Pierre Brain Final — dry-run endpoint.
// POST only. Auth required. Never sends email. Never executes task. Never creates mission.
// Returns brain output for a given input without any DB writes.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runPierreFinalBrain } from "../../../../../../../lib/pierre/brain/final-brain";
import { convertPierreBrainTaskPlanToTaskDrafts } from "../../../../../../../lib/pierre/brain/task-bridge";

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

function resolveAiMode(raw: unknown): "off" | "assist" | "primary" {
  if (raw === "primary") return "primary";
  if (raw === "assist") return "assist";
  if (process.env.CLONESTORE_AI_ENABLED === "true") return "assist";
  return "off";
}

export async function POST(request: NextRequest) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body.", 400, { code: "INVALID_JSON" });
    }

    if (!isObject(body)) {
      return jsonError("Request body must be a JSON object.", 400, { code: "BODY_REQUIRED" });
    }

    const input = asString(body.input);
    if (!input) {
      return jsonError("input is required.", 400, { code: "INPUT_REQUIRED" });
    }

    const aiMode = resolveAiMode(body.ai_mode);
    const companyContext = isObject(body.company_context) ? body.company_context : null;
    const employeeContext = isObject(body.employee_context) ? body.employee_context : null;
    const deterministicInterpretation = isObject(body.deterministic_interpretation)
      ? body.deterministic_interpretation
      : null;

    const brainOutput = await runPierreFinalBrain({
      input,
      aiMode,
      companyContext,
      employeeContext,
      deterministicInterpretation,
      deterministicTasks: null,
    });

    const taskDrafts = brainOutput.ai_ok && brainOutput.quality_gate.safe_to_use
      ? convertPierreBrainTaskPlanToTaskDrafts(brainOutput.task_plan, {
          sensitiveTopics: Array.isArray(brainOutput.risk_review.sensitive_topics)
            ? brainOutput.risk_review.sensitive_topics
            : [],
          globalApprovalRequired: brainOutput.risk_review.approval_required,
          maxTasks: 10,
        })
      : [];

    return NextResponse.json({
      ok: true,
      dry_run: true,
      ai_mode: aiMode,
      source: brainOutput.source,
      ai_enabled: brainOutput.ai_enabled,
      ai_ok: brainOutput.ai_ok,
      provider: brainOutput.provider,
      interpretation: brainOutput.interpretation,
      risk_review: brainOutput.risk_review,
      task_plan: {
        tasks: brainOutput.task_plan.tasks,
        validation_points: brainOutput.task_plan.validation_points,
        artifact_expectations: brainOutput.task_plan.artifact_expectations,
        execution_notes: brainOutput.task_plan.execution_notes,
      },
      quality_gate: brainOutput.quality_gate,
      task_drafts_preview: taskDrafts,
      warnings: brainOutput.warnings,
      errors: brainOutput.errors,
      meta: {
        userId,
        fetchedAt: new Date().toISOString(),
        note: "Dry-run — no mission created, no task executed, no email sent.",
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
