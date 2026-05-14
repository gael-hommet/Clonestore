import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildMissionContinuityInsight,
  buildContinuePlan,
} from "../../../../../../lib/pierre/hr/continuity";

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

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

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function getNestedObject(
  source: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!source) return null;
  const value = source[key];
  return isObject(value) ? value : null;
}

function getNestedString(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!source) return null;
  return asString(source[key]);
}

function jsonError(message: string, status: number, extra?: JsonErrorExtra) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(extra ?? {}),
    },
    { status },
  );
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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
  const cookies = request.cookies.getAll();

  const directCandidates = [
    "sb-access-token",
    "supabase-access-token",
    "access-token",
  ];

  for (const key of directCandidates) {
    const found = request.cookies.get(key)?.value;
    if (found) return found;
  }

  for (const cookie of cookies) {
    if (!cookie.name.includes("auth-token")) continue;

    const raw = cookie.value;
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        const candidate = parsed.find(
          (item): item is string =>
            typeof item === "string" && item.split(".").length === 3,
        );
        if (typeof candidate === "string") return candidate;
      }

      if (isObject(parsed)) {
        const currentSession = getNestedObject(parsed, "currentSession");

        const candidate =
          getNestedString(parsed, "access_token") ||
          getNestedString(currentSession, "access_token");

        if (candidate) return candidate;
      }
    } catch {
      if (raw.split(".").length === 3) return raw;
    }
  }

  return null;
}

async function authenticateRequest(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
): Promise<AuthenticatedContext> {
  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw {
      status: 401,
      message: "Auth session missing.",
      code: "AUTH_SESSION_MISSING",
    };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw {
      status: 401,
      message: "Unable to authenticate request.",
      code: "AUTH_INVALID",
      details: error?.message || null,
    };
  }

  return {
    userId: data.user.id,
    accessToken,
  };
}

function mapDbError(error: unknown) {
  if (isObject(error)) {
    return {
      message:
        asString(error.message) ||
        asString(error.error_description) ||
        "Unexpected database error.",
      code: asString(error.code),
      details: error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: null,
      details: null,
    };
  }

  return {
    message: "Unexpected database error.",
    code: null,
    details: null,
  };
}

async function verifyMissionOwnership(
  supabaseAdmin: SupabaseClient,
  missionId: string,
  userId: string,
): Promise<DbRow> {
  const { data, error } = await supabaseAdmin
    .from("pierre_missions")
    .select("*")
    .eq("id", missionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission.",
      code: "MISSION_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  if (!data) {
    throw {
      status: 404,
      message: "Mission not found.",
      code: "MISSION_NOT_FOUND",
    };
  }

  return data satisfies DbRow;
}

async function fetchMissionTasks(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_tasks")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission tasks.",
      code: "TASKS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function fetchMissionLogs(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_task_logs")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission logs.",
      code: "LOGS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function fetchMissionDocuments(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_documents")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission documents.",
      code: "DOCUMENTS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

async function fetchMissionOutboundEmails(
  supabaseAdmin: SupabaseClient,
  missionId: string,
): Promise<DbRow[]> {
  const { data, error } = await supabaseAdmin
    .from("pierre_outbound_emails")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw {
      status: 500,
      message: "Unable to load mission outbound emails.",
      code: "EMAILS_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? []) as DbRow[];
}

function extractPdfCandidates(documents: DbRow[]): DbRow[] {
  return documents.filter((document) => {
    const docType = (asString(document.doc_type) || "").toLowerCase();
    const filename = (asString(document.filename) || "").toLowerCase();
    const storagePath = (asString(document.storage_path) || "").toLowerCase();
    const mimeType = (asString(document.mime_type) || "").toLowerCase();

    return (
      docType.includes("pdf") ||
      filename.endsWith(".pdf") ||
      storagePath.endsWith(".pdf") ||
      mimeType === "application/pdf"
    );
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ missionId: string }> },
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const missionId = asString(resolvedParams?.missionId);

    if (!missionId) {
      return jsonError("Mission id is required.", 400, {
        code: "MISSION_ID_REQUIRED",
      });
    }

    const supabaseAdmin = createAdminClient();
    const auth = await authenticateRequest(request, supabaseAdmin);

    const mission = await verifyMissionOwnership(
      supabaseAdmin,
      missionId,
      auth.userId,
    );

    const [tasks, logs, documents, outboundEmails] = await Promise.all([
      fetchMissionTasks(supabaseAdmin, missionId),
      fetchMissionLogs(supabaseAdmin, missionId),
      fetchMissionDocuments(supabaseAdmin, missionId),
      fetchMissionOutboundEmails(supabaseAdmin, missionId),
    ]);

    const pdfs = extractPdfCandidates(documents);

    const now = new Date();
    const missionInsight = buildMissionContinuityInsight(mission, tasks, { now });
    const continuePlan = buildContinuePlan(mission, tasks, { now });

    return NextResponse.json({
      ok: true,
      mission,
      interpretation: mission.interpretation ?? null,
      tasks,
      logs,
      documents,
      outbound_emails: outboundEmails,
      pdfs,
      continuity: {
        mission_insight: missionInsight,
        continue_plan: continuePlan,
      },
      meta: {
        missionId,
        userId: auth.userId,
        fetchedAt: now.toISOString(),
        counts: {
          tasks: tasks.length,
          logs: logs.length,
          documents: documents.length,
          outbound_emails: outboundEmails.length,
          pdfs: pdfs.length,
        },
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(
        asString(error.message) || "Request failed.",
        error.status,
        {
          code: asString(error.code),
          details: error.details ?? null,
        },
      );
    }

    const mapped = mapDbError(error);

    return jsonError(mapped.message, 500, {
      code: mapped.code,
      details: mapped.details,
    });
  }
}