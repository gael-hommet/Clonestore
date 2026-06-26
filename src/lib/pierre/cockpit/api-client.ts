// src/lib/pierre/cockpit/api-client.ts
// Pierre Cockpit B31 — Client-side API wrapper.
// Never throws. Returns { ok, data, error, status }.
// No secrets. No direct OpenAI/Anthropic calls. No auto-execute on sensitive.

import type { PierreCockpitActionResult } from "./types";
import { getCurrentAccessToken } from "@/lib/auth/session-client";
import { pierreRuntimeV1Enabled, createCockpitV1Client, isNotMigratedError, legacyEmergencyFallbackAllowed, recordLegacyFallbackUsed, PierreClientError, } from "./v1-bridge";
import type { PierreV1Client } from "@/lib/pierre/v1/client";

/**
 * PHASE 8.2-C — single V1 call seam for cockpit reads/decisions. V1 is the only
 * active data source. The legacy `/api/pierre/use/*` path is used ONLY for a
 * not-migrated account AND only when the emergency flag is on — and any such use
 * is recorded as a metric/alert. A 403 / suspended / cross-tenant result is a real
 * authorization outcome and is surfaced, never silently routed to legacy.
 */
async function callV1(
  fn: (client: PierreV1Client) => Promise<unknown>,
  opts: { legacyEndpoint?: string; companyId?: string } = {},
): Promise<PierreCockpitActionResult> {
  if (!pierreRuntimeV1Enabled()) {
    if (opts.legacyEndpoint) { recordLegacyFallbackUsed(opts.legacyEndpoint, "runtime_v1_disabled"); return safeFetch(opts.legacyEndpoint); }
    return { ok: false, status: 503, error: "RUNTIME_V1_DISABLED" };
  }
  try {
    const client = createCockpitV1Client(opts.companyId ?? "");
    const data = await fn(client);
    return { ok: true, status: 200, data };
  } catch (err) {
    const mayFallback = isNotMigratedError(err) && legacyEmergencyFallbackAllowed() && !!opts.legacyEndpoint;
    if (mayFallback) { recordLegacyFallbackUsed(opts.legacyEndpoint as string, "tenant_not_migrated"); return safeFetch(opts.legacyEndpoint as string); }
    if (err instanceof PierreClientError) return { ok: false, status: err.status, error: err.code, data: { message: err.message, request_id: err.requestId } };
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "Erreur réseau" };
  }
}

// ══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════

async function getBearerToken(): Promise<string | null> {
  return getCurrentAccessToken();
}

async function safeFetch(
  url: string,
  options?: RequestInit,
): Promise<PierreCockpitActionResult> {
  const token = await getBearerToken();
  if (!token) {
    return { ok: false, status: 401, error: "AUTH_REQUIRED" };
  }

  try {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
      ...options,
    });

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // empty body
    }

    if (!res.ok) {
      const errMsg =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as Record<string, unknown>).error === "string"
          ? (data as Record<string, unknown>).error as string
          : `Erreur ${res.status}`;
      return { ok: false, error: errMsg, status: res.status, data };
    }

    return { ok: true, data, status: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur réseau";
    return { ok: false, error: msg, status: 0 };
  }
}

function jsonBody(payload: unknown): { body: string; method: string } {
  return { body: JSON.stringify(payload), method: "POST" };
}

// ══════════════════════════════════════════════════════════════
// MISSION
// ══════════════════════════════════════════════════════════════

/**
 * Submit a new mission.
 *
 * PHASE 8.2 — canonical write path is the v1 runtime (`/api/pierre/v1/missions`,
 * idempotent, governed, durable). It is the DEFAULT. The server derives the active
 * company from the user's membership, so `companyId` is optional. Accounts not yet
 * migrated (no `pierre_rt_members` row) transparently fall back to the legacy
 * **@deprecated** `/api/pierre/use/submit` path — no user is broken during rollout.
 * Set NEXT_PUBLIC_PIERRE_RUNTIME_V1="0" to force legacy. New cockpit code must not
 * call the legacy endpoint directly.
 */
export async function submitPierreMission(payload: {
  input: string;
  source?: string;
  autonomy_level?: string;
  companyId?: string;
}): Promise<PierreCockpitActionResult> {
  if (pierreRuntimeV1Enabled()) {
    try {
      const client = createCockpitV1Client(payload.companyId ?? ""); // server derives default company
      const mission = await client.createMission({ instruction: payload.input, source: payload.source ?? "cockpit" });
      return { ok: true, status: 200, data: mission };
    } catch (err) {
      // Legacy fallback is permitted ONLY for a not-migrated account AND only when
      // the emergency flag is explicitly on. Every other error (incl. 403s) surfaces.
      const mayFallback = isNotMigratedError(err) && legacyEmergencyFallbackAllowed();
      if (!mayFallback) {
        if (err instanceof PierreClientError) {
          return { ok: false, status: err.status, error: err.code, data: { message: err.message, request_id: err.requestId } };
        }
        return { ok: false, status: 0, error: err instanceof Error ? err.message : "Erreur réseau" };
      }
    }
  }
  // @deprecated legacy path (writes to pierre_* tables) — fallback only.
  return safeFetch("/api/pierre/use/submit", {
    ...jsonBody({ input: payload.input, source: payload.source, autonomy_level: payload.autonomy_level }),
  });
}

/** Mission detail — V1 only (reads the canonical runtime). */
export async function fetchPierreMission(missionId: string, companyId?: string): Promise<PierreCockpitActionResult> {
  if (!missionId) return { ok: false, error: "missionId requis", status: 400 };
  return callV1((c) => c.getMission(missionId), { legacyEndpoint: `/api/pierre/use/mission/${encodeURIComponent(missionId)}`, companyId });
}

/** Mission history / list — V1 only, cursor-paginated. */
export async function fetchPierreHistory(q: { limit?: number; cursor?: string | null; status?: string | null; companyId?: string } = {}): Promise<PierreCockpitActionResult> {
  return callV1((c) => c.listMissions({ limit: q.limit, cursor: q.cursor ?? null, status: q.status ?? null }), { legacyEndpoint: "/api/pierre/use/continuity", companyId: q.companyId });
}

/** Mission tasks — V1 only. */
export async function fetchPierreMissionTasks(missionId: string, companyId?: string): Promise<PierreCockpitActionResult> {
  if (!missionId) return { ok: false, error: "missionId requis", status: 400 };
  return callV1((c) => c.getMissionTasks(missionId), { companyId });
}

/** Mission timeline — V1 only. */
export async function fetchPierreMissionTimeline(missionId: string, companyId?: string): Promise<PierreCockpitActionResult> {
  if (!missionId) return { ok: false, error: "missionId requis", status: 400 };
  return callV1((c) => c.getMissionTimeline(missionId), { companyId });
}

/** Mission validations — V1 only. */
export async function fetchPierreMissionValidations(missionId: string, companyId?: string): Promise<PierreCockpitActionResult> {
  if (!missionId) return { ok: false, error: "missionId requis", status: 400 };
  return callV1((c) => c.listMissionValidations(missionId), { companyId });
}

/** Worker / runtime state — V1 only. */
export async function fetchPierreWorkerState(companyId?: string): Promise<PierreCockpitActionResult> {
  return callV1((c) => c.getRuntimeHealth(), { companyId });
}

/** Advance the governed queue one tick — V1 worker route (not legacy). */
export async function tickPierreWorker(payload?: { batch?: number }): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/v1/worker/tick", { ...jsonBody(payload ?? { batch: 10 }) });
}

// ══════════════════════════════════════════════════════════════
// DECISIONS — V1 validation lifecycle (approve / reject / request-changes / cancel)
// ══════════════════════════════════════════════════════════════

export async function approvePierreValidation(validationId: string, version: number, companyId?: string): Promise<PierreCockpitActionResult> {
  if (!validationId) return { ok: false, error: "validationId requis", status: 400 };
  return callV1((c) => c.approveValidation(validationId, version), { companyId });
}
export async function rejectPierreValidation(validationId: string, version: number, companyId?: string): Promise<PierreCockpitActionResult> {
  if (!validationId) return { ok: false, error: "validationId requis", status: 400 };
  return callV1((c) => c.rejectValidation(validationId, version), { companyId });
}
export async function requestPierreValidationChanges(validationId: string, version: number, companyId?: string): Promise<PierreCockpitActionResult> {
  if (!validationId) return { ok: false, error: "validationId requis", status: 400 };
  return callV1((c) => c.requestValidationChanges(validationId, version), { companyId });
}
export async function cancelPierreMission(missionId: string, companyId?: string): Promise<PierreCockpitActionResult> {
  if (!missionId) return { ok: false, error: "missionId requis", status: 400 };
  return callV1((c) => c.cancelMission(missionId), { companyId });
}

// ══════════════════════════════════════════════════════════════
// TASKS — REMOVED. The legacy per-task endpoints (/api/pierre/use/task/*) and
// their wrappers (approve/cancel/run/reschedulePierreTask) are decommissioned.
// The active cockpit uses the V1 validation lifecycle above + tickPierreWorker.
// A static test (cockpit-v1-only.test.ts) fails if they are reintroduced.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// EMPLOYEES
// ══════════════════════════════════════════════════════════════

export async function fetchPierreEmployeesFiles(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/employees/files");
}

export async function fetchPierreEmployeeFile(employeeId: string): Promise<PierreCockpitActionResult> {
  if (!employeeId) return { ok: false, error: "employeeId requis", status: 400 };
  return safeFetch(`/api/pierre/use/employee/${encodeURIComponent(employeeId)}/file`);
}

// ══════════════════════════════════════════════════════════════
// CLONEADN
// ══════════════════════════════════════════════════════════════

export async function fetchPierreCloneADN(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/cloneadn");
}

export async function updatePierreCloneADN(
  patch: Record<string, unknown>,
): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/cloneadn", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ══════════════════════════════════════════════════════════════
// DOCUMENT TEMPLATES
// ══════════════════════════════════════════════════════════════

export async function fetchPierreDocumentTemplates(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/document-templates");
}

export async function previewPierreDocumentTemplate(payload: {
  template_id?: string;
  kind?: string;
  variables?: Record<string, string>;
}): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/document-templates/preview", {
    ...jsonBody(payload),
  });
}

// ══════════════════════════════════════════════════════════════
// CUSTOMER SUCCESS / VALUE
// ══════════════════════════════════════════════════════════════

export async function fetchPierreCustomerSuccess(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/customer-success");
}

export async function fetchPierreReadiness(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/readiness");
}

// ══════════════════════════════════════════════════════════════
// RELEASE CANDIDATE
// ══════════════════════════════════════════════════════════════

export async function fetchPierreReleaseCandidate(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/release-candidate");
}

// ══════════════════════════════════════════════════════════════
// SCENARIOS (GOLDEN)
// ══════════════════════════════════════════════════════════════

export async function fetchPierreScenarios(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/scenarios");
}

export async function runPierreScenario(
  scenarioId: string,
  payload?: Record<string, unknown>,
): Promise<PierreCockpitActionResult> {
  if (!scenarioId) return { ok: false, error: "scenarioId requis", status: 400 };
  return safeFetch(
    `/api/pierre/use/scenarios/${encodeURIComponent(scenarioId)}/run`,
    { ...jsonBody(payload ?? { dry_run: true, ai_mode: "off" }) },
  );
}

export async function runPierreScenarioSuite(
  payload?: Record<string, unknown>,
): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/scenarios/run-suite", {
    ...jsonBody(payload ?? { dry_run: true, ai_mode: "off" }),
  });
}

// ══════════════════════════════════════════════════════════════
// AI RUNTIME STATUS
// ══════════════════════════════════════════════════════════════

export async function fetchCloneOSAIStatus(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/cloneos/ai/status");
}

// ══════════════════════════════════════════════════════════════
// MESSAGES / TRACE
// ══════════════════════════════════════════════════════════════

export async function fetchPierreMessages(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/messages");
}

export async function fetchPierreAuditTrailAlerts(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/audit-trail/alerts");
}
