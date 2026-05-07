import type { PierreBuiltEmailPayload } from "@/lib/pierre/email/build-payload";
import type { PierreSenderProfile } from "@/lib/pierre/email/sender-profile";

export type PierreEmailProviderSendResult = {
  ok: boolean;
  provider: string;
  message_id: string | null;
  status: string;
  response_json: Record<string, unknown>;
};

function safeJsonParse(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : { raw: value };
  } catch {
    return { raw: value };
  }
}

export async function sendPierreEmailWithProvider(input: {
  senderProfile: PierreSenderProfile;
  email: PierreBuiltEmailPayload;
}) : Promise<PierreEmailProviderSendResult> {
  const endpoint = input.senderProfile.provider_url;

  if (!endpoint) {
    throw new Error(
      "Aucun provider d’envoi email n’est configuré pour Pierre."
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.senderProfile.provider_secret
        ? { "x-pierre-provider-secret": input.senderProfile.provider_secret }
        : {}),
      ...(input.senderProfile.provider_api_key
        ? { Authorization: `Bearer ${input.senderProfile.provider_api_key}` }
        : {}),
    },
    body: JSON.stringify({
      mode: input.senderProfile.provider_mode,
      from: input.email.from,
      reply_to: input.email.reply_to,
      to: input.email.to,
      cc: input.email.cc,
      bcc: input.email.bcc,
      subject: input.email.subject,
      body_text: input.email.body_text,
      body_html: input.email.body_html,
      attachments: input.email.attachments,
    }),
  });

  const rawText = await response.text();
  const parsed = safeJsonParse(rawText);

  if (!response.ok) {
    throw new Error(
      typeof parsed.error === "string"
        ? parsed.error
        : `Le provider email Pierre a renvoyé HTTP ${response.status}.`
    );
  }

  return {
    ok: true,
    provider:
      typeof parsed.provider === "string"
        ? parsed.provider
        : input.senderProfile.provider_mode,
    message_id:
      typeof parsed.message_id === "string"
        ? parsed.message_id
        : typeof parsed.id === "string"
        ? parsed.id
        : null,
    status:
      typeof parsed.status === "string"
        ? parsed.status
        : "sent",
    response_json: parsed,
  };
}