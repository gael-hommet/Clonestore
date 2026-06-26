// src/lib/clonestore/runtime-integration/runtime-integration-api-client.ts
// PHASE 4.2 — Runtime API Simulation — Client Wrapper
//
// SEUL endroit autorisé à faire fetch — et UNIQUEMENT vers l'endpoint de simulation.
// POST simulation-only. Aucun write direct. Aucun enterprise-footprint POST.
// Aucune route Pierre. Aucun Supabase. Aucun secret. Aucun auto-call à l'import.

import { RUNTIME_INTEGRATION_SIMULATE_ENDPOINT } from "./runtime-integration-api-contract";
import type {
  RuntimeIntegrationSimulationApiRequest,
  RuntimeIntegrationSimulationApiResponse,
  RuntimeIntegrationSimulationApiError,
} from "./runtime-integration-api-contract";

// ── Type guard ────────────────────────────────────────────────────────────────

export function isRuntimeIntegrationSimulationApiResponse(
  value: unknown
): value is RuntimeIntegrationSimulationApiResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ok === "boolean" &&
    typeof v.status === "string" &&
    v.simulation_only === true &&
    v.execution_enabled === false
  );
}

// ── Error normalization ───────────────────────────────────────────────────────

export function normalizeRuntimeIntegrationSimulationApiError(
  error: unknown
): RuntimeIntegrationSimulationApiError {
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.code === "string" && typeof e.message === "string") {
      return { code: e.code, message: e.message };
    }
    if (typeof e.message === "string") {
      return { code: "CLIENT_ERROR", message: e.message };
    }
  }
  if (error instanceof Error) {
    return { code: "CLIENT_ERROR", message: error.message };
  }
  return { code: "UNKNOWN_ERROR", message: "Erreur inconnue lors de la simulation." };
}

// ── GET capabilities ──────────────────────────────────────────────────────────

export async function fetchRuntimeIntegrationSimulationCapabilities(): Promise<RuntimeIntegrationSimulationApiResponse> {
  const res = await fetch(RUNTIME_INTEGRATION_SIMULATE_ENDPOINT, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const data: unknown = await res.json();
  if (!isRuntimeIntegrationSimulationApiResponse(data)) {
    throw normalizeRuntimeIntegrationSimulationApiError({
      code: "INVALID_RESPONSE",
      message: "Réponse capabilities invalide.",
    });
  }
  return data;
}

// ── POST simulation-only ──────────────────────────────────────────────────────

export async function postRuntimeIntegrationSimulation(
  request: RuntimeIntegrationSimulationApiRequest
): Promise<RuntimeIntegrationSimulationApiResponse> {
  // POST simulation-only — aucun write, aucune mission créée, aucun effet de bord.
  const res = await fetch(RUNTIME_INTEGRATION_SIMULATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, mode: "simulation" }),
  });
  const data: unknown = await res.json();
  if (!isRuntimeIntegrationSimulationApiResponse(data)) {
    throw normalizeRuntimeIntegrationSimulationApiError({
      code: "INVALID_RESPONSE",
      message: "Réponse de simulation invalide.",
    });
  }
  return data;
}
