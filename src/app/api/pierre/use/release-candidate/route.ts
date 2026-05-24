// src/app/api/pierre/use/release-candidate/route.ts
// Pierre Release Candidate — GET basic report (fast, no golden suite).
// Read-only. No DB write. No email. No task execution. No mission creation.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildPierreReleaseCandidatePreflight,
} from "../../../../../lib/pierre/release-candidate/preflight";
import {
  buildPierreReleaseCandidateExecutiveSummary,
} from "../../../../../lib/pierre/release-candidate/report";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error: message, ...(code ? { code } : {}) }, { status });
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
  if (!token) throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw { status: 401, message: "Unable to authenticate request.", code: "AUTH_INVALID" };
  return data.user.id;
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    await authenticate(request, supabaseAdmin);

    // Run preflight without golden suite for speed
    const report = await buildPierreReleaseCandidatePreflight({
      includeGoldenSuite: false,
      aiMode: "off",
      forceMock: true,
    });

    const executive_summary = buildPierreReleaseCandidateExecutiveSummary(report);

    return NextResponse.json({
      ok: true,
      report,
      executive_summary,
      meta: {
        read_only: true,
        no_db_writes: true,
        no_email: true,
        no_execution: true,
        golden_suite_included: false,
        generatedAt: report.generated_at,
        api_version: "bloc30_v1",
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && "message" in err) {
      const e = err as { status: number; message: string; code?: string };
      return jsonError(e.message, e.status, e.code);
    }
    return jsonError("Internal server error", 500);
  }
}
