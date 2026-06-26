// src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-mappers.ts
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Mappers
//
// Conversions EnterpriseFootprint ↔ Row serveur.
// Helpers de merge local ↔ serveur.
//
// INVARIANTS :
//   - pas d'import Supabase client
//   - pas de write
//   - pas de service role
//   - jamais de throw brut
//   - scores clampés 0–100
//   - metadata redactée

import type { EnterpriseFootprint } from "./enterprise-footprint-types";
import type {
  EnterpriseFootprintServerRow,
  EnterpriseFootprintServerPayload,
  EnterpriseFootprintServerSyncPlan,
  EnterpriseFootprintServerConflictResolution,
} from "./enterprise-footprint-server-types";
import { ENTERPRISE_FOOTPRINT_SERVER_TABLE } from "./enterprise-footprint-server-schema";

// ── Clés sensibles à redacter ─────────────────────────────────────────────────

const REDACT_KEYS = [
  "password", "token", "secret", "api_key", "authorization",
  "access_token", "refresh_token", "private_key",
] as const;

// ── Redaction metadata ────────────────────────────────────────────────────────

export function redactEnterpriseFootprintServerMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (REDACT_KEYS.some((k) => key.toLowerCase().includes(k))) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// ── EnterpriseFootprint → Payload ─────────────────────────────────────────────

export function mapEnterpriseFootprintToServerPayload(
  footprint: EnterpriseFootprint,
  userId: string
): EnterpriseFootprintServerPayload {
  return {
    user_id: userId,
    company_id: footprint.company_id || footprint.company?.company_name?.toLowerCase().replace(/\s+/g, "_") || "unknown",
    footprint,
    source: "local_snapshot",
    local_updated_at: footprint.updated_at ?? new Date().toISOString(),
    metadata: redactEnterpriseFootprintServerMetadata(
      (footprint.metadata as Record<string, unknown>) ?? {}
    ),
  };
}

// ── Payload → Row insert ──────────────────────────────────────────────────────

export function mapEnterpriseFootprintToServerRowInsert(
  payload: EnterpriseFootprintServerPayload
): Omit<EnterpriseFootprintServerRow, "id" | "created_at" | "server_version"> & { updated_at: string } {
  const fp = payload.footprint;
  const coverageScore = Math.max(0, Math.min(100, fp.coverage_score ?? 0));
  const readinessScore = Math.max(0, Math.min(100,
    typeof fp.readiness_score === "number"
      ? fp.readiness_score
      : (fp.readiness_score as { score?: number })?.score ?? 0
  ));

  return {
    user_id: payload.user_id,
    company_id: payload.company_id,
    status: (fp.status as EnterpriseFootprintServerRow["status"]) ?? "draft",
    source: payload.source,
    company_json: (fp.company as Record<string, unknown>) ?? {},
    humans_json: fp.humans ?? [],
    approval_rules_json: fp.approval_rules ?? [],
    documents_json: fp.documents ?? [],
    technologies_json: fp.technologies ?? [],
    cloneadn_summary_json: (fp.cloneadn_summary as Record<string, unknown>) ?? {},
    coverage_score: coverageScore,
    readiness_score: readinessScore,
    missing_items_json: fp.missing_items ?? [],
    warnings_json: fp.warnings ?? [],
    metadata: redactEnterpriseFootprintServerMetadata(payload.metadata ?? {}),
    last_local_updated_at: payload.local_updated_at,
    updated_at: new Date().toISOString(),
  };
}

// ── Row → EnterpriseFootprint ─────────────────────────────────────────────────

export function mapEnterpriseFootprintServerRowToFootprint(
  row: EnterpriseFootprintServerRow
): EnterpriseFootprint {
  return {
    id: row.id,
    company_id: row.company_id,
    status: row.status as EnterpriseFootprint["status"],
    source: "onboarding_server",
    company: row.company_json as EnterpriseFootprint["company"],
    humans: row.humans_json as EnterpriseFootprint["humans"],
    approval_rules: row.approval_rules_json as EnterpriseFootprint["approval_rules"],
    documents: row.documents_json as EnterpriseFootprint["documents"],
    technologies: row.technologies_json as EnterpriseFootprint["technologies"],
    cloneadn_summary: row.cloneadn_summary_json as EnterpriseFootprint["cloneadn_summary"],
    coverage_score: row.coverage_score,
    readiness_score: { score: row.readiness_score } as EnterpriseFootprint["readiness_score"],
    missing_items: row.missing_items_json,
    warnings: row.warnings_json,
    metadata: row.metadata as EnterpriseFootprint["metadata"],
    read_only: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Merge local ↔ server ──────────────────────────────────────────────────────

/** Choisit l'Empreinte la plus récente entre local et serveur. */
export function chooseLatestEnterpriseFootprint(
  local: EnterpriseFootprint | null,
  server: EnterpriseFootprintServerRow | null
): { winner: "local" | "server" | "none"; resolution: EnterpriseFootprintServerConflictResolution } {
  if (!local && !server) return { winner: "none", resolution: "no_conflict" };
  if (!local) return { winner: "server", resolution: "server_wins" };
  if (!server) return { winner: "local", resolution: "local_wins" };

  const localDate = local.updated_at ? new Date(local.updated_at).getTime() : 0;
  const serverDate = server.updated_at ? new Date(server.updated_at).getTime() : 0;

  if (localDate >= serverDate) {
    return { winner: "local", resolution: "local_wins" };
  }
  return { winner: "server", resolution: "server_wins" };
}

/** Merge les deux versions (local prioritaire si plus récent). */
export function mergeEnterpriseFootprintLocalAndServer(
  local: EnterpriseFootprint | null,
  server: EnterpriseFootprintServerRow | null
): EnterpriseFootprint | null {
  const { winner } = chooseLatestEnterpriseFootprint(local, server);

  if (winner === "local") return local;
  if (winner === "server" && server) return mapEnterpriseFootprintServerRowToFootprint(server);
  if (winner === "none") return null;
  return local;
}

/** Construit un plan de synchronisation. */
export function buildEnterpriseFootprintServerSyncPlan(
  local: EnterpriseFootprint | null,
  server: EnterpriseFootprintServerRow | null
): EnterpriseFootprintServerSyncPlan {
  if (!local && !server) {
    return {
      direction: "no_sync_needed",
      local_updated_at: null,
      server_updated_at: null,
      local_version: null,
      server_version: null,
      recommended_action: "Aucune empreinte disponible.",
      safe_to_proceed: false,
    };
  }

  if (!server) {
    return {
      direction: "local_to_server",
      local_updated_at: local?.updated_at ?? null,
      server_updated_at: null,
      local_version: 1,
      server_version: null,
      recommended_action: "Persister le snapshot local vers le serveur.",
      safe_to_proceed: true,
    };
  }

  if (!local) {
    return {
      direction: "server_to_local",
      local_updated_at: null,
      server_updated_at: server.updated_at,
      local_version: null,
      server_version: server.server_version,
      recommended_action: "Restaurer depuis le serveur vers localStorage.",
      safe_to_proceed: true,
    };
  }

  const { winner } = chooseLatestEnterpriseFootprint(local, server);
  return {
    direction: winner === "local" ? "local_to_server" : "server_to_local",
    local_updated_at: local.updated_at ?? null,
    server_updated_at: server.updated_at,
    local_version: 1,
    server_version: server.server_version,
    recommended_action: winner === "local"
      ? "Mettre à jour le serveur avec le snapshot local (plus récent)."
      : "Mettre à jour localStorage avec la version serveur (plus récente).",
    safe_to_proceed: true,
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Vérifie qu'un payload contient la table name attendue (aide debug). */
export function getExpectedServerTable(): string {
  return ENTERPRISE_FOOTPRINT_SERVER_TABLE;
}
