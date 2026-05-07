import type { PierreRunnableTask } from "@/lib/pierre/tasks/executors";
import { safeString } from "@/lib/pierre/utils";
import { buildPierrePdfFilename } from "@/lib/pierre/pdf/filename";
import { uploadPierrePdfFile } from "@/lib/pierre/pdf/upload";

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function generatePierrePdf(input: {
  task: PierreRunnableTask;
}) {
  const payload = input.task.payload_json || {};

  const title =
    safeString(payload.title) ||
    safeString(payload.document_title) ||
    "Document Pierre";

  const bodyHtml =
    safeString(payload.body_html) ||
    safeString(payload.document_html) ||
    safeString(payload.generated_document_html);

  const bodyText =
    safeString(payload.body_text) ||
    safeString(payload.document_text) ||
    safeString(payload.generated_document_text);

  if (!bodyHtml && !bodyText) {
    throw new Error(
      "Aucun contenu document n’est disponible pour générer le PDF Pierre."
    );
  }

  const rendererUrl = getEnv("PIERRE_PDF_RENDERER_URL");

  if (!rendererUrl) {
    throw new Error(
      "PIERRE_PDF_RENDERER_URL est manquant. Le moteur PDF Pierre n’est pas configuré."
    );
  }

  const filename = buildPierrePdfFilename({
    title,
    fallback: "document-pierre",
  });

  const response = await fetch(rendererUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getEnv("PIERRE_PDF_RENDERER_SECRET")
        ? {
            "x-pierre-pdf-secret": getEnv("PIERRE_PDF_RENDERER_SECRET"),
          }
        : {}),
    },
    body: JSON.stringify({
      title,
      filename,
      body_html: bodyHtml || null,
      body_text: bodyText || null,
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
        : "Le renderer PDF Pierre a échoué."
    );
  }

  const pdfBase64 =
    safeString(parsed.pdf_base64) ||
    safeString(parsed.base64);

  const directUrl =
    safeString(parsed.pdf_url) ||
    safeString(parsed.file_url) ||
    safeString(parsed.url);

  if (directUrl) {
    return {
      filename,
      file_url: directUrl,
      uploaded: true,
      renderer_response_json: parsed,
    };
  }

  if (!pdfBase64) {
    throw new Error(
      "Le renderer PDF Pierre n’a renvoyé ni URL, ni contenu base64."
    );
  }

  const uploadResult = await uploadPierrePdfFile({
    filename,
    content_base64: pdfBase64,
    content_type: "application/pdf",
  });

  return {
    filename,
    file_url: uploadResult.file_url,
    uploaded: uploadResult.uploaded,
    renderer_response_json: parsed,
    upload_response_json: uploadResult.response_json,
  };
}