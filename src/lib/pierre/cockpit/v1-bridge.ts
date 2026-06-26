// src/lib/pierre/cockpit/v1-bridge.ts
// PHASE 8.1 — Cockpit → canonical v1 runtime bridge.
//
// The cockpit's single seam onto /api/pierre/v1/*. New missions are written ONLY
// through the canonical runtime here. The legacy `submitPierreMission` path is
// deprecated and must not be used by new cockpit code.
//
// PHASE 8.2 — v1 is now the DEFAULT path. The tenancy backfill seeds
// `pierre_rt_members` (companies + owner memberships) from the legacy per-user
// ownership model. Migrated accounts write only to pierre_rt_*; accounts not yet
// backfilled transparently fall back to the (deprecated) legacy path — so no user
// is broken during/after rollout. Set NEXT_PUBLIC_PIERRE_RUNTIME_V1="0" to force
// legacy. Data flow proven vs real Postgres in
// src/lib/pierre/v1/__integration__/cockpit-dataflow.itest.ts.

import { createPierreClient, type PierreV1Client, PierreClientError } from "@/lib/pierre/v1/client";

/** Whether the cockpit uses the canonical v1 runtime as its data source (default ON). */
export function pierreRuntimeV1Enabled(): boolean {
  return process.env.NEXT_PUBLIC_PIERRE_RUNTIME_V1 !== "0";
}

/**
 * ONLY a not-migrated account may use the legacy emergency fallback — and only
 * when explicitly allowed. NEVER fall back on tenant_access_denied / forbidden /
 * membership_suspended / company_suspended (those are real authorization results).
 */
export function isNotMigratedError(err: unknown): boolean {
  return err instanceof PierreClientError && err.code === "tenant_not_migrated";
}

/** Default OFF (post-backfill, legacy is forbidden in normal operation). During
 *  rollout, set PIERRE_ALLOW_LEGACY_EMERGENCY_FALLBACK="true" until backfill done. */
export function legacyEmergencyFallbackAllowed(): boolean {
  return process.env.NEXT_PUBLIC_PIERRE_ALLOW_LEGACY_EMERGENCY_FALLBACK === "true";
}

/** Build the cockpit's v1 client for the active company. */
export function createCockpitV1Client(companyId: string): PierreV1Client {
  return createPierreClient({ companyId });
}

/**
 * PHASE 8.2-C — metric + alert when the legacy path is touched. In normal
 * operation (post-backfill) this must never fire. It emits a console warning and
 * a `pierre:legacy-fallback` window event so dashboards/alerting can catch any
 * regression to the deprecated `/api/pierre/use/*` surface. Never throws.
 */
export function recordLegacyFallbackUsed(endpoint: string, reason: string): void {
  try {
    // eslint-disable-next-line no-console
    console.warn(`[pierre][legacy-fallback] endpoint=${endpoint} reason=${reason}`);
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("pierre:legacy-fallback", { detail: { endpoint, reason, at: Date.now() } }));
    }
  } catch { /* metrics must never break the app */ }
}

export { PierreClientError };
