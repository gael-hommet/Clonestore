import { detectEmailInText, safeString } from "@/lib/pierre/utils";
import type { PierreSenderProfile } from "@/lib/pierre/email/sender-profile";
import {
  normalizePierreEmailAttachments,
  type PierreEmailAttachment,
} from "@/lib/pierre/email/attachments";

export type PierreBuiltEmailPayload = {
  from: {
    email: string;
    name: string;
  };
  reply_to: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body_text: string;
  body_html: string;
  attachments: PierreEmailAttachment[];
};

function isProbablyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim());
}

function uniqueEmails(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()))];
}

function collectEmails(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueEmails(
      value
        .map((item) => safeString(item))
        .filter((item) => isProbablyEmail(item))
    );
  }

  if (typeof value === "string") {
    const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return uniqueEmails(matches);
  }

  return [];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value: string) {
  const safe = escapeHtml(value);
  return `<div>${safe.replace(/\n{2,}/g, "</div><div>").replace(/\n/g, "<br />")}</div>`;
}

function buildDefaultSubject(payload: Record<string, unknown>) {
  return (
    safeString(payload.subject) ||
    safeString(payload.email_subject) ||
    safeString(payload.title) ||
    "Message RH prÃ©parÃ© par Pierre"
  );
}

function buildDefaultBodyText(payload: Record<string, unknown>) {
  const preferred =
    safeString(payload.body_text) ||
    safeString(payload.text) ||
    safeString(payload.message_text) ||
    safeString(payload.document_text) ||
    safeString(payload.generated_document_text);

  if (preferred) return preferred;

  const rawInput =
    safeString(payload.raw_input) ||
    safeString(payload.input) ||
    safeString(payload.prompt);

  if (rawInput) {
    return [
      "Bonjour,",
      "",
      "Pierre a prÃ©parÃ© ce message Ã  partir de la consigne suivante :",
      rawInput,
      "",
      "Merci.",
    ].join("\n");
  }

  return "Bonjour,\n\nMessage prÃ©parÃ© par Pierre.\n\nMerci.";
}

export function buildPierreEmailPayload(input: {
  senderProfile: PierreSenderProfile;
  payload: Record<string, unknown> | null | undefined;
}): PierreBuiltEmailPayload {
  const payload = input.payload || {};

  const to = uniqueEmails([
    ...collectEmails(payload.to),
    ...collectEmails(payload.recipient_email),
    ...collectEmails(payload.recipient_emails),
    ...collectEmails(payload.destinataire_email),
    ...collectEmails(payload.destinataires),
    ...collectEmails(safeString(payload.raw_input)),
  ]);

  const cc = uniqueEmails([
    ...collectEmails(payload.cc),
    ...collectEmails(payload.cc_emails),
  ]);

  const bcc = uniqueEmails([
    ...collectEmails(payload.bcc),
    ...collectEmails(payload.bcc_emails),
  ]);

  if (to.length === 0) {
    const detected = detectEmailInText(safeString(payload.raw_input));
    if (detected && isProbablyEmail(detected)) {
      to.push(detected.toLowerCase());
    }
  }

  if (to.length === 0) {
    throw new Error("Aucun destinataire email valide nâ€™a Ã©tÃ© dÃ©tectÃ©.");
  }

  const subject = buildDefaultSubject(payload);
  const bodyText = buildDefaultBodyText(payload);

  const bodyHtml =
    safeString(payload.body_html) ||
    safeString(payload.html) ||
    safeString(payload.message_html) ||
    safeString(payload.document_html) ||
    safeString(payload.generated_document_html) ||
    textToHtml(bodyText);

  return {
    from: {
      email: input.senderProfile.sender_email,
      name: input.senderProfile.sender_name,
    },
    reply_to: input.senderProfile.reply_to,
    to,
    cc,
    bcc,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    attachments: normalizePierreEmailAttachments(payload),
  };
}