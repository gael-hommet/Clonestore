// src/lib/clonestore/runtime-integration/runtime-controlled-mission-persistence-health.ts
// PHASE 4.10 — Controlled Mission Persistence — Health / Readiness Design
//
// Module pur. Ne lit pas Supabase. N'exécute aucun SQL. Aucun write.

import type { RuntimeControlledMissionPersistenceReadiness } from "./runtime-controlled-mission-persistence-types";
import { RUNTIME_CONTROLLED_MISSION_TABLE_NAME } from "./runtime-controlled-mission-persistence-types";
import { getRuntimeControlledMissionServerPersistenceFlagState } from "./runtime-controlled-mission-persistence-flags";

const TABLE = RUNTIME_CONTROLLED_MISSION_TABLE_NAME;

// ── Readiness ─────────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionPersistenceReadiness(): RuntimeControlledMissionPersistenceReadiness {
  const flag = getRuntimeControlledMissionServerPersistenceFlagState();
  return {
    mode: "design_only",
    status: flag.enabled ? "awaiting_safe_apply" : "awaiting_flag",
    table_name: TABLE,
    table_status: "not_applied",
    policy_status: "select_insert_update_designed",
    health_status: "not_checked",
    feature_flag: flag,
    localstorage_first: true,
    human_validation_required: true,
    promotion_applied: false,
    scale_80k_not_proven: true,
    public_launch_external_validated: false,
    read_only: true,
  };
}

// ── Health checklist ──────────────────────────────────────────────────────────

export type RuntimeControlledMissionPersistenceHealthCheck = {
  id: string;
  label: string;
  expected: string;
};

export function buildRuntimeControlledMissionPersistenceHealthChecklist(): RuntimeControlledMissionPersistenceHealthCheck[] {
  return [
    { id: "table_exists", label: "Table existe", expected: `1 ligne table_name = '${TABLE}'.` },
    { id: "rls_enabled", label: "RLS activée", expected: "rowsecurity = true." },
    { id: "policies", label: "Policies select/insert/update", expected: "3 policies, aucune DELETE." },
    { id: "governed_constraints", label: "Contraintes gouvernance", expected: "chk_..._governed + chk_..._no_execution présents." },
    { id: "indexes", label: "Index", expected: "user_id/company_id/candidate_id/promotion_id/updated_at présents." },
    { id: "safety_flags", label: "Safety flags", expected: "promotion_applied/execution_enabled... = false; human_validation_required = true." },
  ];
}

// ── Expected SQL checks ───────────────────────────────────────────────────────

export type RuntimeControlledMissionPersistenceSqlCheck = {
  id: string;
  label: string;
  query: string;
};

export function buildRuntimeControlledMissionPersistenceExpectedSqlChecks(): RuntimeControlledMissionPersistenceSqlCheck[] {
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
    {
      id: "F_safety_flags_sample",
      label: "Safety flags (échantillon)",
      query:
        "select candidate_id, promotion_id, draft_id,\n" +
        "  promotion_applied, controlled_mission_created, mission_created,\n" +
        "  execution_enabled, execution_started, human_validation_required,\n" +
        "  preview_only, read_only, safety_flags\n" +
        `from public.${TABLE}\n` +
        "order by updated_at desc\n" +
        "limit 5;",
    },
  ];
}

// ── Manual activation steps ───────────────────────────────────────────────────

export function buildRuntimeControlledMissionPersistenceManualActivationSteps(): string[] {
  return [
    "1. Ouvrir Supabase → SQL Editor.",
    "2. Coller supabase/sql/PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql → Run.",
    "3. Lancer les requêtes SQL A→F pour vérifier table/RLS/policies/constraints/indexes/safety flags.",
    "4. Concevoir le workflow de validation humaine (PHASE 4.11).",
    "5. Concevoir/implémenter le safe apply localStorage-first gouverné (PHASE 4.11+).",
    "6. Ajouter NEXT_PUBLIC_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED=true dans .env.local.",
    "7. Remplir l'evidence template.",
    "8. Note : lancement public externe non validé. scale 80k non prouvé.",
  ];
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimeControlledMissionPersistenceReadiness(): string {
  const r = buildRuntimeControlledMissionPersistenceReadiness();
  return [
    `[Controlled Mission Persistence Readiness] mode=${r.mode} · status=${r.status}`,
    `  Table : ${r.table_name} (${r.table_status})`,
    `  Flag : ${r.feature_flag.flag_key} = ${r.feature_flag.enabled} (default false)`,
    `  localStorage-first : ${r.localstorage_first} · human_validation_required : ${r.human_validation_required}`,
    `  promotion_applied : ${r.promotion_applied} · Scale 80k non prouvé.`,
    `  Design only — aucun SQL exécuté, aucun write. lancement public externe non validé.`,
  ].join("\n");
}
