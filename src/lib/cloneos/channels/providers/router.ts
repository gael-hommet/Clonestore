// src/lib/cloneos/channels/providers/router.ts
// B37 — Active channel provider selection.
// Returns mock by default. Returns Resend only when fully configured for production.

import type { ChannelRuntimeMode } from "../types";
import type { ChannelProviderAdapter } from "./types";
import { mockChannelProvider } from "./mock";
import { resendChannelProvider, getResendConfig } from "./resend";

function getEnvSafe(key: string): string | null {
  try {
    const v = process.env[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

// ── Active provider selection ─────────────────────────────────────────────────

export function getActiveChannelProvider(mode: ChannelRuntimeMode): ChannelProviderAdapter | null {
  if (mode === "disabled") return null;
  if (mode === "mock") return mockChannelProvider;

  // mode === "production" — check if a real provider is configured
  const defaultProvider = getEnvSafe("CHANNEL_DEFAULT_PROVIDER");

  if (defaultProvider === "resend") {
    const cfg = getResendConfig();
    if (cfg.api_key_present && cfg.email_provider === "resend") {
      return resendChannelProvider;
    }
    // Resend selected but not fully configured — fall back to mock safely
    return mockChannelProvider;
  }

  // No real provider configured — fall back to mock
  return mockChannelProvider;
}
