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

export async function rewritePierreDocument(
  supabase: SupabaseClient,
  input: {
    task: PierreRunnableTask;
  }
) {
  const payload = input.task.payload_json || {};
  const originalText =
    safeString(payload.body_text) ||
    safeString(payload.text) ||
    safeString(payload.document_text) ||
    safeString(payload.raw_input);

  if (!originalText) {
    throw new Error("Aucun contenu Ã  rÃ©Ã©crire nâ€™a Ã©tÃ© trouvÃ© pour cette task.");
  }

  const companyName = safeString(payload.company_name) || null;
  const docType = detectPierreDocumentType(originalText);
  const title =
    safeString(payload.title) ||
    buildPierreDocumentTitle({
      docType,
      companyName,
    });

  const engineUrl = getEnv("PIERRE_DOCUMENT_ENGINE_URL");
  let bodyText = "";

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
        mode: "rewrite",
        title,
        doc_type: docType,
        original_text: originalText,
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
          : "Le moteur de rÃ©Ã©criture Pierre a Ã©chouÃ©."
      );
    }

    bodyText = normalizePierreDocumentText(
      safeString(parsed.body_text) || originalText
    );
  } else {
    bodyText = normalizePierreDocumentText(originalText);
  }

  const bodyHtml = normalizePierreDocumentHtml(textToHtml(bodyText));

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
        status: "rewritten",
        meta_json: {
          source_task_type: input.task.type,
        },
      })
      .select("id")
      .maybeSingle();

    documentId = (data?.id as string | undefined) || null;
  } catch (error) {
    console.error("[PIERRE_DOCUMENT_REWRITE_INSERT_ERROR]", error);
  }

  return {
    document_id: documentId,
    title,
    doc_type: docType,
    body_text: bodyText,
    body_html: bodyHtml,
  };
}