// src/lib/pierre/v1/channels.ts
// PHASE 8.1 — Pierre Production Runtime Core — channel model + MessageEnvelope.
//
// The runtime accepts work from many sources. Only some have a final provider in
// P8.1, but the data model, envelope, channel identity, permissions and routing
// are finalized so providers plug in without a runtime refactor.

export type ChannelSource =
  | "cockpit" | "text" | "voice" | "phone" | "sms" | "whatsapp" | "linkedin"
  | "slack" | "teams" | "form" | "file" | "system" | "calendar" | "webhook"
  | "employee_message" | "manager_message" | "proactive_signal";

export const CHANNEL_SOURCES: readonly ChannelSource[] = [
  "cockpit","text","voice","phone","sms","whatsapp","linkedin","slack","teams","form",
  "file","system","calendar","webhook","employee_message","manager_message","proactive_signal",
];

export type ChannelProviderStatus = "live" | "awaiting_integration";

/** Which sources are wired with a real provider in P8.1 (cockpit/api/system),
 *  vs. modeled-and-ready (everything else, awaiting integration in P8.3+). */
export function channelProviderStatus(source: ChannelSource): ChannelProviderStatus {
  return source === "cockpit" || source === "text" || source === "system" || source === "webhook"
    ? "live"
    : "awaiting_integration";
}

/** A channel identity an enterprise speaks through (email address, phone number,
 *  social handle…). Multiple identities per company / per site / per function. */
export type ChannelIdentity = {
  id: string;
  company_id: string;
  site_id: string | null;
  source: ChannelSource;
  address: string;            // email / number / handle
  display_name: string | null;
  authorized: boolean;
};

/** Canonical inbound envelope. Everything Pierre ingests becomes one of these. */
export type MessageEnvelope = {
  envelope_id: string;
  company_id: string;
  source: ChannelSource;
  channel_identity_id: string | null;
  requester_user_id: string | null;
  employee_id: string | null;
  site_id: string | null;
  subject: string | null;
  body: string;
  attachments: Array<{ ref: string; mime: string; name: string }>;
  received_at: string;
  correlation_id: string;
};

export function isAuthorizedIdentity(identity: ChannelIdentity | null | undefined): boolean {
  return Boolean(identity && identity.authorized);
}
