// B43 — Health check utilities

import type { HealthCheckResult, HealthCheckStatus } from "./types";

// ── Build a single health check result ───────────────────────────────────────

export function buildHealthCheckResult(
  service: string,
  status: HealthCheckStatus,
  options: {
    latency_ms?: number;
    message?: string;
    details?: Record<string, unknown>;
  } = {},
): HealthCheckResult {
  return {
    service,
    status,
    latency_ms: options.latency_ms ?? null,
    checked_at: new Date().toISOString(),
    message: options.message ?? null,
    details_redacted: options.details ?? {},
  };
}

// ── Combine multiple health checks into one status ────────────────────────────

const STATUS_RANK: Record<HealthCheckStatus, number> = {
  ok: 0,
  disabled: 1,
  degraded: 2,
  down: 3,
};

export function combineHealthChecks(
  checks: HealthCheckResult[],
): HealthCheckStatus {
  if (checks.length === 0) return "ok";
  let worst: HealthCheckStatus = "ok";
  for (const c of checks) {
    if (STATUS_RANK[c.status] > STATUS_RANK[worst]) {
      worst = c.status;
    }
  }
  return worst;
}

// ── Env-var presence check ────────────────────────────────────────────────────

export type EnvCheckConfig = {
  required: string[];
  optional?: string[];
};

export type EnvCheckReport = {
  missing_required: string[];
  missing_optional: string[];
  all_required_present: boolean;
};

export function checkRequiredEnvPresence(config: EnvCheckConfig): EnvCheckReport {
  const env = process.env;
  const missing_required = config.required.filter(
    (k) => !env[k] || env[k]!.trim().length === 0,
  );
  const missing_optional = (config.optional ?? []).filter(
    (k) => !env[k] || env[k]!.trim().length === 0,
  );
  return {
    missing_required,
    missing_optional,
    all_required_present: missing_required.length === 0,
  };
}

export function buildEnvHealthCheck(
  service: string,
  config: EnvCheckConfig,
): HealthCheckResult {
  const report = checkRequiredEnvPresence(config);
  if (!report.all_required_present) {
    return buildHealthCheckResult(service, "down", {
      message: `Missing required env vars: ${report.missing_required.join(", ")}`,
      details: { missing_required: report.missing_required, missing_optional: report.missing_optional },
    });
  }
  if (report.missing_optional.length > 0) {
    return buildHealthCheckResult(service, "degraded", {
      message: `Missing optional env vars: ${report.missing_optional.join(", ")}`,
      details: { missing_optional: report.missing_optional },
    });
  }
  return buildHealthCheckResult(service, "ok");
}

// ── Runtime mode check ────────────────────────────────────────────────────────

export type RuntimeMode = "production" | "staging" | "development" | "test";

export function checkRuntimeMode(): RuntimeMode {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "test") return "test";
  if (process.env.VERCEL_ENV === "preview") return "staging";
  return "development";
}

export function buildRuntimeModeCheck(): HealthCheckResult {
  const mode = checkRuntimeMode();
  return buildHealthCheckResult("runtime_mode", "ok", {
    message: `Runtime mode: ${mode}`,
    details: { mode },
  });
}

// ── Feature flag check ────────────────────────────────────────────────────────

export type FeatureFlagState = {
  enabled: boolean;
  source: "env" | "default";
  value: string | null;
};

export function checkFeatureFlagState(
  envKey: string,
  defaultEnabled = false,
): FeatureFlagState {
  const raw = process.env[envKey];
  if (raw === undefined || raw === null) {
    return { enabled: defaultEnabled, source: "default", value: null };
  }
  const enabled = raw.trim().toLowerCase() === "true" || raw.trim() === "1";
  return { enabled, source: "env", value: raw };
}

// ── Latency-based health ──────────────────────────────────────────────────────

export function latencyToStatus(
  latency_ms: number,
  thresholds: { degraded: number; down: number },
): HealthCheckStatus {
  if (latency_ms >= thresholds.down) return "down";
  if (latency_ms >= thresholds.degraded) return "degraded";
  return "ok";
}

// ── Timed check wrapper ───────────────────────────────────────────────────────

export async function timedHealthCheck(
  service: string,
  fn: () => Promise<{ ok: boolean; message?: string; details?: Record<string, unknown> }>,
  options: { timeout_ms?: number } = {},
): Promise<HealthCheckResult> {
  const timeout_ms = options.timeout_ms ?? 5000;
  const start = Date.now();

  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Health check timeout")), timeout_ms),
      ),
    ]);

    const latency_ms = Date.now() - start;
    return buildHealthCheckResult(service, result.ok ? "ok" : "degraded", {
      latency_ms,
      message: result.message,
      details: result.details,
    });
  } catch (err) {
    const latency_ms = Date.now() - start;
    return buildHealthCheckResult(service, "down", {
      latency_ms,
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
