import { safeString } from "@/lib/pierre/utils";

export type PierreEmailAttachment = {
  filename: string;
  content_type: string | null;
  url?: string | null;
  content_base64?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAttachment(input: unknown): PierreEmailAttachment | null {
  if (typeof input === "string") {
    const url = safeString(input);
    if (!url) return null;

    const filename =
      url.split("/").pop()?.split("?")[0]?.trim() || "attachment";

    return {
      filename,
      content_type: null,
      url,
      content_base64: null,
    };
  }

  if (!isRecord(input)) return null;

  const filename =
    safeString(input.filename) ||
    safeString(input.name) ||
    "attachment";

  const contentType =
    safeString(input.content_type) ||
    safeString(input.mime_type) ||
    safeString(input.contentType) ||
    null;

  const url =
    safeString(input.url) ||
    safeString(input.file_url) ||
    safeString(input.download_url) ||
    null;

  const contentBase64 =
    safeString(input.content_base64) ||
    safeString(input.base64) ||
    null;

  if (!url && !contentBase64) return null;

  return {
    filename,
    content_type: contentType,
    url,
    content_base64: contentBase64,
  };
}

export function normalizePierreEmailAttachments(
  payload: Record<string, unknown> | null | undefined
): PierreEmailAttachment[] {
  const source = payload || {};

  const raw =
    source.attachments ||
    source.files ||
    source.attachment_urls ||
    [];

  if (!Array.isArray(raw)) return [];

  return raw
    .map(normalizeAttachment)
    .filter((item): item is PierreEmailAttachment => Boolean(item));
}