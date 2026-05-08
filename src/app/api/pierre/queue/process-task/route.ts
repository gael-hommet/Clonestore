import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

type ProcessTaskBody = {
  taskId?: string;
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
  return clean ? clean : null;
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

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing.");
  }

  return new OpenAI({ apiKey });
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(text: string): string {
  const blocks = text
    .split(/\n{2,}/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (blocks.length === 0) return "<p></p>";

  return blocks.map((block) => `<p>${escapeHtml(block.replace(/\n/g, " "))}</p>`).join("");
}

async function appendLog(
  supabase: SupabaseClient,
  input: {
    task_id?: string | null;
    mission_id?: string | null;
    level?: string;
    event: string;
    message: string;
    metadata?: Record<string, unknown> | null;
  }
) {
  await supabase.from("pierre_task_logs").insert({
    task_id: input.task_id ?? null,
    mission_id: input.mission_id ?? null,
    level: input.level ?? "info",
    event: input.event,
    message: input.message,
    metadata: input.metadata ?? null,
  });
}

function buildDocumentPrompt(input: {
  requestText: string;
  taskTitle: string;
  missionSummary: string | null;
  companyMemory: Record<string, unknown> | null;
}) {
  return `
Tu es Pierre, employÃ© IA RH premium de CloneStore.

Tu dois produire un document RH propre, exploitable et crÃ©dible.

Mission :
${input.requestText}

RÃ©sumÃ© mission :
${input.missionSummary ?? "Aucun rÃ©sumÃ©."}

TÃ¢che :
${input.taskTitle}

MÃ©moire entreprise :
${JSON.stringify(input.companyMemory ?? {}, null, 2)}

RÃ©ponds en JSON strict :
{
  "title": "titre",
  "type": "document_rh",
  "text": "contenu final",
  "html": "contenu html",
  "summary": "rÃ©sumÃ© court"
}
`.trim();
}

function buildEmailPrompt(input: {
  requestText: string;
  taskTitle: string;
  missionSummary: string | null;
  companyMemory: Record<string, unknown> | null;
}) {
  return `
Tu es Pierre, employÃ© IA RH premium de CloneStore.

Tu dois produire un email RH professionnel prÃªt Ã  Ãªtre relu.

Mission :
${input.requestText}

RÃ©sumÃ© mission :
${input.missionSummary ?? "Aucun rÃ©sumÃ©."}

TÃ¢che :
${input.taskTitle}

MÃ©moire entreprise :
${JSON.stringify(input.companyMemory ?? {}, null, 2)}

RÃ©ponds en JSON strict :
{
  "subject": "objet email",
  "text": "contenu texte",
  "html": "contenu html",
  "summary": "rÃ©sumÃ© court"
}
`.trim();
}

async function generateDocumentArtifact(
  supabase: SupabaseClient,
  input: {
    task: Record<string, unknown>;
    mission: Record<string, unknown>;
    companyMemory: Record<string, unknown> | null;
  }
) {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: "gpt-5",
    input: buildDocumentPrompt({
      requestText: trimOrNull(input.mission.request_text) ?? "",
      taskTitle: trimOrNull(input.task.title) ?? "Document RH",
      missionSummary: trimOrNull(input.mission.summary),
      companyMemory: input.companyMemory,
    }),
  });

  const parsed = safeJsonParse<{
    title?: string;
    type?: string;
    text?: string;
    html?: string;
    summary?: string;
  }>(response.output_text?.trim() ?? "");

  const finalText = trimOrNull(parsed?.text) ?? response.output_text?.trim() ?? "";
  const finalHtml = trimOrNull(parsed?.html) ?? textToHtml(finalText);

  const { data, error } = await supabase
    .from("pierre_documents")
    .insert({
      user_id: input.task.user_id ?? null,
      company_id: input.task.company_id ?? null,
      mission_id: input.mission.id ?? null,
      task_id: input.task.id ?? null,
      title: trimOrNull(parsed?.title) ?? trimOrNull(input.task.title) ?? "Document Pierre",
      type: trimOrNull(parsed?.type) ?? "document_rh",
      status: "ready",
      text: finalText,
      html: finalHtml,
      metadata: {
        source: "process_task",
        summary: trimOrNull(parsed?.summary),
      },
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function generateEmailArtifact(
  supabase: SupabaseClient,
  input: {
    task: Record<string, unknown>;
    mission: Record<string, unknown>;
    companyMemory: Record<string, unknown> | null;
  }
) {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: "gpt-5",
    input: buildEmailPrompt({
      requestText: trimOrNull(input.mission.request_text) ?? "",
      taskTitle: trimOrNull(input.task.title) ?? "Email RH",
      missionSummary: trimOrNull(input.mission.summary),
      companyMemory: input.companyMemory,
    }),
  });

  const parsed = safeJsonParse<{
    subject?: string;
    text?: string;
    html?: string;
    summary?: string;
  }>(response.output_text?.trim() ?? "");

  const finalText = trimOrNull(parsed?.text) ?? response.output_text?.trim() ?? "";
  const finalHtml = trimOrNull(parsed?.html) ?? textToHtml(finalText);

  const senderName =
    trimOrNull(
      input.companyMemory?.email_identity && isPlainObject(input.companyMemory.email_identity)
        ? input.companyMemory.email_identity.sender_name
        : null
    ) ??
    trimOrNull(input.companyMemory?.sender_name) ??
    trimOrNull(process.env.PIERRE_DEFAULT_SENDER_NAME);

  const senderEmail =
    trimOrNull(
      input.companyMemory?.email_identity && isPlainObject(input.companyMemory.email_identity)
        ? input.companyMemory.email_identity.sender_email
        : null
    ) ??
    trimOrNull(input.companyMemory?.sender_email) ??
    trimOrNull(process.env.PIERRE_DEFAULT_SENDER_EMAIL);

  const { data, error } = await supabase
    .from("pierre_outbound_emails")
    .insert({
      user_id: input.task.user_id ?? null,
      company_id: input.task.company_id ?? null,
      mission_id: input.mission.id ?? null,
      task_id: input.task.id ?? null,
      to: [],
      cc: [],
      bcc: [],
      subject: trimOrNull(parsed?.subject) ?? trimOrNull(input.task.title) ?? "Email Pierre",
      text: finalText,
      html: finalHtml,
      status: "draft",
      sender_name: senderName,
      sender_email: senderEmail,
      metadata: {
        source: "process_task",
        summary: trimOrNull(parsed?.summary),
        pending_reason: "Destinataires Ã  complÃ©ter ou validation Ã  dÃ©clencher avant envoi rÃ©el.",
      },
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

function checkWorkerAuth(request: NextRequest): boolean {
  const workerSecret = process.env.PIERRE_QUEUE_WORKER_SECRET;
  if (!workerSecret) return true; // no secret configured, allow

  const provided = request.headers.get("x-pierre-worker-secret");
  return provided === workerSecret;
}

export async function POST(request: NextRequest) {
  try {
    if (!checkWorkerAuth(request)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const body = (await request.json().catch(() => null)) as ProcessTaskBody | null;
    const taskId = trimOrNull(body?.taskId);

    if (!taskId) {
      return json(
        {
          ok: false,
          error: "taskId manquant.",
        },
        400
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: task, error: taskError } = await supabase
      .from("pierre_tasks")
      .select("*")
      .eq("id", taskId)
      .limit(1)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task?.id) {
      return json(
        {
          ok: false,
          error: "TÃ¢che Pierre introuvable.",
        },
        404
      );
    }

    const currentStatus = trimOrNull(task.status);
    if (currentStatus === "completed" || currentStatus === "done") {
      return json({
        ok: true,
        processed: false,
        message: "La tÃ¢che est dÃ©jÃ  terminÃ©e.",
        task,
      });
    }

    const { data: lockedTask, error: lockError } = await supabase
      .from("pierre_tasks")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select("*")
      .maybeSingle();

    if (lockError) throw lockError;
    if (!lockedTask?.id) {
      throw new Error("Impossible de verrouiller la tÃ¢che.");
    }

    const { data: mission, error: missionError } = await supabase
      .from("pierre_missions")
      .select("*")
      .eq("id", lockedTask.mission_id)
      .limit(1)
      .maybeSingle();

    if (missionError) throw missionError;
    if (!mission?.id) {
      throw new Error("Mission introuvable pour la tÃ¢che.");
    }

    const { data: companyMemory, error: memoryError } = await supabase
      .from("pierre_company_memory")
      .select("*")
      .eq("user_id", lockedTask.user_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (memoryError) throw memoryError;

    await appendLog(supabase, {
      task_id: lockedTask.id,
      mission_id: mission.id,
      event: "task_execution_started",
      message: "ExÃ©cution ciblÃ©e de la tÃ¢che dÃ©marrÃ©e.",
      metadata: {
        type: lockedTask.type ?? null,
      },
    });

    let artifact: Record<string, unknown> | null = null;
    const taskType = trimOrNull(lockedTask.type) ?? "other";

    if (taskType === "document" || taskType === "pdf") {
      artifact = (await generateDocumentArtifact(supabase, {
        task: lockedTask,
        mission,
        companyMemory: isPlainObject(companyMemory) ? companyMemory : null,
      })) as Record<string, unknown>;
    } else if (taskType === "email") {
      artifact = (await generateEmailArtifact(supabase, {
        task: lockedTask,
        mission,
        companyMemory: isPlainObject(companyMemory) ? companyMemory : null,
      })) as Record<string, unknown>;
    }

    const { data: completedTask, error: completedError } = await supabase
      .from("pierre_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select("*")
      .maybeSingle();

    if (completedError) throw completedError;

    await appendLog(supabase, {
      task_id: lockedTask.id,
      mission_id: mission.id,
      event: "task_execution_completed",
      message: "ExÃ©cution ciblÃ©e de la tÃ¢che terminÃ©e.",
      metadata: {
        artifact_id: trimOrNull(artifact?.id),
        artifact_type:
          taskType === "email"
            ? "outbound_email"
            : taskType === "document" || taskType === "pdf"
            ? "document"
            : null,
      },
    });

    return json({
      ok: true,
      processed: true,
      task: completedTask,
      artifact,
    });
  } catch (error) {
    console.error("[pierre/queue/process-task][POST]", error);

    return json(
      {
        ok: false,
        error: "Impossible de traiter cette tÃ¢che Pierre.",
      },
      500
    );
  }
}