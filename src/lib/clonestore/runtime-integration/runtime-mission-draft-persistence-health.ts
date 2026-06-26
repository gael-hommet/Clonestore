// src/lib/clonestore/runtime-integration/runtime-mission-draft-persistence-health.ts
// PHASE 4.4 — Runtime Mission Draft Persistence — Health / Readiness Design
//
// Module pur. Ne lit pas Supabase. N'exécute aucun SQL. Aucun write.

import type {
  RuntimeMissionDraftPersistenceReadiness,
} from "./runtime-mission-draft-persistence-types";
import { RUNTIME_MISSION_DRAFT_TABLE_NAME } from "./runtime-mission-draft-persistence-types";
import { getRuntimeMissionDraftServerPersistenceFlagState } from "./runtime-mission-draft-persistence-flags";

const TABLE = RUNTIME_MISSION_DRAFT_TABLE_NAME;

// ── Readiness ─────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftPersistenceReadiness(): RuntimeMissionDraftPersistenceReadiness {
  const flag = getRuntimeMissionDraftServerPersistenceFlagState();
  return {
    mode: "design_only",
    status: flag.enabled ? "awaiting_safe_apply" : "awaiting_flag",
    table_name: TABLE,
    table_status: "not_applied",
    policy_status: "select_insert_update_designed",
    health_status: "not_checked",
    feature_flag: flag,
    localstorage_first: true,
    scale_80k_not_proven: true,
    public_launch_external_validated: false,
    read_only: true,
  };
}

// ── Health checklist ──────────────────────────────────────────────────────────

export type RuntimeMissionDraftPersistenceHealthCheck = {
  id: string;
  label: string;
  expected: string;
};

export function buildRuntimeMissionDraftPersistenceHealthChecklist(): RuntimeMissionDraftPersistenceHealthCheck[] {
  return [
    { id: "table_exists", label: "Table existe", expected: `1 ligne table_name = '${TABLE}'.` },
    { id: "rls_enabled", label: "RLS activée", expected: "rowsecurity = true." },
    { id: "policies", label: "Policies select/insert/update", expected: "3 policies, aucune DELETE." },
    { id: "safety_constraints", label: "Contraintes safety_flags", expected: "CHECK no_execution présent." },
    { id: "indexes", label: "Index", expected: "user_id/company_id/draft_id/updated_at présents." },
  ];
}

// ── Expected SQL checks ───────────────────────────────────────────────────────

export type RuntimeMissionDraftPersistenceSqlCheck = {
  id: string;
  label: string;
  query: string;
};

export function buildRuntimeMissionDraftPersistenceExpectedSqlChecks(): RuntimeMissionDraftPersistenceSqlCheck[] {
  return [
    {
      id: "A_table_exists",
      label: "Table existe",
      query:
        "select table_name\n" +
        "from information_schema.tables\n" +
        "where table_schema = 'public'\n" +
        `and table_name = '${TABLE}';`,
    },
    {
      id: "B_rls_enabled",
      label: "RLS activée",
      query:
        "select tablename, rowsecurity\n" +
        "from pg_tables\n" +
        "where schemaname = 'public'\n" +
        `and tablename = '${TABLE}';`,
    },
    {
      id: "C_policies",
      label: "Policies",
      query:
        "select policyname, cmd\n" +
        "from pg_policies\n" +
        "where schemaname = 'public'\n" +
        `and tablename = '${TABLE}'\n` +
        "order by cmd, policyname;",
    },
    {
      id: "D_constraints",
      label: "Contraintes",
      query:
        "select conname\n" +
        "from pg_constraint\n" +
        `where conrelid = 'public.${TABLE}'::regclass\n` +
        "order by conname;",
    },
    {
      id: "E_indexes",
      label: "Index",
      query:
        "select indexname, indexdef\n" +
        "from pg_indexes\n" +
        "where schemaname = 'public'\n" +
        `and tablename = '${TABLE}'\n` +
        "order by indexname;",
    },
  ];
}

// ── Manual activation steps ───────────────────────────────────────────────────

export function buildRuntimeMissionDraftPersistenceManualActivationSteps(): string[] {
  return [
    "1. Ouvrir Supabase → SQL Editor.",
    "2. Coller supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql → Run.",
    "3. Lancer les requêtes SQL A→E pour vérifier table/RLS/policies/constraints/indexes.",
    "4. Ajouter NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED=true dans .env.local (PHASE 4.5).",
    "5. Implémenter le safe apply runtime (PHASE 4.5) — localStorage-first, rollbackable.",
    "6. Remplir l'evidence template.",
    "7. Note : lancement public externe non validé. scale 80k non prouvé.",
  ];
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimeMissionDraftPersistenceReadiness(): string {
  const r = buildRuntimeMissionDraftPersistenceReadiness();
  return [
    `[Persistence Readiness] mode=${r.mode} · status=${r.status}`,
    `  Table : ${r.table_name} (${r.table_status})`,
    `  Flag : ${r.feature_flag.flag_key} = ${r.feature_flag.enabled} (default false)`,
    `  localStorage-first : ${r.localstorage_first} · Scale 80k non prouvé.`,
    `  Design only — aucun SQL exécuté, aucun write. lancement public externe non validé.`,
  ].join("\n");
}
