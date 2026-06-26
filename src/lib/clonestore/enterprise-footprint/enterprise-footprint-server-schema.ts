// src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-schema.ts
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Schema Helpers
//
// Centralize table name, expected columns, RLS policy names.
// Ne contient pas de client Supabase — pure constantes/helpers.

// ── Nom de la table ───────────────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_SERVER_TABLE =
  "clonestore_enterprise_footprints" as const;

// ── Colonnes attendues ────────────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_SERVER_COLUMNS = [
  "id",
  "user_id",
  "company_id",
  "status",
  "source",
  "company_json",
  "humans_json",
  "approval_rules_json",
  "documents_json",
  "technologies_json",
  "cloneadn_summary_json",
  "coverage_score",
  "readiness_score",
  "missing_items_json",
  "warnings_json",
  "metadata",
  "last_local_updated_at",
  "server_version",
  "created_at",
  "updated_at",
] as const;

export type EnterpriseFootprintServerColumnName =
  (typeof ENTERPRISE_FOOTPRINT_SERVER_COLUMNS)[number];

// ── Noms des politiques RLS ───────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_SERVER_RLS_POLICIES = {
  select: "select_own_enterprise_footprint",
  insert: "insert_own_enterprise_footprint",
  update: "update_own_enterprise_footprint",
  // Pas de delete policy intentionnel
} as const;

// ── Noms des contraintes ──────────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_SERVER_CONSTRAINTS = {
  unique_user_company: "uq_enterprise_footprint_user_company",
  score_coverage: "chk_enterprise_footprint_coverage_score",
  score_readiness: "chk_enterprise_footprint_readiness_score",
  status_valid: "chk_enterprise_footprint_status_valid",
  source_valid: "chk_enterprise_footprint_source_valid",
  company_id_not_empty: "chk_enterprise_footprint_company_id_not_empty",
} as const;

// ── Noms des index ────────────────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_SERVER_INDEXES = {
  user_company: "idx_enterprise_footprint_user_company",
  user_updated: "idx_enterprise_footprint_user_updated",
  user_status: "idx_enterprise_footprint_user_status",
  user_readiness: "idx_enterprise_footprint_user_readiness",
} as const;

// ── Valeurs autorisées ────────────────────────────────────────────────────────

export const ENTERPRISE_FOOTPRINT_SERVER_VALID_STATUSES = [
  "draft",
  "ready",
  "incomplete",
  "needs_review",
  "archived",
] as const;

export const ENTERPRISE_FOOTPRINT_SERVER_VALID_SOURCES = [
  "local_snapshot",
  "onboarding_draft",
  "server",
  "cloneadn",
  "demo",
] as const;

// ── Builders ──────────────────────────────────────────────────────────────────

/** Retourne la liste des colonnes attendues. */
export function buildEnterpriseFootprintServerExpectedColumns(): string[] {
  return [...ENTERPRISE_FOOTPRINT_SERVER_COLUMNS];
}

/** Retourne les noms des politiques RLS attendues. */
export function buildEnterpriseFootprintServerRlsPolicyNames(): string[] {
  return Object.values(ENTERPRISE_FOOTPRINT_SERVER_RLS_POLICIES);
}

/** Explication lisible du schéma. */
export function explainEnterpriseFootprintServerSchema(): string {
  return [
    `Table: ${ENTERPRISE_FOOTPRINT_SERVER_TABLE}`,
    `Colonnes: ${ENTERPRISE_FOOTPRINT_SERVER_COLUMNS.length}`,
    `RLS policies: ${Object.keys(ENTERPRISE_FOOTPRINT_SERVER_RLS_POLICIES).join(", ")}`,
    `Index: ${Object.keys(ENTERPRISE_FOOTPRINT_SERVER_INDEXES).join(", ")}`,
    "Note: SQL draft à appliquer manuellement. Jamais d'application automatique.",
  ].join("\n");
}
