// src/app/api/pierre/use/release-candidate/invariants/route.ts
// Pierre Release Candidate — POST invariant audit on provided data.
// Read-only. No DB write. No email. No task execution. No mission creation.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  auditPierreGlobalInvariants,
} from "../../../../../../lib/pierre/release-candidate/invariant-auditor";
import {
  buildPierreReleaseCandidateReport,
  scoreRCChecks,
} from "../../../../../../lib/pierre/release-candidate/checks";

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

function safeArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is Record<string, unknown> => isObject(item));
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
      // empty body = audit with empty/defaults
    }

    const tasks = safeArray(body.tasks);
    const logs = safeArray(body.logs);
    const memory = isObject(body.memory) ? body.memory : null;
    const documents = safeArray(body.documents);
    const aiStatus = body.aiStatus !== undefined ? body.aiStatus : undefined;
    const scenarioSuite = body.scenarioSuite !== undefined ? body.scenarioSuite : undefined;

    const checks = auditPierreGlobalInvariants({
      tasks,
      logs,
      memory,
      documents,
      aiStatus,
      scenarioSuite,
    });

    const score = scoreRCChecks(checks);
    const failures = checks.filter((c) => c.status === "fail");
    const warnings = checks.filter((c) => c.status === "warning");
    const passes = checks.filter((c) => c.status === "pass");

    const report = buildPierreReleaseCandidateReport({
      checks,
      version: "30.0.0",
      generatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      checks,
      checks_total: checks.length,
      checks_passed: passes.length,
      checks_failed: failures.length,
      checks_warned: warnings.length,
      score,
      report,
      meta: {
        read_only: true,
        no_db_writes: true,
        no_email: true,
        no_execution: true,
        audited_tasks: tasks.length,
        audited_logs: logs.length,
        audited_documents: documents.length,
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
