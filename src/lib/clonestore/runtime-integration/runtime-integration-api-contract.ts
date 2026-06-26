// src/lib/clonestore/runtime-integration/runtime-integration-api-contract.ts
// PHASE 4.2 — Runtime API Simulation Endpoint — API Contract
//
// Module pur. Contrat de l'endpoint de simulation read-only.
// Pas de fetch, pas de Supabase, pas de DB, pas d'import Pierre, pas d'exécution.

import type { RuntimeIntegrationReadResult } from "./runtime-integration-types";

export const RUNTIME_INTEGRATION_SIMULATE_ENDPOINT = "/api/clonestore/runtime/simulate" as const;

// ── Enums ─────────────────────────────────────────────────────────────────────

export type RuntimeIntegrationSimulationApiMethod = "GET" | "POST";

export type RuntimeIntegrationSimulationApiStatus =
  | "ok"
  | "capabilities"
  | "invalid_request"
  | "error";

// ── Request / Response ────────────────────────────────────────────────────────

export type RuntimeIntegrationSimulationApiRequest = {
  raw_text: string;
  source?: string;
  locale?: string;
  user_id?: string;
  company_id?: string;
  mode?: "simulation";
  metadata?: Record<string, unknown>;
};

export type RuntimeIntegrationSimulationApiError = {
  code: string;
  message: string;
};

export type RuntimeIntegrationSimulationApiExample = {
  id: string;
  label: string;
  raw_text: string;
  expected_note: string;
  expected_blocked: boolean;
};

export type RuntimeIntegrationSimulationApiCapabilities = {
  endpoint: string;
  methods: RuntimeIntegrationSimulationApiMethod[];
  supports_simulation: true;
  supports_execution: false;
  supports_db_write: false;
  supports_ai_call: false;
  supports_email_send: false;
  supports_document_generation: false;
  supports_clonevoice: false;
  scale_80k_proven: false;
  scale_80k_not_proven: true;
};

export type RuntimeIntegrationSimulationApiResponse = {
  ok: boolean;
  status: RuntimeIntegrationSimulationApiStatus;
  result?: RuntimeIntegrationReadResult;
  capabilities?: RuntimeIntegrationSimulationApiCapabilities;
  examples?: RuntimeIntegrationSimulationApiExample[];
  error?: RuntimeIntegrationSimulationApiError;
  read_only: true;
  simulation_only: true;
  execution_enabled: false;
  db_write_performed: false;
  ai_call_performed: false;
  email_sent: false;
  document_generated: false;
  clonevoice_active: false;
  public_launch_external_validated: false;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildRuntimeIntegrationSimulationApiCapabilities(): RuntimeIntegrationSimulationApiCapabilities {
  return {
    endpoint: RUNTIME_INTEGRATION_SIMULATE_ENDPOINT,
    methods: ["GET", "POST"],
    supports_simulation: true,
    supports_execution: false,
    supports_db_write: false,
    supports_ai_call: false,
    supports_email_send: false,
    supports_document_generation: false,
    supports_clonevoice: false,
    scale_80k_proven: false,
    scale_80k_not_proven: true,
  };
}

export function buildRuntimeIntegrationSimulationApiExamples(): RuntimeIntegrationSimulationApiExample[] {
  return [
    {
      id: "ex_onboarding",
      label: "Préparer l'onboarding d'un salarié",
      raw_text: "Préparer l'onboarding d'un salarié qui arrive lundi",
      expected_note: "Routé vers Pierre — plan-only.",
      expected_blocked: false,
    },
    {
      id: "ex_absence",
      label: "Gérer une absence salarié",
      raw_text: "Gérer une absence salarié et préparer le suivi",
      expected_note: "Routé vers Pierre — validation humaine possible.",
      expected_blocked: false,
    },
    {
      id: "ex_prepayroll",
      label: "Préparer une synthèse pré-paie",
      raw_text: "Préparer une synthèse pré-paie pour validation",
      expected_note: "Routé vers Pierre — validation humaine requise (paie sensible).",
      expected_blocked: false,
    },
    {
      id: "ex_blocked",
      label: "Exécuter le licenciement d'un salarié",
      raw_text: "Exécuter le licenciement d'un salarié",
      expected_note: "Bloqué par CloneGuard — action finale, décision humaine exclusive.",
      expected_blocked: true,
    },
  ];
}

// ── Base response (invariants) ────────────────────────────────────────────────

function buildBaseResponse(): Omit<RuntimeIntegrationSimulationApiResponse, "ok" | "status"> {
  return {
    read_only: true,
    simulation_only: true,
    execution_enabled: false,
    db_write_performed: false,
    ai_call_performed: false,
    email_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
  };
}

export function buildRuntimeIntegrationSimulationApiResponse(
  result: RuntimeIntegrationReadResult
): RuntimeIntegrationSimulationApiResponse {
  return {
    ok: true,
    status: "ok",
    result,
    ...buildBaseResponse(),
  };
}

export function buildRuntimeIntegrationSimulationApiCapabilitiesResponse(): RuntimeIntegrationSimulationApiResponse {
  return {
    ok: true,
    status: "capabilities",
    capabilities: buildRuntimeIntegrationSimulationApiCapabilities(),
    examples: buildRuntimeIntegrationSimulationApiExamples(),
    ...buildBaseResponse(),
  };
}

export function buildRuntimeIntegrationSimulationApiError(
  error: RuntimeIntegrationSimulationApiError,
  status: RuntimeIntegrationSimulationApiStatus = "error"
): RuntimeIntegrationSimulationApiResponse {
  return {
    ok: false,
    status,
    error,
    ...buildBaseResponse(),
  };
}

// ── Validation / sanitization ─────────────────────────────────────────────────

export function validateRuntimeIntegrationSimulationApiRequest(
  body: unknown
): { valid: boolean; error?: RuntimeIntegrationSimulationApiError } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { valid: false, error: { code: "INVALID_BODY", message: "Corps de requête invalide — objet attendu." } };
  }
  const raw = (body as Record<string, unknown>).raw_text;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { valid: false, error: { code: "RAW_TEXT_REQUIRED", message: "raw_text requis." } };
  }
  return { valid: true };
}

export function sanitizeRuntimeIntegrationSimulationApiRequest(
  body: unknown
): RuntimeIntegrationSimulationApiRequest {
  const obj = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    raw_text: typeof obj.raw_text === "string" ? obj.raw_text.slice(0, 2000) : "",
    source: str(obj.source),
    locale: str(obj.locale),
    user_id: str(obj.user_id),
    company_id: str(obj.company_id),
    mode: "simulation",
    metadata: typeof obj.metadata === "object" && obj.metadata !== null ? (obj.metadata as Record<string, unknown>) : undefined,
  };
}
