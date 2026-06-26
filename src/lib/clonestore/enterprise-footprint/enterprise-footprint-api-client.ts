// src/lib/clonestore/enterprise-footprint/enterprise-footprint-api-client.ts
// PHASE 3.14 — Enterprise Footprint Safe Apply — Client API Wrapper
//
// Wrapper fetch côté client pour la route /api/profile/enterprise-footprint.
//
// INVARIANTS :
//   - ne jamais appeler si feature flag false
//   - pas de throw brut
//   - pas d'import Pierre
//   - pas de service role
//   - POST uniquement depuis /profile/onboarding via safe runtime
//   - ne pas appeler depuis /agents/pierre/**

import type { EnterpriseFootprint } from "./enterprise-footprint-types";
import { isEnterpriseFootprintServerPersistenceEnabled } from "./enterprise-footprint-server-flags";

const ROUTE_URL = "/api/profile/enterprise-footprint";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnterpriseFootprintApiGetResponse = {
  ok: boolean;
  footprint: EnterpriseFootprint | null;
  source: "server" | "none";
  server_available: boolean;
  fallback_reason: string | null;
  updated_at: string | null;
};

export type EnterpriseFootprintApiPostResponse = {
  ok: boolean;
  row_id: string | null;
  server_version: number | null;
  persisted: boolean;
  error: string | null;
  persistence_disabled?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isEnterpriseFootprintApiAvailableResponse(
  response: unknown
): response is { ok: boolean } {
  return (
    typeof response === "object" &&
    response !== null &&
    "ok" in response
  );
}

export function normalizeEnterpriseFootprintApiError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    return (error as Record<string, unknown>).message as string;
  }
  return "Erreur API enterprise-footprint inconnue.";
}

// ── GET — Charger depuis le serveur ──────────────────────────────────────────

export async function fetchEnterpriseFootprintServerSnapshot(): Promise<EnterpriseFootprintApiGetResponse> {
  try {
    const res = await fetch(ROUTE_URL, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        footprint: null,
        source: "none",
        server_available: false,
        fallback_reason: `http_${res.status}`,
        updated_at: null,
      };
    }

    const data = await res.json() as EnterpriseFootprintApiGetResponse;
    return data;
  } catch {
    return {
      ok: false,
      footprint: null,
      source: "none",
      server_available: false,
      fallback_reason: "fetch_error",
      updated_at: null,
    };
  }
}

// ── POST — Persister vers le serveur ─────────────────────────────────────────

export async function postEnterpriseFootprintServerSnapshot(
  footprint: EnterpriseFootprint
): Promise<EnterpriseFootprintApiPostResponse> {
  // Guard feature flag côté client
  if (!isEnterpriseFootprintServerPersistenceEnabled()) {
    return {
      ok: false,
      row_id: null,
      server_version: null,
      persisted: false,
      error: "Persistence serveur désactivée.",
      persistence_disabled: true,
    };
  }

  try {
    const res = await fetch(ROUTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ footprint }),
      cache: "no-store",
    });

    const data = await res.json() as EnterpriseFootprintApiPostResponse & Record<string, unknown>;
    return {
      ok: res.ok && data.ok,
      row_id: data.row_id ?? null,
      server_version: data.server_version ?? null,
      persisted: data.persisted ?? false,
      error: !res.ok ? (typeof data.error === "string" ? data.error : `http_${res.status}`) : null,
      persistence_disabled: typeof data.persistence_disabled === "boolean" ? data.persistence_disabled : undefined,
    };
  } catch {
    return {
      ok: false,
      row_id: null,
      server_version: null,
      persisted: false,
      error: "Erreur réseau API enterprise-footprint.",
    };
  }
}
