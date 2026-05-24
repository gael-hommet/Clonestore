// src/lib/pierre/cockpit/api-client.ts
// Pierre Cockpit B31 — Client-side API wrapper.
// Never throws. Returns { ok, data, error, status }.
// No secrets. No direct OpenAI/Anthropic calls. No auto-execute on sensitive.

import type { PierreCockpitActionResult } from "./types";
import { getCurrentAccessToken } from "@/lib/auth/session-client";

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

export async function submitPierreMission(payload: {
  input: string;
  source?: string;
  autonomy_level?: string;
}): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/submit", {
    ...jsonBody(payload),
  });
}

export async function fetchPierreMission(missionId: string): Promise<PierreCockpitActionResult> {
  if (!missionId) return { ok: false, error: "missionId requis", status: 400 };
  return safeFetch(`/api/pierre/use/mission/${encodeURIComponent(missionId)}`);
}

export async function fetchPierreHistory(): Promise<PierreCockpitActionResult> {
  return safeFetch("/api/pierre/use/continuity");
}

// ══════════════════════════════════════════════════════════════
// TASKS — guard: never auto-execute email.send or approval_required
// ══════════════════════════════════════════════════════════════

export async function approvePierreTask(
  taskId: string,
  payload?: Record<string, unknown>,
): Promise<PierreCockpitActionResult> {
  if (!taskId) return { ok: false, error: "taskId requis", status: 400 };
  return safeFetch(`/api/pierre/use/task/${encodeURIComponent(taskId)}/approve`, {
    ...jsonBody(payload ?? {}),
  });
}

export async function cancelPierreTask(
  taskId: string,
  payload?: Record<string, unknown>,
): Promise<PierreCockpitActionResult> {
  if (!taskId) return { ok: false, error: "taskId requis", status: 400 };
  return safeFetch(`/api/pierre/use/task/${encodeURIComponent(taskId)}/cancel`, {
    ...jsonBody(payload ?? {}),
  });
}

export async function runPierreTask(
  taskId: string,
  payload?: Record<string, unknown>,
): Promise<PierreCockpitActionResult> {
  if (!taskId) return { ok: false, error: "taskId requis", status: 400 };
  return safeFetch(`/api/pierre/use/task/${encodeURIComponent(taskId)}/run`, {
    ...jsonBody(payload ?? {}),
  });
}

export async function reschedulePierreTask(
  taskId: string,
  payload?: Record<string, unknown>,
): Promise<PierreCockpitActionResult> {
  if (!taskId) return { ok: false, error: "taskId requis", status: 400 };
  return safeFetch(`/api/pierre/use/task/${encodeURIComponent(taskId)}/reschedule`, {
    ...jsonBody(payload ?? {}),
  });
}

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
