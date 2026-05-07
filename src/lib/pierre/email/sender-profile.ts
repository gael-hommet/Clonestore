import type { SupabaseClient } from "@supabase/supabase-js";

import { safeString } from "@/lib/pierre/utils";

export type PierreSenderProfile = {
  sender_email: string;
  sender_name: string;
  reply_to: string | null;
  company_name: string | null;
  sending_domain: string | null;
  provider_mode: "gateway" | "webhook";
  provider_url: string | null;
  provider_secret: string | null;
  provider_api_key: string | null;
};

type GenericRecord = Record<string, unknown>;

function isRecord(value: unknown): value is GenericRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isProbablyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim());
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

function extractFirstObject(input: GenericRecord, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (isRecord(value)) {
      return value;
    }
  }

  return null;
}

function readStringDeep(input: GenericRecord | null, keys: string[]) {
  if (!input) return "";

  for (const key of keys) {
    const value = safeString(input[key]);
    if (value) return value;
  }

  return "";
}

function buildSenderEmailFromDomain(localPart: string, domain: string) {
  const cleanLocalPart = safeString(localPart).toLowerCase() || "pierre";
  const cleanDomain = normalizeDomain(domain);

  if (!cleanDomain) return "";

  return `${cleanLocalPart}@${cleanDomain}`;
}

function resolveMemoryConfig(row: GenericRecord | null) {
  if (!row) return null;

  const directNested =
    extractFirstObject(row, [
      "memory_json",
      "profile_json",
      "settings_json",
      "config_json",
      "configuration_json",
      "data_json",
      "value_json",
      "context_json",
      "company_context_json",
    ]) || row;

  const emailConfig =
    extractFirstObject(directNested, [
      "email",
      "mail",
      "email_settings",
      "mail_settings",
      "sender_profile",
      "sender",
      "smtp",
      "provider",
    ]) || directNested;

  return {
    root: directNested,
    email: emailConfig,
  };
}

export async function resolvePierreSenderProfile(
  supabase: SupabaseClient,
  input: {
    userId: string;
    payload?: Record<string, unknown> | null;
  }
): Promise<PierreSenderProfile> {
  const payload = (input.payload || {}) as GenericRecord;

  let memoryRow: GenericRecord | null = null;

  try {
    const { data } = await supabase
      .from("pierre_company_memory")
      .select("*")
      .eq("user_id", input.userId)
      .maybeSingle();

    memoryRow = (data as GenericRecord | null) || null;
  } catch {
    memoryRow = null;
  }

  const memory = resolveMemoryConfig(memoryRow);

  const payloadSenderEmail = safeString(payload.sender_email);
  const payloadSenderName = safeString(payload.sender_name);
  const payloadReplyTo = safeString(payload.reply_to);
  const payloadCompanyName = safeString(payload.company_name);
  const payloadSendingDomain = safeString(payload.sending_domain);
  const payloadProviderMode = safeString(payload.provider_mode);
  const payloadProviderUrl = safeString(payload.provider_url);
  const payloadProviderSecret = safeString(payload.provider_secret);
  const payloadProviderApiKey = safeString(payload.provider_api_key);
  const payloadLocalPart = safeString(payload.sender_local_part) || "pierre";

  const memorySenderEmail = readStringDeep(memory?.email || null, [
    "sender_email",
    "from_email",
    "email",
  ]);

  const memorySenderName = readStringDeep(memory?.email || null, [
    "sender_name",
    "from_name",
    "name",
  ]);

  const memoryReplyTo = readStringDeep(memory?.email || null, [
    "reply_to",
    "replyTo",
  ]);

  const memoryCompanyName =
    readStringDeep(memory?.root || null, [
      "company_name",
      "companyName",
      "legal_name",
      "brand_name",
      "brandName",
    ]) ||
    readStringDeep(memory?.email || null, [
      "company_name",
      "companyName",
    ]);

  const memorySendingDomain = readStringDeep(memory?.email || null, [
    "sending_domain",
    "domain",
    "mail_domain",
    "email_domain",
  ]);

  const memoryProviderMode = readStringDeep(memory?.email || null, [
    "provider_mode",
    "mode",
  ]);

  const memoryProviderUrl = readStringDeep(memory?.email || null, [
    "provider_url",
    "webhook_url",
    "gateway_url",
  ]);

  const memoryProviderSecret = readStringDeep(memory?.email || null, [
    "provider_secret",
    "webhook_secret",
    "gateway_secret",
  ]);

  const memoryProviderApiKey = readStringDeep(memory?.email || null, [
    "provider_api_key",
    "api_key",
    "apiKey",
  ]);

  const fallbackCompanyName = getEnv("PIERRE_DEFAULT_COMPANY_NAME");
  const fallbackSenderName = getEnv("PIERRE_DEFAULT_SENDER_NAME") || "Pierre";
  const fallbackSenderEmail = getEnv("PIERRE_DEFAULT_SENDER_EMAIL");
  const fallbackSendingDomain = getEnv("PIERRE_DEFAULT_SENDING_DOMAIN");
  const fallbackProviderMode = getEnv("PIERRE_EMAIL_PROVIDER_MODE") || "gateway";
  const fallbackProviderUrl = getEnv("PIERRE_EMAIL_GATEWAY_URL");
  const fallbackProviderSecret = getEnv("PIERRE_EMAIL_GATEWAY_SECRET");
  const fallbackProviderApiKey = getEnv("PIERRE_EMAIL_PROVIDER_API_KEY");

  const sendingDomain =
    payloadSendingDomain ||
    memorySendingDomain ||
    fallbackSendingDomain ||
    null;

  let senderEmail =
    payloadSenderEmail ||
    memorySenderEmail ||
    fallbackSenderEmail ||
    "";

  if (!senderEmail && sendingDomain) {
    senderEmail = buildSenderEmailFromDomain(payloadLocalPart, sendingDomain);
  }

  if (!isProbablyEmail(senderEmail)) {
    throw new Error(
      "Aucune adresse d’envoi Pierre valide n’est configurée pour cette entreprise."
    );
  }

  const senderName =
    payloadSenderName ||
    memorySenderName ||
    (memoryCompanyName ? `Pierre — ${memoryCompanyName}` : "") ||
    fallbackSenderName;

  const replyToRaw =
    payloadReplyTo ||
    memoryReplyTo ||
    senderEmail;

  const replyTo = isProbablyEmail(replyToRaw) ? replyToRaw : null;

  const providerModeRaw =
    payloadProviderMode ||
    memoryProviderMode ||
    fallbackProviderMode;

  const providerMode =
    providerModeRaw === "webhook" ? "webhook" : "gateway";

  return {
    sender_email: senderEmail,
    sender_name: senderName || "Pierre",
    reply_to: replyTo,
    company_name:
      payloadCompanyName ||
      memoryCompanyName ||
      fallbackCompanyName ||
      null,
    sending_domain: sendingDomain,
    provider_mode: providerMode,
    provider_url:
      payloadProviderUrl ||
      memoryProviderUrl ||
      fallbackProviderUrl ||
      null,
    provider_secret:
      payloadProviderSecret ||
      memoryProviderSecret ||
      fallbackProviderSecret ||
      null,
    provider_api_key:
      payloadProviderApiKey ||
      memoryProviderApiKey ||
      fallbackProviderApiKey ||
      null,
  };
}