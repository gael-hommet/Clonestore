// B43 — Pierre health checks: 7 service checks + combined report

import type { HealthCheckResult, HealthCheckStatus } from "../../observability/types";
import {
  buildHealthCheckResult,
  combineHealthChecks,
  buildEnvHealthCheck,
  checkFeatureFlagState,
  buildRuntimeModeCheck,
} from "../../observability/health";

// ── Individual service checks ─────────────────────────────────────────────────

export function checkAiProviderHealth(): HealthCheckResult {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return buildHealthCheckResult("ai_provider", "down", {
      message: "No AI provider API key configured.",
    });
  }
  const aiEnabled = checkFeatureFlagState("PIERRE_AI_ENABLED", true);
  if (!aiEnabled.enabled) {
    return buildHealthCheckResult("ai_provider", "disabled", {
      message: "AI provider disabled via feature flag.",
    });
  }
  return buildHealthCheckResult("ai_provider", "ok", {
    message: "AI provider configured.",
  });
}

export function checkEmailProviderHealth(): HealthCheckResult {
  return buildEnvHealthCheck("email_provider", {
    required: ["RESEND_API_KEY"],
    optional: ["RESEND_FROM_EMAIL"],
  });
}

export function checkSupabaseHealth(): HealthCheckResult {
  return buildEnvHealthCheck("supabase", {
    required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    optional: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  });
}

export function checkStorageHealth(): HealthCheckResult {
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hasSupabase) {
    return buildHealthCheckResult("storage", "degraded", {
      message: "Storage (Supabase) not fully configured.",
    });
  }
  return buildHealthCheckResult("storage", "ok", {
    message: "Storage configured.",
  });
}

export function checkPierreRuntimeHealth(): HealthCheckResult {
  const agentSlug = process.env.PIERRE_AGENT_SLUG ?? "pierre";
  const maxBudget = process.env.PIERRE_MAX_AI_BUDGET_EUR;
  const details: Record<string, unknown> = { agent_slug: agentSlug };
  if (!maxBudget) {
    return buildHealthCheckResult("pierre_runtime", "degraded", {
      message: "PIERRE_MAX_AI_BUDGET_EUR not set — budget guard inactive.",
      details,
    });
  }
  return buildHealthCheckResult("pierre_runtime", "ok", {
    message: "Pierre runtime configured.",
    details: { ...details, max_budget_eur: maxBudget },
  });
}

export function checkObservabilityHealth(): HealthCheckResult {
  const obsEnabled = checkFeatureFlagState("PIERRE_OBSERVABILITY_ENABLED", true);
  const dlEnabled = checkFeatureFlagState("PIERRE_DEAD_LETTER_ENABLED", false);
  return buildHealthCheckResult("observability", obsEnabled.enabled ? "ok" : "disabled", {
    message: obsEnabled.enabled ? "Observability active." : "Observability disabled.",
    details: {
      observability_enabled: obsEnabled.enabled,
      dead_letter_enabled: dlEnabled.enabled,
    },
  });
}

export function checkSecurityGuardHealth(): HealthCheckResult {
  const cloneGuardEnabled = checkFeatureFlagState("PIERRE_CLONE_GUARD_ENABLED", true);
  if (!cloneGuardEnabled.enabled) {
    return buildHealthCheckResult("security_guard", "degraded", {
      message: "CloneGuard disabled — security checks reduced.",
    });
  }
  return buildHealthCheckResult("security_guard", "ok", {
    message: "Security guards active.",
  });
}

// ── Combined report ───────────────────────────────────────────────────────────

export type PierreHealthReport = {
  generated_at: string;
  status: HealthCheckStatus;
  checks: HealthCheckResult[];
  degraded_services: string[];
  down_services: string[];
  safe_to_operate: boolean;
};

export function buildPierreHealthReport(): PierreHealthReport {
  const runtimeCheck = buildRuntimeModeCheck();

  const checks: HealthCheckResult[] = [
    runtimeCheck,
    checkAiProviderHealth(),
    checkEmailProviderHealth(),
    checkSupabaseHealth(),
    checkStorageHealth(),
    checkPierreRuntimeHealth(),
    checkObservabilityHealth(),
    checkSecurityGuardHealth(),
  ];

  const overall = combineHealthChecks(checks);

  const degraded_services = checks
    .filter((c) => c.status === "degraded")
    .map((c) => c.service);

  const down_services = checks
    .filter((c) => c.status === "down")
    .map((c) => c.service);

  // Pierre can operate if: no critical services are down
  // Critical services: ai_provider, supabase, security_guard
  const criticalDown = down_services.some((s) =>
    ["security_guard", "supabase"].includes(s),
  );

  return {
    generated_at: new Date().toISOString(),
    status: overall,
    checks,
    degraded_services,
    down_services,
    safe_to_operate: !criticalDown,
  };
}
