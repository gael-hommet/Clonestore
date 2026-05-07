import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { processNextPierreTask } from "@/lib/pierre/queue/process-next";

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
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
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured.");

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

function tryReadSupabaseCookieToken(request: NextRequest): string | null {
  const cookies = request.cookies.getAll();

  for (const key of ["sb-access-token", "supabase-access-token", "access-token"]) {
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
        if (candidate) return candidate;
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

async function authenticateWorkerRequest(
  request: NextRequest,
  supabaseAdmin: SupabaseClient,
) {
  const workerSecret = process.env.PIERRE_QUEUE_WORKER_SECRET;
  const requestSecret = request.headers.get("x-pierre-worker-secret");

  if (workerSecret && requestSecret && requestSecret === workerSecret) {
    return { mode: "worker_secret" as const };
  }

  const accessToken =
    tryReadBearerToken(request) || tryReadSupabaseCookieToken(request);

  if (!accessToken) {
    throw { status: 401, message: "Auth session missing.", code: "AUTH_SESSION_MISSING" };
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

  return { mode: "user_auth" as const, userId: data.user.id };
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
    return { message: error.message, code: null, details: null };
  }
  return { message: "Unexpected database error.", code: null, details: null };
}

function normalizeBody(raw: unknown) {
  if (!isObject(raw)) {
    return {
      workerId: null,
      lockMinutes: undefined as number | undefined,
      onlyUserId: null,
    };
  }

  return {
    workerId: asString(raw.workerId),
    lockMinutes: asNumber(raw.lockMinutes) ?? undefined,
    onlyUserId: asString(raw.onlyUserId),
  };
}

function buildQueueSourceAdapter(
  supabaseAdmin: SupabaseClient,
  onlyUserId?: string | null,
) {
  return {
    fetchNextRunnableTask: async ({ now }: { now: Date }): Promise<DbRow | null> => {
      let query = supabaseAdmin
        .from("pierre_tasks")
        .select(`
          *,
          pierre_missions!inner (
            id,
            user_id
          )
        `)
        .in("status", ["pending", "queued", "scheduled"])
        .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
        .order("scheduled_for", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true })
        .limit(1);

      if (onlyUserId) {
        query = query.eq("pierre_missions.user_id", onlyUserId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw new Error(`Unable to fetch next runnable task: ${error.message}`);
      }

      return (data ?? null) as DbRow | null;
    },
  };
}

function buildPersistenceAdapter(supabaseAdmin: SupabaseClient) {
  return {
    updateTask: async (taskId: string, patch: Record<string, unknown>) => {
      const { error } = await supabaseAdmin
        .from("pierre_tasks")
        .update(patch)
        .eq("id", taskId);

      if (error) {
        throw new Error(`Unable to update task: ${error.message}`);
      }
    },
    insertTaskLog: async (entry: {
      mission_id?: string | null;
      task_id?: string | null;
      level: "info" | "warning" | "error";
      event: string;
      message: string;
      payload?: Record<string, unknown> | null;
    }) => {
      const { error } = await supabaseAdmin.from("pierre_task_logs").insert({
        mission_id: entry.mission_id ?? null,
        task_id: entry.task_id ?? null,
        level: entry.level,
        event: entry.event,
        message: entry.message,
        payload: entry.payload ?? null,
      });

      if (error) {
        throw new Error(`Unable to insert task log: ${error.message}`);
      }
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = normalizeBody(await request.json().catch(() => null));
    const supabaseAdmin = createAdminClient();
    const auth = await authenticateWorkerRequest(request, supabaseAdmin);

    const workerId =
      body.workerId ||
      (auth.mode === "user_auth" ? `api-user-${auth.userId}` : "queue-worker");

    const onlyUserId = auth.mode === "user_auth" ? auth.userId : body.onlyUserId;

    const result = await processNextPierreTask({
      workerId,
      queueSource: buildQueueSourceAdapter(supabaseAdmin, onlyUserId) as any,
      persistence: buildPersistenceAdapter(supabaseAdmin),
      now: new Date(),
      lockMinutes: body.lockMinutes,
    });

    return NextResponse.json({
      ok: result.ok,
      result,
      meta: {
        workerId,
        onlyUserId: onlyUserId || null,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (isObject(error) && typeof error.status === "number") {
      return jsonError(asString(error.message) || "Request failed.", error.status, {
        code: asString(error.code),
        details: error.details ?? null,
      });
    }

    const mapped = mapDbError(error);
    return jsonError(mapped.message, 500, {
      code: mapped.code,
      details: mapped.details,
    });
  }
}

