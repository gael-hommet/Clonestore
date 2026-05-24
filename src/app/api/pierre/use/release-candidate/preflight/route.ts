// src/app/api/pierre/use/release-candidate/preflight/route.ts
// Pierre Release Candidate — POST full preflight (can include golden suite).
// Read-only. No DB write. No email. No task execution. No mission creation.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildPierreReleaseCandidatePreflight,
} from "../../../../../../lib/pierre/release-candidate/preflight";
import {
  buildPierreReleaseCandidateExecutiveSummary,
  renderPierreReleaseCandidateMarkdown,
} from "../../../../../../lib/pierre/release-candidate/report";

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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient();
    await authenticate(request, supabaseAdmin);

    let body: Record<string, unknown> = {};
    try {
      const raw = await request.json();
      if (isObject(raw)) body = raw;
    } catch {
      // empty body = defaults
    }

    const includeGoldenSuite = body.include_golden_suite === true;
    const aiMode =
      body.ai_mode === "assist" || body.ai_mode === "primary"
        ? (body.ai_mode as "assist" | "primary")
        : "off";
    const forceMock = body.force_mock !== false;

    const report = await buildPierreReleaseCandidatePreflight({
      includeGoldenSuite,
      aiMode,
      forceMock,
    });

    const executive_summary = buildPierreReleaseCandidateExecutiveSummary(report);
    const markdown = renderPierreReleaseCandidateMarkdown(report);

    return NextResponse.json({
      ok: true,
      report,
      executive_summary,
      markdown,
      meta: {
        read_only: true,
        no_db_writes: true,
        no_email: true,
        no_execution: true,
        golden_suite_included: includeGoldenSuite,
        ai_mode: aiMode,
        force_mock: forceMock,
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
