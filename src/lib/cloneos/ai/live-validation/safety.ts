// src/lib/cloneos/ai/live-validation/safety.ts
// B38B — Pre-run safety gate. Pure, no async.
// Refuses to run if ANY condition is violated. Paranoid by design.

import type { B38BSafetyGateResult, B38BConfig } from "./types";

function getEnvSafe(key: string): string | null {
  try {
    const v = process.env[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

// Hard limit — never exceed without manual confirmation
const ABSOLUTE_MAX_COST_CENTS = 150;

export function validateB38BSafetyGate(
  config: B38BConfig,
  mode: "live" | "dry-run",
  scenarioCount: number,
): B38BSafetyGateResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  if (mode === "live") {
    // 1. Live must be explicitly enabled
    if (!config.live_enabled) {
      failures.push(
        "B38B_LIVE_OPENAI_ENABLED must be 'true' to run live mode. Set it explicitly — never default to live.",
      );
    }

    // 2. OpenAI API key required
    if (getEnvSafe("OPENAI_API_KEY") === null) {
      failures.push("OPENAI_API_KEY must be set for live mode. Never hardcode it.");
    }

    // 3. Shield must be enforce
    const shieldMode = getEnvSafe("AI_COST_SHIELD_MODE") ?? "enforce";
    if (shieldMode !== "enforce") {
      failures.push(
        `AI_COST_SHIELD_MODE must be 'enforce'. Got: '${shieldMode}'. Live mode without enforcement is forbidden.`,
      );
    }

    // 4. Emergency shutdown must be off
    if (getEnvSafe("AI_EMERGENCY_SHUTDOWN")?.toLowerCase() === "true") {
      failures.push("AI_EMERGENCY_SHUTDOWN is 'true' — all AI calls are globally blocked.");
    }

    // 5. Anthropic must be disabled
    if (getEnvSafe("AI_ANTHROPIC_ENABLED")?.toLowerCase() === "true") {
      failures.push(
        "AI_ANTHROPIC_ENABLED must be 'false'. Anthropic is disabled until B38C+ with explicit budget allocation.",
      );
    }

    // 6. Public demo must not allow real calls
    if (getEnvSafe("AI_PUBLIC_DEMO_ALLOW_REAL_CALLS")?.toLowerCase() === "true") {
      failures.push(
        "AI_PUBLIC_DEMO_ALLOW_REAL_CALLS must be 'false'. Public demo must cost 0€.",
      );
    }

    // 7. Unpaid must not allow real calls
    if (getEnvSafe("AI_UNPAID_ALLOW_REAL_CALLS")?.toLowerCase() === "true") {
      failures.push(
        "AI_UNPAID_ALLOW_REAL_CALLS must be 'false'. Non-paying users never get real AI.",
      );
    }

    // 8. Max cost hard limit
    if (config.max_total_cost_cents > ABSOLUTE_MAX_COST_CENTS) {
      failures.push(
        `B38B_MAX_TOTAL_COST_CENTS=${config.max_total_cost_cents} exceeds absolute limit of ${ABSOLUTE_MAX_COST_CENTS}¢ (1.50€). Gaël's budget is ~9.74€. Never exceed without explicit confirmation.`,
      );
    }

    // 9. Access level must be internal_admin
    if (config.allowed_access_level !== "internal_admin") {
      failures.push(
        `B38B_ALLOWED_ACCESS_LEVEL must be 'internal_admin'. Got: '${config.allowed_access_level}'. Live validation is internal-only.`,
      );
    }

    // 11. Runtime mode must be production
    const runtimeMode = getEnvSafe("AI_RUNTIME_MODE") ?? "mock";
    if (runtimeMode !== "production") {
      failures.push(
        `AI_RUNTIME_MODE must be 'production' for live mode. Got: '${runtimeMode}'.`,
      );
    }
  }

  // 10. Scenario count — both modes
  if (scenarioCount > config.max_scenarios) {
    failures.push(
      `Scenario count (${scenarioCount}) exceeds B38B_MAX_SCENARIOS (${config.max_scenarios}). Reduce to protect budget.`,
    );
  }

  // Warnings for dry-run
  if (mode === "dry-run") {
    if (config.max_total_cost_cents > ABSOLUTE_MAX_COST_CENTS) {
      warnings.push(
        `B38B_MAX_TOTAL_COST_CENTS=${config.max_total_cost_cents} exceeds ${ABSOLUTE_MAX_COST_CENTS}¢ limit — would be rejected in live mode.`,
      );
    }
    if (config.allowed_access_level !== "internal_admin") {
      warnings.push(
        `B38B_ALLOWED_ACCESS_LEVEL='${config.allowed_access_level}' would be rejected in live mode (must be 'internal_admin').`,
      );
    }
  }

  return { passed: failures.length === 0, failures, warnings };
}

export function validateLiveProviderPolicy(
  provider: string,
): { valid: boolean; reason: string | null } {
  if (provider !== "openai") {
    return {
      valid: false,
      reason: `Provider must be 'openai' for B38B live validation. Got: '${provider}'. Anthropic is disabled.`,
    };
  }
  return { valid: true, reason: null };
}

export function validateLiveAccessLevel(
  accessLevel: string,
): { valid: boolean; reason: string | null } {
  if (accessLevel !== "internal_admin") {
    return {
      valid: false,
      reason: `Access level must be 'internal_admin' for live validation. Got: '${accessLevel}'.`,
    };
  }
  return { valid: true, reason: null };
}
