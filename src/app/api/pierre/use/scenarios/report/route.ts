// src/app/api/pierre/use/scenarios/report/route.ts
// Pierre Golden Scenarios — GET executive report (runs full suite fresh).
// Read-only. No DB writes. No email. No task execution.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runGoldenScenarioSuite } from "../../../../../../lib/pierre/scenarios/runner";
import {
  buildGoldenScenarioReport,
  buildModuleCoverageReport,
} from "../../../../../../lib/pierre/scenarios/report";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
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

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    await authenticate(request, supabaseAdmin);

    // Run full suite (ai_mode off = mock only, no real AI calls)
    const suiteResult = await runGoldenScenarioSuite({ ai_mode: "off", dry_run: true });
    const report = buildGoldenScenarioReport(suiteResult);
    const moduleCoverage = buildModuleCoverageReport(suiteResult);

    return NextResponse.json({
      ok: true,
      generated_at: report.generated_at,
      dry_run: true,
      report: {
        level: report.level,
        level_label: report.level_label,
        suite_status: report.suite_status,
        score: report.score,
        sellable: report.sellable,
        scenarios_total: report.scenarios_total,
        scenarios_passed: report.scenarios_passed,
        scenarios_failed: report.scenarios_failed,
        executive_summary: report.executive_summary,
        positive_highlights: report.positive_highlights,
        negative_findings: report.negative_findings,
        recommendation: report.recommendation,
        critical_failures: report.critical_failures,
        modules_validated: report.modules_validated,
      },
      module_coverage: moduleCoverage,
      suite_stats: {
        scenarios_total: suiteResult.scenarios_total,
        scenarios_passed: suiteResult.scenarios_passed,
        scenarios_failed: suiteResult.scenarios_failed,
        scenarios_warned: suiteResult.scenarios_warned,
        checks_total: suiteResult.checks_total,
        checks_passed: suiteResult.checks_passed,
        checks_failed: suiteResult.checks_failed,
        duration_ms: suiteResult.duration_ms,
      },
      meta: {
        no_db_writes: true,
        no_email: true,
        ai_mode: "off",
        api_version: "bloc29_v1",
        canonical_route: "/api/pierre/use/scenarios/report",
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
