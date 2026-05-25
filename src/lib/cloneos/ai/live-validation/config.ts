// src/lib/cloneos/ai/live-validation/config.ts
// B38B — Config reader. Pure, reads process.env, safe defaults.

import type { B38BConfig, B38BEnvSummary } from "./types";
import type { AiCommercialAccessLevel } from "../cost-shield/types";

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

export function getB38BConfig(): B38BConfig {
  return {
    live_enabled: getEnvBool("B38B_LIVE_OPENAI_ENABLED", false),
    max_total_cost_cents: getEnvInt("B38B_MAX_TOTAL_COST_CENTS", 100),
    max_scenarios: getEnvInt("B38B_MAX_SCENARIOS", 8),
    allowed_access_level:
      (getEnvSafe("B38B_ALLOWED_ACCESS_LEVEL") as AiCommercialAccessLevel) ?? "internal_admin",
    allow_strong_model: getEnvBool("B38B_ALLOW_STRONG_MODEL_CALLS", false),
    strong_model_max_calls: getEnvInt("B38B_STRONG_MODEL_MAX_CALLS", 2),
    output_report_dir: getEnvSafe("B38B_OUTPUT_REPORT_DIR") ?? ".local-reports/b38b",
    store_full_outputs: getEnvBool("B38B_STORE_FULL_OUTPUTS", false),
    redact_outputs: getEnvBool("B38B_REDACT_OUTPUTS", true),
  };
}

export function getB38BEnvSummary(): B38BEnvSummary {
  return {
    live_enabled: getEnvBool("B38B_LIVE_OPENAI_ENABLED", false),
    max_total_cost_cents: getEnvInt("B38B_MAX_TOTAL_COST_CENTS", 100),
    max_scenarios: getEnvInt("B38B_MAX_SCENARIOS", 8),
    openai_key_present: getEnvSafe("OPENAI_API_KEY") !== null,
    shield_mode: getEnvSafe("AI_COST_SHIELD_MODE") ?? "enforce",
    emergency_shutdown: getEnvBool("AI_EMERGENCY_SHUTDOWN", false),
    anthropic_enabled: getEnvBool("AI_ANTHROPIC_ENABLED", false),
    public_demo_allowed: getEnvBool("AI_PUBLIC_DEMO_ALLOW_REAL_CALLS", false),
    unpaid_allowed: getEnvBool("AI_UNPAID_ALLOW_REAL_CALLS", false),
    runtime_mode: getEnvSafe("AI_RUNTIME_MODE") ?? "mock",
  };
}
