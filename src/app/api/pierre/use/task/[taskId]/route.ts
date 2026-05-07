import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { hasPierreAccess } from "@/lib/pierre/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceRole) {
    throw new Error("Supabase admin env is missing.");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function tryParseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractTokenFromCookieValue(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;

  if (clean.startsWith("eyJ") && clean.split(".").length >= 3) {
    return clean;
  }

  const parsed = tryParseJsonString(clean);

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (
        typeof item === "string" &&
        item.startsWith("eyJ") &&
        item.split(".").length >= 3
      ) {
        return item;
      }
    }
  }

  if (isPlainObject(parsed)) {
    const currentSession = isPlainObject(parsed.currentSession)
      ? parsed.currentSession
      : null;

    const session = isPlainObject(parsed.session) ? parsed.session : null;

    const candidates = [
      parsed.access_token,
      parsed.accessToken,
      parsed.token,
      currentSession?.access_token,
      session?.access_token,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === "string" &&
        candidate.startsWith("eyJ") &&
        candidate.split(".").length >= 3
      ) {
        return candidate;
      }
    }
  }

  return null;
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  for (const cookie of request.cookies.getAll()) {
    const name = cookie.name.toLowerCase();

    if (
      name.includes("auth-token") ||
      name.includes("access-token") ||
      name.startsWith("sb-")
    ) {
      const token = extractTokenFromCookieValue(cookie.value);
      if (token) return token;
    }
  }

  return null;
}

async function resolveUser(
  supabase: SupabaseClient,
  request: NextRequest,
): Promise<User | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

function sortDesc<T extends { updated_at?: string | null; created_at?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const da = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const db = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return db - da;
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const taskId = trimOrNull(params.taskId);

    if (!taskId) {
      return json(
        {
          ok: false,
          error: "taskId manquant.",
          code: "TASK_ID_MISSING",
        },
        400,
      );
    }

    const supabase = getSupabaseAdmin();
    const user = await resolveUser(supabase, request);

    if (!user) {
      return json(
        {
          ok: false,
          error: "Session utilisateur manquante ou invalide.",
          code: "AUTH_REQUIRED",
        },
        401,
      );
    }

    const access = await hasPierreAccess(supabase, user.id);

    if (access.error) {
      return json(
        {
          ok: false,
          error: access.error,
          code: "PIERRE_ACCESS_CHECK_FAILED",
        },
        500,
      );
    }

    if (!access.ok) {
      return json(
        {
          ok: false,
          error: "Pierre n’est pas actif sur ce compte.",
          code: "PIERRE_ACCESS_DENIED",
        },
        403,
      );
    }

    const { data: task, error: taskError } = await supabase
      .from("pierre_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (taskError) throw taskError;

    if (!task) {
      return json(
        {
          ok: false,
          error: "Tâche Pierre introuvable.",
          code: "TASK_NOT_FOUND",
        },
        404,
      );
    }

    const [logsResult, documentsResult, emailsResult] = await Promise.all([
      supabase
        .from("pierre_task_logs")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),

      supabase
        .from("pierre_documents")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),

      supabase
        .from("pierre_outbound_emails")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);

    if (logsResult.error) throw logsResult.error;
    if (documentsResult.error) throw documentsResult.error;
    if (emailsResult.error) throw emailsResult.error;

    return json({
      ok: true,
      task,
      logs: sortDesc(Array.isArray(logsResult.data) ? logsResult.data : []),
      documents: sortDesc(
        Array.isArray(documentsResult.data) ? documentsResult.data : [],
      ),
      outbound_emails: sortDesc(
        Array.isArray(emailsResult.data) ? emailsResult.data : [],
      ),
      auth: "resolved",
    });
  } catch (error) {
    console.error("[pierre/use/task/[taskId]][GET]", error);

    return json(
      {
        ok: false,
        error: "Impossible de charger la tâche Pierre.",
        code: "TASK_LOAD_FAILED",
      },
      500,
    );
  }
}
