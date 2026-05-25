// src/lib/cloneos/ai/cost-shield/config.ts
// B38A — Cost Shield configuration. Pure, no async, reads env vars.
// All defaults are maximally safe: mock mode, Anthropic disabled, 0€ for non-paying.

import type { AiCostShieldMode } from "./types";

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

// ── Shield config shape ───────────────────────────────────────────────────────

export type AiCostShieldConfig = {
  // Operating mode
  shield_mode: AiCostShieldMode;
  emergency_shutdown: boolean;

  // Access policy
  public_demo_allow_real_calls: boolean;
  unpaid_allow_real_calls: boolean;
  trial_allow_real_calls: boolean;

  // Provider policy
  openai_enabled: boolean;
  anthropic_enabled: boolean;
  allowed_providers: string[];
  default_provider: string;
  openai_only: boolean;
  anthropic_fallback_enabled: boolean;

  // Global caps (cents)
  global_daily_cap_cents: number;
  global_monthly_cap_cents: number;
  company_daily_cap_cents: number;
  company_monthly_cap_cents: number;
  user_daily_cap_cents: number;
  user_monthly_cap_cents: number;
  mission_cap_cents: number;

  // Premium model protection (cents)
  premium_model_daily_cap_cents: number;
  free_premium_model_cap_cents: number;
  paid_premium_model_cap_cents: number;

  // Demo
  demo_runtime_mode: "static" | "mock" | "real";
  demo_ai_cost_cents: number;

  // Logging (no PII by default)
  log_prompts: boolean;
  log_completions: boolean;
};

// ── Config reader ─────────────────────────────────────────────────────────────

export function getAiCostShieldConfig(): AiCostShieldConfig {
  // Parse shield mode with safe fallback to "enforce" on invalid value
  const rawMode = getEnvSafe("AI_COST_SHIELD_MODE")?.toLowerCase();
  const shieldMode: AiCostShieldMode =
    rawMode === "disabled" || rawMode === "observe" || rawMode === "enforce"
      ? rawMode
      : "enforce"; // Invalid or absent → enforce (safe default)

  // Allowed providers list
  const rawProviders = getEnvSafe("AI_ALLOWED_PROVIDERS") ?? "openai,mock";
  const allowedProviders = rawProviders
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);

  // Demo runtime mode
  const rawDemo = getEnvSafe("DEMO_RUNTIME_MODE")?.toLowerCase();
  const demoMode: "static" | "mock" | "real" =
    rawDemo === "mock" || rawDemo === "real" ? rawDemo : "static";

  return {
    shield_mode: shieldMode,
    emergency_shutdown: getEnvBool("AI_EMERGENCY_SHUTDOWN", false),

    public_demo_allow_real_calls: getEnvBool("AI_PUBLIC_DEMO_ALLOW_REAL_CALLS", false),
    unpaid_allow_real_calls: getEnvBool("AI_UNPAID_ALLOW_REAL_CALLS", false),
    trial_allow_real_calls: getEnvBool("AI_TRIAL_ALLOW_REAL_CALLS", false),

    openai_enabled: getEnvBool("AI_OPENAI_ENABLED", true),
    anthropic_enabled: getEnvBool("AI_ANTHROPIC_ENABLED", false), // Disabled until B38B+
    allowed_providers: allowedProviders,
    default_provider: getEnvSafe("AI_DEFAULT_PROVIDER") ?? "openai",
    openai_only: getEnvBool("AI_OPENAI_ONLY", true),
    anthropic_fallback_enabled: getEnvBool("AI_ANTHROPIC_FALLBACK_ENABLED", false),

    global_daily_cap_cents: getEnvInt("AI_GLOBAL_DAILY_CAP_CENTS", 300),
    global_monthly_cap_cents: getEnvInt("AI_GLOBAL_MONTHLY_CAP_CENTS", 1000),
    company_daily_cap_cents: getEnvInt("AI_COMPANY_DAILY_CAP_CENTS", 100),
    company_monthly_cap_cents: getEnvInt("AI_COMPANY_MONTHLY_CAP_CENTS", 500),
    user_daily_cap_cents: getEnvInt("AI_USER_DAILY_CAP_CENTS", 50),
    user_monthly_cap_cents: getEnvInt("AI_USER_MONTHLY_CAP_CENTS", 200),
    mission_cap_cents: getEnvInt("AI_MISSION_CAP_CENTS", 30),

    premium_model_daily_cap_cents: getEnvInt("AI_PREMIUM_MODEL_DAILY_CAP_CENTS", 0),
    free_premium_model_cap_cents: getEnvInt("AI_FREE_PREMIUM_MODEL_CAP_CENTS", 0),
    paid_premium_model_cap_cents: getEnvInt("AI_PAID_PREMIUM_MODEL_CAP_CENTS", 100),

    demo_runtime_mode: demoMode,
    demo_ai_cost_cents: getEnvInt("DEMO_AI_COST_CENTS", 0),

    log_prompts: getEnvBool("AI_COST_LOG_PROMPTS", false),
    log_completions: getEnvBool("AI_COST_LOG_COMPLETIONS", false),
  };
}

// ── Convenience accessors ─────────────────────────────────────────────────────

export function isEmergencyShutdown(): boolean {
  return getAiCostShieldConfig().emergency_shutdown;
}

export function isAnthropicEnabled(): boolean {
  return getAiCostShieldConfig().anthropic_enabled;
}

export function isOpenAIEnabled(): boolean {
  return getAiCostShieldConfig().openai_enabled;
}

export function isPublicDemoAiAllowed(): boolean {
  return getAiCostShieldConfig().public_demo_allow_real_calls;
}

export function getDemoRuntimeMode(): "static" | "mock" | "real" {
  return getAiCostShieldConfig().demo_runtime_mode;
}

export function getShieldMode(): AiCostShieldMode {
  return getAiCostShieldConfig().shield_mode;
}
