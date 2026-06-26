// src/lib/clonestore/onboarding/global-onboarding-schema.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Schéma
//
// Décrit le schéma cible de la table clonestore_global_onboarding_drafts.
// IMPORTANT : DRAFT — NON appliqué automatiquement.
//   SQL : supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql
//   Activation : PHASE 3.6 après migration manuelle + validation RLS.

import { GLOBAL_ONBOARDING_TABLE_NAME } from "./global-onboarding-types";

// ── Schéma TypeScript ─────────────────────────────────────────────────────────

export const GLOBAL_ONBOARDING_SCHEMA = {
  tableName: GLOBAL_ONBOARDING_TABLE_NAME,
  schema: "public",
  fullTableName: `public.${GLOBAL_ONBOARDING_TABLE_NAME}`,

  columns: {
    id:                   "uuid",
    user_id:              "uuid",
    company_id:           "text",
    status:               "text",
    current_step:         "text",
    completion_score:     "integer",
    company_json:         "jsonb",
    humans_json:          "jsonb",
    documents_json:       "jsonb",
    rules_json:           "jsonb",
    technologies_json:    "jsonb",
    first_mission_json:   "jsonb",
    cloneadn_preview_json:"jsonb",
    metadata:             "jsonb",
    created_at:           "timestamptz",
    updated_at:           "timestamptz",
  },

  constraints: {
    primaryKey: "id",
    unique: ["user_id", "company_id"],
    notNull: ["user_id", "company_id", "status", "current_step"],
    defaults: {
      status: "server_draft",
      completion_score: 0,
      company_json: "{}",
      humans_json: "[]",
      documents_json: "[]",
      rules_json: "[]",
      technologies_json: "[]",
      first_mission_json: "{}",
      cloneadn_preview_json: "{}",
      metadata: "{}",
    },
    checks: {
      completion_score_range: "completion_score between 0 and 100",
      status_valid: "status in ('local_draft','server_draft','completed','archived')",
      company_id_not_empty: "length(trim(company_id)) > 0",
    },
  },

  rls: {
    enabled: true,
    policies: {
      select: "auth.uid() = user_id",
      insert: "auth.uid() = user_id",
      update: "auth.uid() = user_id",
      // delete: disabled — pas de suppression des drafts
    },
  },

  indexes: [
    { name: "idx_global_onboarding_user_created", cols: ["user_id", "created_at DESC"] },
    { name: "idx_global_onboarding_user_company",  cols: ["user_id", "company_id"] },
    { name: "idx_global_onboarding_user_status",   cols: ["user_id", "status"] },
  ],

  persistenceState: {
    schemaDesigned:    true,
    migrationDraftExists: true,  // supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql
    migrationApplied:  false,    // PAS appliqué — PHASE 3.6
    rlsDesigned:       true,
    rlsApplied:        false,    // PAS appliqué — PHASE 3.6
    uiWriteEnabled:    false,    // Désactivé — PHASE 3.6
  },
} as const;

export const GLOBAL_ONBOARDING_SQL_DRAFT_PATH =
  "supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql";

export const GLOBAL_ONBOARDING_SCHEMA_NOTE =
  "Table clonestore_global_onboarding_drafts — DRAFT. Non appliqué. " +
  "Activer en PHASE 3.6 après migration manuelle et validation RLS.";
