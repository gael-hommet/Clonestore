// src/lib/pierre/v1/provider-integrations/credentials.ts
// PHASE 8.12 — credential resolution. Credentials come ONLY from the environment, never hardcoded and
// never logged. A provider is configured only when ALL its required env vars are present + non-empty.
// This file reads presence, never the values.

export function credentialPresence(requiredEnvVars: string[], env: NodeJS.ProcessEnv = process.env): { configured: boolean; missing: string[] } {
  const missing = requiredEnvVars.filter((k) => { const v = env[k]; return v === undefined || v === null || String(v).trim() === ""; });
  return { configured: requiredEnvVars.length > 0 && missing.length === 0, missing };
}

// Whether a live (non-sandbox) mode is explicitly enabled. Default false → sandbox at most.
export function liveModeEnabled(provider: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return env[`${provider.toUpperCase()}_LIVE`] === "1" || env[`${provider.toUpperCase()}_MODE`] === "live";
}
