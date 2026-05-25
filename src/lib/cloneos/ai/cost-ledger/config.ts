// src/lib/cloneos/ai/cost-ledger/config.ts
// B38C — Ledger configuration. Pure, reads env vars, safe defaults.
// All defaults: memory provider, no Supabase, no fail-closed, metadata redacted.

import type { AiCostLedgerConfig, AiCostLedgerProvider, AiCostLedgerWriteMode } from "./types";

function getEnvSafe(key: string): string | null {
  try {
    const v = process.env[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

function getEnvBool(key: string, fallback: boolean): boolean {
  const raw = getEnvSafe(key);
  if (raw === null) return fallback;
  return raw.toLowerCase() === "true";
}

function getEnvInt(key: string, fallback: number): number {
  const raw = getEnvSafe(key);
  if (raw === null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getAiCostLedgerConfig(): AiCostLedgerConfig {
  const rawProvider = getEnvSafe("AI_COST_LEDGER_PROVIDER")?.toLowerCase();
  const provider: AiCostLedgerProvider =
    rawProvider === "supabase" || rawProvider === "disabled"
      ? rawProvider
      : "memory"; // default: memory

  const rawWriteMode = getEnvSafe("AI_COST_LEDGER_WRITE_MODE")?.toLowerCase();
  const writeMode: AiCostLedgerWriteMode =
    rawWriteMode === "supabase" ||
    rawWriteMode === "dual_write" ||
    rawWriteMode === "disabled"
      ? rawWriteMode
      : "memory"; // default: memory

  return {
    provider,
    write_mode: writeMode,
    supabase_enabled: getEnvBool("AI_COST_LEDGER_SUPABASE_ENABLED", false),
    fail_closed: getEnvBool("AI_COST_LEDGER_FAIL_CLOSED", false),
    log_metadata: getEnvBool("AI_COST_LEDGER_LOG_METADATA", false),
    redact_metadata: getEnvBool("AI_COST_LEDGER_REDACT_METADATA", true),
    daily_global_cap_cents: getEnvInt(
      "AI_COST_LEDGER_DAILY_GLOBAL_CAP_CENTS",
      getEnvInt("AI_GLOBAL_DAILY_CAP_CENTS", 300),
    ),
    monthly_global_cap_cents: getEnvInt(
      "AI_COST_LEDGER_MONTHLY_GLOBAL_CAP_CENTS",
      getEnvInt("AI_GLOBAL_MONTHLY_CAP_CENTS", 1000),
    ),
  };
}
