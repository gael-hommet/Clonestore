import type { SupabaseClient } from "@supabase/supabase-js";

import type { PierreRunnableTask } from "@/lib/pierre/tasks/executors";
import { safeString } from "@/lib/pierre/utils";
import { detectPierreDocumentType } from "@/lib/pierre/documents/doc-type";
import { buildPierreDocumentTitle } from "@/lib/pierre/documents/title";
import { normalizePierreDocumentText } from "@/lib/pierre/documents/normalize-text";
import { normalizePierreDocumentHtml } from "@/lib/pierre/documents/normalize-html";

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function textToHtml(value: string) {
  const escaped = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  return `<div>${escaped.replace(/\n{2,}/g, "</div><div>").replace(/\n/g, "<br />")}</div>`;
}

function buildFallbackDocumentText(rawInput: string, title: string) {
  return normalizePierreDocumentText([
    title,
    "",
    "Document préparé par Pierre.",
    "",
    "Consigne d’origine :",
    rawInput,
    "",
    "À compléter / ajuster selon le contexte RH réel de l’entreprise.",
  ].join("\n"));
}

export async function generatePierreDocument(
  supabase: SupabaseClient,
  input: {
    task: PierreRunnableTask;
  }
) {
  const payload = input.task.payload_json || {};
  const rawInput =
    safeString(payload.raw_input) ||
    safeString(payload.input) ||
    safeString(payload.prompt);

  const companyName =
    safeString(payload.company_name) || null;

  const docType = detectPierreDocumentType(rawInput);
  const title =
    safeString(payload.title) ||
    buildPierreDocumentTitle({
      docType,
      companyName,
    });

  const engineUrl = getEnv("PIERRE_DOCUMENT_ENGINE_URL");
  let bodyText = "";
  let bodyHtml = "";

  if (engineUrl) {
    const response = await fetch(engineUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getEnv("PIERRE_DOCUMENT_ENGINE_SECRET")
          ? {
              "x-pierre-document-secret":
                getEnv("PIERRE_DOCUMENT_ENGINE_SECRET"),
            }
          : {}),
      },
      body: JSON.stringify({
        mode: "generate",
        title,
        doc_type: docType,
        raw_input: rawInput,
        payload,
      }),
    });

    const raw = await response.text();
    const parsed = (() => {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return { raw };
      }
    })();

    if (!response.ok) {
      throw new Error(
        typeof parsed.error === "string"
          ? parsed.error
          : "Le moteur document Pierre a échoué."
      );
    }

    bodyText = normalizePierreDocumentText(
      safeString(parsed.body_text) || buildFallbackDocumentText(rawInput, title)
    );

    bodyHtml = normalizePierreDocumentHtml(
      safeString(parsed.body_html) || textToHtml(bodyText)
    );
  } else {
    bodyText = buildFallbackDocumentText(rawInput, title);
    bodyHtml = normalizePierreDocumentHtml(textToHtml(bodyText));
  }

  let documentId: string | null = null;

  try {
    const { data } = await supabase
      .from("pierre_documents")
      .insert({
        user_id: input.task.user_id,
        mission_id: input.task.mission_id,
        task_id: input.task.id,
        agent_slug: "pierre",
        title,
        doc_type: docType,
        body_text: bodyText,
        body_html: bodyHtml,
        status: "generated",
        meta_json: {
          source_task_type: input.task.type,
        },
      })
      .select("id")
      .maybeSingle();

    documentId = (data?.id as string | undefined) || null;
  } catch (error) {
    console.error("[PIERRE_DOCUMENT_INSERT_ERROR]", error);
  }

  return {
    document_id: documentId,
    title,
    doc_type: docType,
    body_text: bodyText,
    body_html: bodyHtml,
  };
}