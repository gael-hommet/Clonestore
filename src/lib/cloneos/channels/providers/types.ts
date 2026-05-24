// src/lib/cloneos/channels/providers/types.ts
// B33 — Provider adapter interface for channel sends.

import type { ChannelKind, MessageEnvelope } from "../types";

export type ChannelProviderSendParams = {
  envelope: MessageEnvelope;
  body: string | null;
  body_html?: string | null;
};

export type ChannelProviderSendResult = {
  ok: boolean;
  provider_message_id: string | null;
  error: string | null;
  meta: Record<string, unknown>;
};

export type ChannelProviderAdapter = {
  id: string;
  supports(kind: ChannelKind): boolean;
  isConfigured(): boolean;
  send(params: ChannelProviderSendParams): Promise<ChannelProviderSendResult>;
};
