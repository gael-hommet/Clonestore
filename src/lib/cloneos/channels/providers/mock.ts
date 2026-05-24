// src/lib/cloneos/channels/providers/mock.ts
// B33 — Mock provider. No real sends, no external calls. Always safe to use.

import type { ChannelKind } from "../types";
import type { ChannelProviderAdapter, ChannelProviderSendParams, ChannelProviderSendResult } from "./types";

function makeMockProviderId(envelopeId: string): string {
  return `mock_${envelopeId}_${Date.now().toString(36)}`;
}

export const mockChannelProvider: ChannelProviderAdapter = {
  id: "mock",

  supports(_kind: ChannelKind): boolean {
    return true; // mock handles every channel kind
  },

  isConfigured(): boolean {
    return true; // mock is always configured
  },

  async send(params: ChannelProviderSendParams): Promise<ChannelProviderSendResult> {
    const { envelope } = params;
    const provider_message_id = makeMockProviderId(envelope.id);

    return {
      ok: true,
      provider_message_id,
      error: null,
      meta: {
        mock: true,
        channel_kind: envelope.channel_kind,
        to_count: envelope.to.length,
        simulated_at: new Date().toISOString(),
      },
    };
  },
};

export function getProviderForMode(mode: "mock" | "disabled" | "production"): ChannelProviderAdapter | null {
  if (mode === "mock") return mockChannelProvider;
  if (mode === "disabled") return null;
  // production: callers supply a real provider — mock is the fallback
  return mockChannelProvider;
}
