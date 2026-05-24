import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type DbRow = Record<string, unknown>;

type AuthenticatedContext = {
  userId: string;
  accessToken: string | null;
};

type GeneratePdfBody = {
  text: string | null;
  html: string | null;
  missionId: string | null;
  taskId: string | null;
  sourceDocumentId: string | null;
  title: string | null;
  template: string | null;
  layout: string | null;
  tone: string | null;
  language: string | null;
  metadata: unknown;
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
    { ok: false, error: message, ...(extra ?? {}) },
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
    auth: { persistSession: false, autoRefreshToken: false },
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

  return { userId: data.user.id, accessToken };
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

function normalizeBody(raw: unknown): GeneratePdfBody {
  if (!isObject(raw)) {
    return {
      text: null,
      html: null,
      missionId: null,
      taskId: null,
      sourceDocumentId: null,
      title: null,
      template: null,
      layout: null,
      tone: null,
      language: null,
      metadata: null,
    };
  }

  const text =
    asString(raw.text) ||
    asString(raw.content) ||
    asString(raw.bodyText) ||
    asString(raw.body_text) ||
    asString(raw.documentText) ||
    asString(raw.document_text);

  const html =
    asString(raw.html) ||
    asString(raw.htmlContent) ||
    asString(raw.html_content) ||
    asString(raw.bodyHtml) ||
    asString(raw.body_html) ||
    asString(raw.documentHtml) ||
    asString(raw.document_html);

  const missionId = asString(raw.missionId) || asString(raw.mission_id);
  const taskId = asString(raw.taskId) || asString(raw.task_id);
  const sourceDocumentId =
    asString(raw.sourceDocumentId) || asString(raw.source_document_id);
  const title =
    asString(raw.title) ||
    asString(raw.documentTitle) ||
    asString(raw.document_title);

  return {
    text,
    html,
    missionId,
    taskId,
    sourceDocumentId,
    title,
    template: asString(raw.template),
    layout: asString(raw.layout),
    tone: asString(raw.tone),
    language: asString(raw.language),
    metadata: raw.metadata ?? null,
  };
}

async function verifyMissionOwnershipIfNeeded(
  supabaseAdmin: SupabaseClient,
  missionId: string | null | undefined,
  userId: string,
): Promise<DbRow | null> {
  if (!missionId) return null;

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

  return data as DbRow;
}

async function verifyTaskOwnershipIfNeeded(
  supabaseAdmin: SupabaseClient,
  taskId: string | null | undefined,
  userId: string,
): Promise<DbRow | null> {
  if (!taskId) return null;

  const { data: task, error: taskError } = await supabaseAdmin
    .from("pierre_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    throw {
      status: 500,
      message: "Unable to load task.",
      code: "TASK_FETCH_FAILED",
      details: mapDbError(taskError),
    };
  }

  if (!task) {
    throw { status: 404, message: "Task not found.", code: "TASK_NOT_FOUND" };
  }

  // Verify via its parent mission
  const taskMissionId = asString(task.mission_id);
  if (taskMissionId) {
    const { data: mission, error: missionError } = await supabaseAdmin
      .from("pierre_missions")
      .select("id")
      .eq("id", taskMissionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (missionError) {
      throw {
        status: 500,
        message: "Unable to verify task ownership.",
        code: "TASK_OWNERSHIP_CHECK_FAILED",
        details: mapDbError(missionError),
      };
    }

    if (!mission) {
      throw { status: 404, message: "Task not found.", code: "TASK_NOT_FOUND" };
    }
  }

  return task as DbRow;
}

async function loadSourceDocumentIfNeeded(
  supabaseAdmin: SupabaseClient,
  sourceDocumentId: string | null | undefined,
  userId: string,
): Promise<DbRow | null> {
  if (!sourceDocumentId) return null;

  const { data, error } = await supabaseAdmin
    .from("pierre_documents")
    .select("*")
    .eq("id", sourceDocumentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load source document.",
      code: "SOURCE_DOCUMENT_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  if (!data) {
    throw {
      status: 404,
      message: "Source document not found.",
      code: "SOURCE_DOCUMENT_NOT_FOUND",
    };
  }

  return data as DbRow;
}

async function loadCompanyMemory(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<DbRow | null> {
  const { data, error } = await supabaseAdmin
    .from("pierre_company_memory")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw {
      status: 500,
      message: "Unable to load company memory.",
      code: "COMPANY_MEMORY_FETCH_FAILED",
      details: mapDbError(error),
    };
  }

  return (data ?? null) as DbRow | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

function formatDateForLocale(isoDate: string, language: string): string {
  try {
    const locale = language === "en" ? "en-GB" : "fr-FR";
    return new Date(isoDate).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function buildPremiumPdfHtml(params: {
  title: string;
  textContent: string;
  rawHtml: string | null;
  companyName: string;
  tone: string;
  language: string;
  generatedAt: string;
}): string {
  const { title, textContent, rawHtml, companyName, tone, language, generatedAt } =
    params;

  const bodyContent = rawHtml || textToParagraphs(textContent);
  const formattedDate = formatDateForLocale(generatedAt, language);
  const generatedByLabel = language === "en" ? "Generated by Pierre" : "Document Pierre";
  const toneLabel = language === "en" ? `Tone: ${tone}` : `Ton : ${tone}`;
  const metaLine = `${escapeHtml(companyName)} &bull; ${escapeHtml(formattedDate)} &bull; ${escapeHtml(generatedByLabel)} &bull; ${escapeHtml(toneLabel)}`;

  return [
    "<!DOCTYPE html>",
    `<html lang="${escapeHtml(language)}">`,
    "<head>",
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    "  *, *::before, *::after { box-sizing: border-box; }",
    "  body { font-family: Georgia, 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.7; color: #1a1a1a; background: #ffffff; max-width: 800px; margin: 0 auto; padding: 48px 56px; }",
    "  h1 { font-size: 1.75em; font-weight: 700; border-bottom: 2px solid #1a1a1a; padding-bottom: 0.35em; margin-top: 0; margin-bottom: 0.25em; }",
    "  .doc-meta { color: #555; font-size: 0.82em; font-family: Arial, Helvetica, sans-serif; margin-bottom: 2.5em; }",
    "  p { margin: 0.9em 0; }",
    "  ul, ol { padding-left: 1.5em; }",
    "  li { margin: 0.4em 0; }",
    "  strong, b { font-weight: 700; }",
    "  @media print {",
    "    body { padding: 20px; font-size: 11pt; }",
    "    .doc-meta { color: #444; }",
    "  }",
    "</style>",
    "</head>",
    "<body>",
    `<h1>${escapeHtml(title)}</h1>`,
    `<p class="doc-meta">${metaLine}</p>`,
    bodyContent,
    "</body>",
    "</html>",
  ].join("\n");
}

async function insertPdfDocument(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  missionId: string | null;
  taskId: string | null;
  title: string;
  textContent: string;
  htmlContent: string;
  docMetadata: Record<string, unknown>;
}): Promise<DbRow> {
  const {
    supabaseAdmin,
    userId,
    missionId,
    taskId,
    title,
    textContent,
    htmlContent,
    docMetadata,
  } = params;

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    mission_id: missionId,
    task_id: taskId,
    agent_slug: "pierre",
    doc_type: "pdf_export",
    title,
    text_content: textContent,
    html_content: htmlContent,
    pdf_url: null,
    source_kind: "pdf_generated",
    tags_json: ["pdf", "pdf_export", "pierre"],
    status: "generated",
    metadata: docMetadata,
  };

  const { data, error } = await supabaseAdmin
    .from("pierre_documents")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    throw {
      status: 500,
      message: "Unable to save PDF document.",
      code: "PDF_DOCUMENT_CREATE_FAILED",
      details: mapDbError(error),
    };
  }

  return data as DbRow;
}

async function insertPdfLogIfNeeded(params: {
  supabaseAdmin: SupabaseClient;
  missionId: string | null;
  taskId: string | null;
  pdfDocumentId: string;
  sourceDocumentId: string | null;
  generatedAt: string;
}): Promise<void> {
  const { supabaseAdmin, missionId, taskId, pdfDocumentId, sourceDocumentId, generatedAt } =
    params;

  if (!missionId && !taskId) return;

  const { error } = await supabaseAdmin.from("pierre_task_logs").insert({
    mission_id: missionId,
    task_id: taskId,
    event_type: "pdf_generated_direct",
    message: "PDF Pierre genere depuis route directe.",
    meta_json: {
      pdf_document_id: pdfDocumentId,
      source_document_id: sourceDocumentId,
      generated_at: generatedAt,
    },
  });

  if (error) {
    console.warn("[pierre/pdf/generate] Failed to insert task log:", error.message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = normalizeBody(await request.json());

    const supabaseAdmin = createAdminClient();
    const auth = await authenticateRequest(request, supabaseAdmin);

    // Verify mission ownership if provided
    const mission = await verifyMissionOwnershipIfNeeded(
      supabaseAdmin,
      body.missionId,
      auth.userId,
    );

    // Verify task ownership if provided (sequential: needed before loading source doc)
    const task = await verifyTaskOwnershipIfNeeded(
      supabaseAdmin,
      body.taskId,
      auth.userId,
    );

    // Load source document and company memory in parallel
    const [sourceDocument, memory] = await Promise.all([
      loadSourceDocumentIfNeeded(supabaseAdmin, body.sourceDocumentId, auth.userId),
      loadCompanyMemory(supabaseAdmin, auth.userId),
    ]);

    // Resolve content: payload > source document
    const textContent =
      body.text ||
      asString(sourceDocument?.text_content) ||
      null;

    const rawHtml =
      body.html ||
      asString(sourceDocument?.html_content) ||
      null;

    if (!textContent && !rawHtml) {
      return jsonError(
        "Document content is required (text or html).",
        400,
        { code: "PDF_CONTENT_REQUIRED" },
      );
    }

    // Resolve title
    const title =
      body.title ||
      asString(sourceDocument?.title) ||
      "Document Pierre";

    // Resolve display settings from payload, memory, then defaults
    const companyName =
      asString(memory?.company_name) ||
      asString(memory?.name) ||
      "Pierre RH";

    const tone =
      body.tone ||
      asString(memory?.preferred_tone) ||
      asString(memory?.tone_guide) ||
      "professionnel";

    const language =
      body.language ||
      asString(memory?.preferred_language) ||
      "fr";

    // Build plain text for storage (strip HTML tags if only HTML was provided)
    const finalTextContent =
      textContent ||
      (rawHtml ? rawHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

    const generatedAt = new Date().toISOString();

    const premiumHtml = buildPremiumPdfHtml({
      title,
      textContent: finalTextContent,
      rawHtml,
      companyName,
      tone,
      language,
      generatedAt,
    });

    const resolvedMissionId = mission ? String(mission.id) : null;
    const resolvedTaskId = task ? String(task.id) : null;

    const docMetadata: Record<string, unknown> = {
      source: "api:pierre:pdf:generate",
      tone,
      language,
      company_name: companyName,
      source_document_id: body.sourceDocumentId || null,
      mission_id: resolvedMissionId,
      task_id: resolvedTaskId,
      generated_at: generatedAt,
      ...(isObject(body.metadata) ? body.metadata : {}),
    };

    const document = await insertPdfDocument({
      supabaseAdmin,
      userId: auth.userId,
      missionId: resolvedMissionId,
      taskId: resolvedTaskId,
      title,
      textContent: finalTextContent,
      htmlContent: premiumHtml,
      docMetadata,
    });

    const documentId = String(document.id);
    const pdfUrl = asString(document.pdf_url) || null;

    await insertPdfLogIfNeeded({
      supabaseAdmin,
      missionId: resolvedMissionId,
      taskId: resolvedTaskId,
      pdfDocumentId: documentId,
      sourceDocumentId: body.sourceDocumentId || null,
      generatedAt,
    });

    // Build a PDF record shape compatible with front-end normalizePdf
    const pdfRecord = {
      id: documentId,
      mission_id: resolvedMissionId,
      task_id: resolvedTaskId,
      title,
      doc_type: "pdf_export",
      filename: null,
      storage_path: null,
      public_url: pdfUrl,
      signed_url: null,
      status: "generated",
      created_at: asString(document.created_at),
      updated_at: asString(document.updated_at),
    };

    return NextResponse.json({
      ok: true,
      pdf: pdfRecord,
      document,
      pdfs: [pdfRecord],
      documents: [document],
      artifact: {
        kind: "pdf",
        status: "generated",
        document_id: documentId,
        pdf_url: pdfUrl,
        note: "PDF logique genere et stocke dans pierre_documents. Rendu binaire disponible apres configuration du renderer.",
      },
      meta: {
        fetchedAt: generatedAt,
        missionId: resolvedMissionId,
        taskId: resolvedTaskId,
        sourceDocumentId: body.sourceDocumentId || null,
        companyName,
        tone,
        language,
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
