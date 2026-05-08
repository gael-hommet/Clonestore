import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  processNextPierreTask,
  type PierreQueueSourceAdapter,
} from "@/lib/pierre/queue/process-next";
import type { PierreQueuePersistenceAdapter } from "@/lib/pierre/queue/process-task";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbRow = Record<string, unknown>;
type JsonErrorExtra = { code?: string | null; details?: unknown };

type AuthWorkerContext =
  | {
      mode: "worker_secret";
      userId?: null;
    }
  | {
      mode: "user_auth";
      userId: string;
    };

type RunNextBody = {
  workerId?: string | null;
  lockMinutes?: number | null;
  onlyUserId?: string | null;
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

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item));
  }

  const single = asString(value);
  return single ? [single] : [];
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

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

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

  for (const key of [
    "sb-access-token",
    "supabase-access-token",
    "access-token",
  ]) {
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
        const session = getNestedObject(parsed, "session");

        const candidate =
          getNestedString(parsed, "access_token") ||
          getNestedString(parsed, "accessToken") ||
          getNestedString(currentSession, "access_token") ||
          getNestedString(session, "access_token");

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
): Promise<AuthWorkerContext> {
  const workerSecret = process.env.PIERRE_QUEUE_WORKER_SECRET;
  const requestSecret = request.headers.get("x-pierre-worker-secret");

  if (workerSecret && requestSecret && requestSecret === workerSecret) {
    return { mode: "worker_secret" };
  }

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
    mode: "user_auth",
    userId: data.user.id,
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

function normalizeBody(raw: unknown): RunNextBody {
  if (!isObject(raw)) {
    return {
      workerId: null,
      lockMinutes: null,
      onlyUserId: null,
    };
  }

  return {
    workerId: asString(raw.workerId) || asString(raw.worker_id),
    lockMinutes: asNumber(raw.lockMinutes) ?? asNumber(raw.lock_minutes),
    onlyUserId: asString(raw.onlyUserId) || asString(raw.only_user_id),
  };
}

function normalizeDbStatusForQueue(status: unknown): string | null {
  const raw = asString(status);

  switch (raw) {
    case "ready":
    case "retry":
      return "queued";
    case "scheduled":
      return "scheduled";
    case "running":
      return "running";
    case "done":
      return "completed";
    case "error":
      return "failed";
    case "blocked":
      return "blocked";
    case "awaiting_approval":
      return "awaiting_approval";
    case "cancelled":
      return "cancelled";
    default:
      return raw;
  }
}

function normalizeQueueStatusForDb(status: unknown): string | null {
  const raw = asString(status);

  switch (raw) {
    case "pending":
    case "queued":
    case "ready":
      return "ready";
    case "planned":
    case "scheduled":
      return "scheduled";
    case "running":
    case "in_progress":
      return "running";
    case "completed":
    case "done":
      return "done";
    case "failed":
    case "error":
      return "error";
    case "awaiting_info":
    case "blocked":
      return "blocked";
    case "awaiting_validation":
    case "awaiting_approval":
      return "awaiting_approval";
    case "retry":
      return "retry";
    case "cancelled":
      return "cancelled";
    default:
      return raw;
  }
}

function buildQueueTaskRecord(row: DbRow) {
  const id = asString(row.id);
  if (!id) return null;

  return {
    ...row,
    id,
    mission_id: asString(row.mission_id),
    type: asString(row.type),
    title: asString(row.title),
    description: asString(row.description),
    status: normalizeDbStatusForQueue(row.status),
    payload: isObject(row.payload_json) ? row.payload_json : {},
    result: isObject(row.result_json) ? row.result_json : {},
    claimed_by: asString(row.locked_by),
    claimed_at: asString(row.locked_at),
    locked_until: null,
    scheduled_for: asString(row.execute_at),
    approval_required:
      typeof row.approval_required === "boolean" ? row.approval_required : null,
    retry_count: asNumber(row.retry_count),
    max_retries: asNumber(row.max_retries),
    error_message: asString(row.last_error),
    blocked_reason: asString(row.last_error),
    started_at: asString(row.started_at),
    completed_at: asString(row.finished_at),
    updated_at: asString(row.updated_at),
    created_at: asString(row.created_at),
  };
}

function buildTaskUpdatePatchForDb(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const dbPatch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(patch)) {
    switch (key) {
      case "status": {
        const dbStatus = normalizeQueueStatusForDb(value);
        if (dbStatus) dbPatch.status = dbStatus;
        break;
      }

      case "result":
        dbPatch.result_json = isObject(value) ? value : {};
        break;

      case "payload":
        dbPatch.payload_json = isObject(value) ? value : {};
        break;

      case "scheduled_for":
        dbPatch.execute_at = asString(value);
        break;

      case "completed_at":
        dbPatch.finished_at = asString(value);
        break;

      case "error_message":
        dbPatch.last_error = asString(value);
        break;

      case "blocked_reason":
        if (!("last_error" in dbPatch)) {
          dbPatch.last_error = asString(value);
        }
        break;

      case "claimed_by":
        dbPatch.locked_by = asString(value);
        break;

      case "claimed_at":
        dbPatch.locked_at = asString(value);
        break;

      case "locked_until":
        break;

      case "started_at":
      case "updated_at":
      case "retry_count":
      case "max_retries":
        dbPatch[key] = value;
        break;

      default:
        break;
    }
  }

  if (!("updated_at" in dbPatch)) {
    dbPatch.updated_at = new Date().toISOString();
  }

  return dbPatch;
}

async function resolveUserIdForLog(
  supabaseAdmin: SupabaseClient,
  entry: {
    mission_id?: string | null;
    task_id?: string | null;
  },
): Promise<string> {
  const taskId = asString(entry.task_id);
  const missionId = asString(entry.mission_id);

  if (taskId) {
    const { data, error } = await supabaseAdmin
      .from("pierre_tasks")
      .select("user_id")
      .eq("id", taskId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to resolve task log user: ${error.message}`);
    }

    const userId = isObject(data) ? asString(data.user_id) : null;
    if (userId) return userId;
  }

  if (missionId) {
    const { data, error } = await supabaseAdmin
      .from("pierre_missions")
      .select("user_id")
      .eq("id", missionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to resolve mission log user: ${error.message}`);
    }

    const userId = isObject(data) ? asString(data.user_id) : null;
    if (userId) return userId;
  }

  throw new Error("Unable to resolve user_id for Pierre task log.");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildDocumentHtml(params: {
  title: string;
  textContent: string;
  htmlContent: string;
  generatedAt: string;
}) {
  const { title, textContent, htmlContent, generatedAt } = params;

  if (htmlContent.trim()) {
    return htmlContent;
  }

  const paragraphs = textContent
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 48px;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f1a17;
      background: #fffaf0;
      line-height: 1.55;
    }
    .sheet {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid rgba(41, 31, 24, 0.14);
      border-radius: 24px;
      padding: 44px;
      box-shadow: 0 24px 80px rgba(41, 31, 24, 0.12);
    }
    h1 {
      margin: 0 0 22px;
      font-size: 28px;
      letter-spacing: -0.03em;
    }
    p {
      margin: 0 0 14px;
      font-size: 15px;
    }
    .meta {
      margin-top: 32px;
      padding-top: 18px;
      border-top: 1px solid rgba(41, 31, 24, 0.12);
      font-size: 11px;
      color: #746a60;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .sheet {
        box-shadow: none;
        border: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <h1>${escapeHtml(title)}</h1>
    ${paragraphs || "<p>Contenu indisponible.</p>"}
    <div class="meta">Export Pierre - ${escapeHtml(generatedAt)}</div>
  </main>
</body>
</html>`;
}

async function loadTaskForArtifact(params: {
  supabaseAdmin: SupabaseClient;
  taskId: string;
  userId: string | null;
}) {
  const { supabaseAdmin, taskId, userId } = params;

  let query = supabaseAdmin
    .from("pierre_tasks")
    .select("id, user_id, agent_slug, title, type")
    .eq("id", taskId)
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Unable to load task for artifact: ${error.message}`);
  }

  return isObject(data) ? data : null;
}

async function insertArtifactLog(params: {
  supabaseAdmin: SupabaseClient;
  missionId: string | null;
  taskId: string;
  userId: string;
  agentSlug: string;
  eventType: string;
  message: string;
  meta: Record<string, unknown>;
}) {
  const {
    supabaseAdmin,
    missionId,
    taskId,
    userId,
    agentSlug,
    eventType,
    message,
    meta,
  } = params;

  const { error } = await supabaseAdmin.from("pierre_task_logs").insert({
    mission_id: missionId,
    task_id: taskId,
    user_id: userId,
    agent_slug: agentSlug,
    event_type: eventType,
    message,
    meta_json: meta,
  });

  if (error) {
    throw new Error(`Unable to insert artifact log: ${error.message}`);
  }
}

function buildQueueSourceAdapter(
  supabaseAdmin: SupabaseClient,
  onlyUserId?: string | null,
): PierreQueueSourceAdapter {
  return {
    fetchNextRunnableTask: async ({
      now,
    }: {
      now: Date;
    }): Promise<ReturnType<typeof buildQueueTaskRecord>> => {
      let query = supabaseAdmin
        .from("pierre_tasks")
        .select("*")
        .in("status", ["ready", "scheduled", "retry"])
        .or(`execute_at.is.null,execute_at.lte.${now.toISOString()}`)
        .order("execute_at", { ascending: true, nullsFirst: true })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1);

      if (onlyUserId) {
        query = query.eq("user_id", onlyUserId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw new Error(`Unable to fetch next runnable task: ${error.message}`);
      }

      if (!data || !isObject(data)) return null;

      return buildQueueTaskRecord(data);
    },
  };
}

function buildPersistenceAdapter(
  supabaseAdmin: SupabaseClient,
): PierreQueuePersistenceAdapter {
  return {
    updateTask: async (taskId: string, patch: Record<string, unknown>) => {
      const dbPatch = buildTaskUpdatePatchForDb(patch);

      const { error } = await supabaseAdmin
        .from("pierre_tasks")
        .update(dbPatch)
        .eq("id", taskId);

      if (error) {
        throw new Error(`Unable to update task: ${error.message}`);
      }
    },

    insertTaskLog: async (entry) => {
      const userId = await resolveUserIdForLog(supabaseAdmin, entry);

      const { error } = await supabaseAdmin.from("pierre_task_logs").insert({
        mission_id: entry.mission_id ?? null,
        task_id: entry.task_id ?? null,
        user_id: userId,
        agent_slug: "pierre",
        event_type: entry.event,
        message: entry.message,
        meta_json: {
          level: entry.level,
          ...(entry.payload ?? {}),
        },
      });

      if (error) {
        throw new Error(`Unable to insert task log: ${error.message}`);
      }
    },

    insertArtifact: async ({
      taskId,
      missionId,
      userId,
      artifactRequest,
    }) => {
      const resolvedTaskId = asString(taskId);

      if (!resolvedTaskId) {
        throw new Error("Unable to insert artifact without taskId.");
      }

      const taskRow = await loadTaskForArtifact({
        supabaseAdmin,
        taskId: resolvedTaskId,
        userId: asString(userId),
      });

      const resolvedUserId = asString(userId) || asString(taskRow?.user_id);
      const agentSlug = asString(taskRow?.agent_slug) || "pierre";
      const taskTitle = asString(taskRow?.title);
      const taskType = asString(taskRow?.type);
      const kind = asString(artifactRequest.kind);

      if (!resolvedUserId) {
        throw new Error("Unable to insert artifact without userId.");
      }

      if (kind === "document" || kind === "pdf") {
        const title =
          asString(artifactRequest.title) ||
          taskTitle ||
          (kind === "pdf" ? "Export PDF Pierre" : "Document Pierre");

        const textContent =
          asString(artifactRequest.text_content) ||
          asString(artifactRequest.body_text) ||
          "";

        const htmlContent = buildDocumentHtml({
          title,
          textContent,
          htmlContent: asString(artifactRequest.html_content) || "",
          generatedAt: new Date().toISOString(),
        });

        const docType =
          asString(artifactRequest.doc_type) ||
          (kind === "pdf" ? "pdf_export" : "document_rh");

        const { data, error } = await supabaseAdmin
          .from("pierre_documents")
          .insert({
            mission_id: missionId,
            task_id: resolvedTaskId,
            user_id: resolvedUserId,
            agent_slug: agentSlug,
            doc_type: docType,
            title,
            text_content: textContent,
            html_content: htmlContent,
            pdf_url: null,
            version_number: 1,
            source_kind: kind === "pdf" ? "pdf_generated" : "queue_generated",
            tags_json:
              kind === "pdf"
                ? ["pierre", "queue", "pdf", "pdf_export"]
                : ["pierre", "queue", "document"],
          })
          .select("*")
          .single();

        if (error) {
          throw new Error(`Unable to insert document artifact: ${error.message}`);
        }

        const artifactId = isObject(data) ? asString(data.id) : null;

        await insertArtifactLog({
          supabaseAdmin,
          missionId,
          taskId: resolvedTaskId,
          userId: resolvedUserId,
          agentSlug,
          eventType:
            kind === "pdf" ? "pdf_artifact_created" : "document_artifact_created",
          message:
            kind === "pdf"
              ? `Export PDF généré : ${title}`
              : `Document généré : ${title}`,
          meta: {
            artifact_kind: kind,
            document_id: artifactId,
            task_type: taskType,
            created_at: new Date().toISOString(),
          },
        });

        return {
          artifact_id: artifactId,
          artifact_kind: kind,
        };
      }

      if (kind === "email_draft" || kind === "email_send") {
        const subject =
          asString(artifactRequest.subject) || taskTitle || "Email Pierre";

        const { data, error } = await supabaseAdmin
          .from("pierre_outbound_emails")
          .insert({
            mission_id: missionId,
            task_id: resolvedTaskId,
            user_id: resolvedUserId,
            agent_slug: agentSlug,
            to_json: asStringArray(artifactRequest.to_json),
            cc_json: asStringArray(artifactRequest.cc_json),
            bcc_json: asStringArray(artifactRequest.bcc_json),
            subject,
            html_snapshot: asString(artifactRequest.body_html),
            text_snapshot: asString(artifactRequest.body_text),
            attachments_json: [],
            sender_profile_json: {},
            provider_name: null,
            provider_message_id: null,
            status: "draft",
            scheduled_for: null,
            sent_at: null,
            error_message: null,
          })
          .select("*")
          .single();

        if (error) {
          throw new Error(`Unable to insert email artifact: ${error.message}`);
        }

        const artifactId = isObject(data) ? asString(data.id) : null;

        await insertArtifactLog({
          supabaseAdmin,
          missionId,
          taskId: resolvedTaskId,
          userId: resolvedUserId,
          agentSlug,
          eventType: "email_artifact_created",
          message: `Email préparé : ${subject}`,
          meta: {
            artifact_kind: kind,
            email_id: artifactId,
            task_type: taskType,
            created_at: new Date().toISOString(),
          },
        });

        return {
          artifact_id: artifactId,
          artifact_kind: kind,
        };
      }

      throw new Error(`Unsupported artifact kind: ${kind || "unknown"}`);
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
    const now = new Date();

    const result = await processNextPierreTask({
      workerId,
      queueSource: buildQueueSourceAdapter(supabaseAdmin, onlyUserId),
      persistence: buildPersistenceAdapter(supabaseAdmin),
      now,
      lockMinutes: body.lockMinutes ?? undefined,
    });

    return NextResponse.json({
      ok: result.ok,
      result,
      meta: {
        workerId,
        onlyUserId: onlyUserId || null,
        fetchedAt: now.toISOString(),
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