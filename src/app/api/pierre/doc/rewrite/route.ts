import { NextRequest, NextResponse } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";

import {
  getAuthenticatedPierreUser,
  makePierreServerSupabase,
} from "@/lib/pierre/auth";
import { hasPierreAccess } from "@/lib/pierre/access";
import { safeString } from "@/lib/pierre/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DocRewriteBody = Record<string, unknown>;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractSourceText(body: DocRewriteBody) {
  return (
    safeString(body.body_text) ||
    safeString(body.text) ||
    safeString(body.document_text) ||
    safeString(body.raw_input) ||
    safeString(body.input) ||
    safeString(body.prompt) ||
    ""
  );
}

function extractInstructions(body: DocRewriteBody) {
  return (
    safeString(body.instructions) ||
    safeString(body.rewrite_instructions) ||
    safeString(body.context) ||
    "Réécris ce contenu RH pour le rendre plus clair, plus professionnel, mieux structuré et directement exploitable."
  );
}

function inferTitle(body: DocRewriteBody) {
  return (
    safeString(body.title) ||
    safeString(body.document_title) ||
    "Document RH réécrit par Pierre"
  );
}

function buildRewrittenText(params: {
  sourceText: string;
  instructions: string;
  title: string;
}) {
  const source = params.sourceText.trim();

  if (!source) {
    return [
      params.title,
      "",
      "Contenu source manquant.",
      "",
      "Pierre ne peut pas produire une réécriture fiable sans le texte original. Merci d’ajouter le document, le texte ou les consignes exactes à reprendre.",
    ].join("\n");
  }

  return [
    params.title,
    "",
    "Version retravaillée",
    "",
    source,
    "",
    "Note de traitement",
    params.instructions,
  ].join("\n");
}

function buildHtml(title: string, text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replaceAll("\n", "<br />")}</p>`)
    .join("\n");

  return [
    `<article class="pierre-document pierre-document-rewrite">`,
    `<header>`,
    `<p class="eyebrow">Pierre · Réécriture RH</p>`,
    `<h1>${escapeHtml(title)}</h1>`,
    `</header>`,
    `<section>`,
    paragraphs,
    `</section>`,
    `</article>`,
  ].join("\n");
}

async function insertMission(params: {
  supabase: SupabaseClient;
  userId: string;
  rawInput: string;
  title: string;
  instructions: string;
}) {
  const { data, error } = await params.supabase
    .from("pierre_missions")
    .insert({
      user_id: params.userId,
      agent_slug: "pierre",
      source: "api",
      raw_input: params.rawInput || params.instructions,
      mission_summary: `Réécriture RH : ${params.title}`,
      intent: "api_doc_rewrite",
      understanding_status: params.rawInput ? "understood" : "missing_info",
      risk_level: "low",
      approval_required: false,
      status: params.rawInput ? "active" : "awaiting_info",
      missing_info_json: params.rawInput ? [] : ["document_source"],
      brain_output_json: {
        route: "/api/pierre/doc/rewrite",
        mode: "direct_rewrite",
        title: params.title,
        instructions: params.instructions,
      },
      context_snapshot_json: {
        route: "/api/pierre/doc/rewrite",
        direct_api: true,
      },
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function insertTask(params: {
  supabase: SupabaseClient;
  userId: string;
  missionId: string;
  title: string;
  sourceText: string;
  instructions: string;
}) {
  const { data, error } = await params.supabase
    .from("pierre_tasks")
    .insert({
      mission_id: params.missionId,
      user_id: params.userId,
      agent_slug: "pierre",
      type: "doc.rewrite",
      title: "Réécrire le document RH",
      description: "Réécriture directe via /api/pierre/doc/rewrite.",
      status: params.sourceText ? "ready" : "blocked",
      priority: 95,
      approval_required: false,
      payload_json: {
        raw_input: params.sourceText,
        instructions: params.instructions,
        title: params.title,
      },
      result_json: {},
      depends_on_json: [],
      execute_at: null,
      retry_count: 0,
      max_retries: 3,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function insertDocument(params: {
  supabase: SupabaseClient;
  userId: string;
  missionId: string;
  taskId: string;
  title: string;
  textContent: string;
  htmlContent: string;
}) {
  const { data, error } = await params.supabase
    .from("pierre_documents")
    .insert({
      mission_id: params.missionId,
      task_id: params.taskId,
      user_id: params.userId,
      agent_slug: "pierre",
      doc_type: "document_rh",
      title: params.title,
      text_content: params.textContent,
      html_content: params.htmlContent,
      version_number: 1,
      source_kind: "rewritten",
      tags_json: ["api", "rewrite", "pierre"],
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function insertLog(params: {
  supabase: SupabaseClient;
  userId: string;
  missionId: string;
  taskId: string;
  documentId?: string | null;
  message: string;
}) {
  await params.supabase.from("pierre_task_logs").insert({
    task_id: params.taskId,
    mission_id: params.missionId,
    user_id: params.userId,
    agent_slug: "pierre",
    event_type: "document_rewrite_created",
    message: params.message,
    meta_json: {
      document_id: params.documentId ?? null,
      route: "/api/pierre/doc/rewrite",
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = makePierreServerSupabase();

  try {
    const { error: authError, user } = await getAuthenticatedPierreUser(
      req,
      supabase,
    );

    if (authError || !user) {
      return json(
        {
          ok: false,
          error: authError || "Non authentifié.",
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

    let body: DocRewriteBody;

    try {
      body = (await req.json()) as DocRewriteBody;
    } catch {
      return json(
        {
          ok: false,
          error: "Body JSON invalide.",
          code: "INVALID_JSON_BODY",
        },
        400,
      );
    }

    const sourceText = extractSourceText(body);
    const instructions = extractInstructions(body);
    const title = inferTitle(body);
    const rewrittenText = buildRewrittenText({
      sourceText,
      instructions,
      title,
    });
    const htmlContent = buildHtml(title, rewrittenText);

    const mission = await insertMission({
      supabase,
      userId: user.id,
      rawInput: sourceText,
      title,
      instructions,
    });

    const task = await insertTask({
      supabase,
      userId: user.id,
      missionId: String(mission.id),
      title,
      sourceText,
      instructions,
    });

    const document = await insertDocument({
      supabase,
      userId: user.id,
      missionId: String(mission.id),
      taskId: String(task.id),
      title,
      textContent: rewrittenText,
      htmlContent,
    });

    await insertLog({
      supabase,
      userId: user.id,
      missionId: String(mission.id),
      taskId: String(task.id),
      documentId: String(document.id),
      message: `Document réécrit : ${title}`,
    });

    return json({
      ok: true,
      mission,
      task,
      document,
      result: {
        text_content: rewrittenText,
        html_content: htmlContent,
      },
    });
  } catch (error) {
    console.error("[pierre/doc/rewrite][POST]", error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Impossible de réécrire le document RH.",
        code: "DOC_REWRITE_FAILED",
      },
      500,
    );
  }
}
