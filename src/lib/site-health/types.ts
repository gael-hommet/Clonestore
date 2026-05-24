// src/lib/site-health/types.ts
// B31.6 — Site health check type contracts.

export type HealthCheckStatus = "pass" | "fail" | "warn";

export type HealthCheckResult = {
  name: string;
  status: HealthCheckStatus;
  message: string;
};

export type SiteHealthReport = {
  ok: boolean;
  checks: HealthCheckResult[];
  timestamp: string;
};
