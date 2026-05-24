// src/app/api/pierre/use/scenarios/[scenarioId]/run/route.ts
// Pierre Golden Scenarios — POST run a single scenario.
// Dry-run only. No DB writes. No email. No task execution. No real AI calls.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getGoldenScenarioById,
  isValidGoldenScenarioId,
  normalizePierreGoldenScenarioId,
} from "../../../../../../../lib/pierre/scenarios/golden-registry";
import type { PierreGoldenScenarioId } from "../../../../../../../lib/pierre/scenarios/types";
import { runGoldenScenario } from "../../../../../../../lib/pierre/scenarios/runner";

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
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

async function authenticate(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
): Promise<string> {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> },
) {
  try {
    const supabaseAdmin = createAdminClient();
    await authenticate(request, supabaseAdmin);

    const { scenarioId } = await params;

    if (!scenarioId || !isValidGoldenScenarioId(scenarioId)) {
      return jsonError(`Unknown scenario: ${scenarioId}`, 404, {
        code: "SCENARIO_NOT_FOUND",
      });
    }

    const resolvedId = normalizePierreGoldenScenarioId(scenarioId) ?? (scenarioId as PierreGoldenScenarioId);
    const scenario = getGoldenScenarioById(resolvedId);
    if (!scenario) {
      return jsonError(`Scenario not found: ${scenarioId}`, 404);
    }

    const result = await runGoldenScenario(scenario, { ai_mode: "off", dry_run: true });

    return NextResponse.json({
      ok: true,
      dry_run: true,
      scenario_id: result.scenario_id,
      label: result.label,
      status: result.status,
      expected_status: result.expected_status,
      category: result.category,
      severity: result.severity,
      checks_total: result.checks_total,
      checks_passed: result.checks_passed,
      checks_failed: result.checks_failed,
      check_results: result.check_results,
      artifacts_count: result.artifacts.length,
      demonstrates: result.demonstrates,
      duration_ms: result.duration_ms,
      meta: {
        no_db_writes: true,
        no_email: true,
        ai_mode: "off",
        api_version: "bloc29_v1",
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      "message" in err
    ) {
      const e = err as { status: number; message: string; code?: string };
      return jsonError(e.message, e.status);
    }
    return jsonError("Internal server error", 500);
  }
}
