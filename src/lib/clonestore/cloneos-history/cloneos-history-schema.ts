// src/lib/clonestore/cloneos-history/cloneos-history-schema.ts
// PHASE 3.2 — CloneOS History Server Persistence Design — Schéma
//
// Décrit le schéma cible de la table clonestore_cloneos_history.
// IMPORTANT : Ce schéma est un DRAFT.
//   - La migration N'EST PAS appliquée automatiquement.
//   - Le SQL est dans supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql
//   - L'activation de la table est prévue en PHASE 3.3.
//   - Ne pas modifier la RLS existante avec ce fichier.
//
// Invariants :
//   - user_id obligatoire
//   - company_id obligatoire
//   - command_id unique par user
//   - raw_request_summary ≤ 280 chars
//   - pas de raw_request complet
//   - RLS user_id = auth.uid() pour select/insert
//   - pas de delete policy (audit trail)

import { CLONEOS_HISTORY_TABLE_NAME } from "./cloneos-history-types";

// ── Référence table ───────────────────────────────────────────────────────────

export const CLONEOS_HISTORY_SCHEMA = {
  tableName: CLONEOS_HISTORY_TABLE_NAME,
  schema: "public",
  fullTableName: `public.${CLONEOS_HISTORY_TABLE_NAME}`,

  // Colonnes
  columns: {
    id:                        "uuid",
    user_id:                   "uuid",
    company_id:                "text",
    command_id:                "text",
    employee_slug:             "text",
    domain:                    "text",
    intent:                    "text",
    status:                    "text",
    risk_level:                "text",
    raw_request_summary:       "text",
    mission_title:             "text",
    mission_summary:           "text",
    task_count:                "integer",
    guard_decision:            "text",
    human_validation_required: "boolean",
    blocked:                   "boolean",
    refused:                   "boolean",
    trace_event_count:         "integer",
    next_action:               "text",
    metadata:                  "jsonb",
    created_at:                "timestamptz",
    updated_at:                "timestamptz",
  },

  // Contraintes
  constraints: {
    primaryKey:    "id",
    unique:        ["user_id", "command_id"],
    notNull:       ["user_id", "company_id", "command_id", "domain", "intent", "status", "risk_level", "raw_request_summary"],
    defaults: {
      task_count:                0,
      trace_event_count:         0,
      human_validation_required: false,
      blocked:                   false,
      refused:                   false,
      metadata:                  "{}",
    },
    checks: {
      raw_request_summary_length: "length(raw_request_summary) between 1 and 500",
      status_valid: "status in ('received','classified','routed','planned','guarded','trace_ready','ready_for_execution','requires_validation','blocked','refused','failed','unknown')",
      risk_level_valid: "risk_level in ('low','medium','high','critical')",
    },
  },

  // RLS (politiques Row Level Security)
  rls: {
    enabled: true,
    policies: {
      select: "auth.uid() = user_id",
      insert: "auth.uid() = user_id",
      // update: disabled in v1 (immutable audit trail)
      // delete: disabled (audit trail — jamais supprimé)
    },
  },

  // Indexes recommandés
  indexes: [
    { name: "idx_cloneos_history_user_created", cols: ["user_id", "created_at DESC"] },
    { name: "idx_cloneos_history_user_company",  cols: ["user_id", "company_id"] },
    { name: "idx_cloneos_history_user_status",   cols: ["user_id", "status"] },
    { name: "idx_cloneos_history_user_risk",     cols: ["user_id", "risk_level"] },
    { name: "idx_cloneos_history_command_id",    cols: ["command_id"] },
  ],

  // État actuel
  persistenceState: {
    schemaDesigned: true,
    migrationDraftExists: true,      // supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql
    migrationApplied: false,         // PAS appliqué — PHASE 3.3
    rlsDesigned: true,
    rlsApplied: false,               // PAS appliqué — PHASE 3.3
    uiWriteEnabled: false,           // Désactivé — PHASE 3.3
  },
} as const;

// ── Chemin SQL draft ──────────────────────────────────────────────────────────

export const CLONEOS_HISTORY_SQL_DRAFT_PATH =
  "supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql";

export const CLONEOS_HISTORY_SCHEMA_NOTE =
  "Table clonestore_cloneos_history — DRAFT. Non appliqué. " +
  "Activer en PHASE 3.3 après migration manuelle et validation RLS.";
