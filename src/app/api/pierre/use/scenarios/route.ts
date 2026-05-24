// src/app/api/pierre/use/scenarios/route.ts
// Pierre Golden Scenarios — GET list of all scenarios.
// Read-only. No DB writes. No email. No task execution.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getGoldenScenarioRegistry,
  getPositiveScenarios,
  getNegativeScenarios,
  getCriticalScenarios,
} from "../../../../../lib/pierre/scenarios/golden-registry";
import { buildScenarioSummaryList } from "../../../../../lib/pierre/scenarios/runner";
import { listGoldenFixtureKeys } from "../../../../../lib/pierre/scenarios/fixtures";

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

    const registry = getGoldenScenarioRegistry();
    const summaries = buildScenarioSummaryList();
    const fixtureKeys = listGoldenFixtureKeys();

    const positive = getPositiveScenarios();
    const negative = getNegativeScenarios();
    const critical = getCriticalScenarios();

    return NextResponse.json({
      ok: true,
      scenarios_total: registry.length,
      scenarios_positive: positive.length,
      scenarios_negative: negative.length,
      scenarios_critical: critical.length,
      scenarios: summaries,
      fixture_keys: fixtureKeys,
      meta: {
        dry_run_only: true,
        no_db_writes: true,
        no_email: true,
        no_task_execution: true,
        api_version: "bloc29_v1",
        canonical_route: "/api/pierre/use/scenarios",
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
