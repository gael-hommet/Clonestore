// src/app/api/pierre/use/scenarios/run-suite/route.ts
// Pierre Golden Scenarios — POST run the full scenario suite.
// Dry-run only. No DB writes. No email. No task execution.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PierreGoldenScenarioId } from "../../../../../../lib/pierre/scenarios/types";
import { isValidGoldenScenarioId } from "../../../../../../lib/pierre/scenarios/golden-registry";
import { runGoldenScenarioSuite } from "../../../../../../lib/pierre/scenarios/runner";
import { buildGoldenScenarioReport } from "../../../../../../lib/pierre/scenarios/report";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

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

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    await authenticate(request, supabaseAdmin);

    let body: Record<string, unknown> = {};
    try {
      const rawBody = await request.text();
      if (rawBody.trim().length > 0) {
        const parsed = JSON.parse(rawBody);
        if (isObject(parsed)) body = parsed;
      }
    } catch {
      // empty body is valid
    }

    // Parse optional scenario_ids filter
    let scenarioIds: PierreGoldenScenarioId[] | undefined;
    if (Array.isArray(body["scenario_ids"])) {
      const filtered = body["scenario_ids"].filter(
        (id): id is PierreGoldenScenarioId =>
          typeof id === "string" && isValidGoldenScenarioId(id),
      );
      if (filtered.length > 0) scenarioIds = filtered;
    }

    const suiteResult = await runGoldenScenarioSuite({
      scenario_ids: scenarioIds,
      ai_mode: "off",
      dry_run: true,
    });

    const report = buildGoldenScenarioReport(suiteResult);

    return NextResponse.json({
      ok: true,
      dry_run: true,
      suite_status: suiteResult.suite_status,
      scenarios_total: suiteResult.scenarios_total,
      scenarios_passed: suiteResult.scenarios_passed,
      scenarios_failed: suiteResult.scenarios_failed,
      scenarios_warned: suiteResult.scenarios_warned,
      checks_total: suiteResult.checks_total,
      checks_passed: suiteResult.checks_passed,
      checks_failed: suiteResult.checks_failed,
      duration_ms: suiteResult.duration_ms,
      executive_summary: suiteResult.executive_summary,
      critical_failures: suiteResult.critical_failures,
      modules_validated: suiteResult.modules_validated,
      report: {
        level: report.level,
        level_label: report.level_label,
        score: report.score,
        sellable: report.sellable,
        recommendation: report.recommendation,
      },
      results: suiteResult.results.map((r) => ({
        scenario_id: r.scenario_id,
        label: r.label,
        status: r.status,
        category: r.category,
        severity: r.severity,
        checks_passed: r.checks_passed,
        checks_total: r.checks_total,
        duration_ms: r.duration_ms,
      })),
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
