// src/lib/pierre/v1/provider-integrations/preflight.ts
// PHASE 8.12 — provider preflight: resolve a provider's status from config + external blockers. NO
// network call is made (preflight is config-only). A blocked provider (P8.7.4) is never usable even
// if configured. This is what the execution layer checks before attempting any submission.

import type { ProviderAdapter, PreflightResult } from "./types";
import { credentialPresence, liveModeEnabled } from "./credentials";

export function preflight(adapter: ProviderAdapter, env: NodeJS.ProcessEnv = process.env): PreflightResult {
  const { configured, missing } = credentialPresence(adapter.requiredEnvVars, env);
  const blockedReason = adapter.blockedByExternalBlocker;
  let status: PreflightResult["status"];
  if (blockedReason) status = "blocked";
  else if (!configured) status = "not_configured";
  else status = liveModeEnabled(adapter.id, env) ? "live_configured" : "sandbox_configured";
  const usable = status === "live_configured";
  return { provider: adapter.id, status, configured, missingCredentials: missing, blockedReason, usable };
}
