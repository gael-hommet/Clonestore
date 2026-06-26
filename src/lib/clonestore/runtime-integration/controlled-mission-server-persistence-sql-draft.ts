// src/lib/clonestore/runtime-integration/controlled-mission-server-persistence-sql-draft.ts
// PHASE 5.4 — Controlled Mission Governed Server Persistence — SQL / RLS Draft
//
// DESIGN-ONLY. Génère le DRAFT SQL de la table de persistance serveur gouvernée
// des Controlled Missions (origine localStorage). NON appliqué. Aucune écriture.
// Aucun appel réseau. Aucune route. Le flag serveur reste OFF (default false).

import type {
  GovernedControlledMissionServerPersistenceSqlDraft,
  GovernedControlledMissionServerPersistenceRlsPolicyDraft,
} from "./controlled-mission-server-persistence-types";

export const CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME =
  "clonestore_controlled_missions" as const;

export const CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_FILE =
  "supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql" as const;

export const CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_MARKERS = [
  "DESIGN DRAFT ONLY",
  "DO NOT APPLY",
  "STILL NO EXECUTION",
  "SERVER PERSISTENCE FLAG MUST REMAIN OFF",
] as const;

// Le DDL est authoré ici ET recopié dans le fichier supabase/sql/ (identique).
const SQL_DRAFT = `-- =========================================================
-- PHASE 5.4 — Controlled Mission Governed Server Persistence Draft
-- Table : public.clonestore_controlled_missions
--
-- DESIGN DRAFT ONLY
-- DO NOT APPLY AUTOMATICALLY
-- STILL NO EXECUTION
-- SERVER PERSISTENCE FLAG MUST REMAIN OFF
--
-- Origine : Controlled Mission LOCALE (P5.1) revue (P5.2) + preflight (P5.3).
-- Un enregistrement n'est JAMAIS une mission réelle ni une exécution.
-- localStorage reste la seule source active. Activation manuelle future (P5.5+).
--
-- Invariants :
--   - user_id = auth.uid() obligatoire (RLS)
--   - multi-tenant strict par user_id (+ company_id)
--   - jamais de policy DELETE (préservation / audit)
--   - execution_enabled / runtime_execution_enabled / pierre_engine_enabled
--     / ai_execution_enabled / email_sending_enabled / document_generation_enabled
--     / clonevoice_enabled toujours false (CHECK)
--   - runtime_status = 'disabled'
--   - local_origin true
--   - aucun service role côté client
--   - scale 80k non prouvé · lancement public externe non validé
-- =========================================================

create table if not exists public.clonestore_controlled_missions (
  id                            uuid        primary key default gen_random_uuid(),
  user_id                       uuid        not null references auth.users(id) on delete cascade,
  company_id                    text        null,
  tenant_id                     text        not null,
  local_controlled_mission_id   text        not null,
  source_draft_id               text        null,
  source_promotion_id           text        null,
  employee_id                   text        null,
  title                         text        not null,
  summary                       text        null,
  intent                        text        null,
  category                      text        null,
  priority                      text        null,
  risk_level                    text        null,
  local_review_status           text        null,
  preflight_status              text        null,
  readiness_score               integer     not null default 0,
  readiness_level               text        null,
  server_persistence_status     text        not null default 'server_draft_only',
  execution_status              text        not null default 'not_executable',
  runtime_status                text        not null default 'disabled',
  governance_status             text        not null default 'requires_human_governance',
  guard_snapshot                jsonb       not null default '{}'::jsonb,
  review_snapshot               jsonb       not null default '{}'::jsonb,
  preflight_snapshot            jsonb       not null default '{}'::jsonb,
  runtime_requirements_snapshot jsonb       not null default '{}'::jsonb,
  human_validation_snapshot     jsonb       not null default '{}'::jsonb,
  trace_snapshot                jsonb       not null default '{}'::jsonb,
  local_origin                  boolean     not null default true,
  execution_enabled             boolean     not null default false,
  runtime_execution_enabled     boolean     not null default false,
  pierre_engine_enabled         boolean     not null default false,
  ai_execution_enabled          boolean     not null default false,
  email_sending_enabled         boolean     not null default false,
  document_generation_enabled   boolean     not null default false,
  clonevoice_enabled            boolean     not null default false,
  created_by                    uuid        null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- ── Unicité (user_id, local_controlled_mission_id) ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_controlled_missions_user_local_id'
      AND conrelid = 'public.clonestore_controlled_missions'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_missions
      ADD CONSTRAINT uq_controlled_missions_user_local_id
      UNIQUE (user_id, local_controlled_mission_id);
  END IF;
END $$;

-- ── Statuts autorisés ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_controlled_missions_server_status_valid'
      AND conrelid = 'public.clonestore_controlled_missions'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_missions
      ADD CONSTRAINT chk_controlled_missions_server_status_valid
      CHECK (server_persistence_status IN (
        'design_only', 'blocked_flag_disabled', 'ready_for_manual_sql_review',
        'ready_for_future_server_persistence', 'blocked_missing_preflight',
        'blocked_missing_review', 'blocked_by_guard', 'blocked_by_manual_decision',
        'server_draft_only'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_controlled_missions_execution_status_valid'
      AND conrelid = 'public.clonestore_controlled_missions'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_missions
      ADD CONSTRAINT chk_controlled_missions_execution_status_valid
      CHECK (execution_status IN (
        'not_executable', 'server_draft_only', 'waiting_future_governed_execution_phase'
      ));
  END IF;
END $$;

-- ── Gouvernance : JAMAIS exécutable / runtime désactivé ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_controlled_missions_no_execution'
      AND conrelid = 'public.clonestore_controlled_missions'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_missions
      ADD CONSTRAINT chk_controlled_missions_no_execution
      CHECK (
        execution_enabled = false
        AND runtime_execution_enabled = false
        AND pierre_engine_enabled = false
        AND ai_execution_enabled = false
        AND email_sending_enabled = false
        AND document_generation_enabled = false
        AND clonevoice_enabled = false
        AND runtime_status = 'disabled'
        AND local_origin = true
      );
  END IF;
END $$;

-- ── Index ─────────────────────────────────────────────────────────────────────
create index if not exists idx_controlled_missions_user_id
  on public.clonestore_controlled_missions (user_id);
create index if not exists idx_controlled_missions_company_id
  on public.clonestore_controlled_missions (company_id);
create index if not exists idx_controlled_missions_local_id
  on public.clonestore_controlled_missions (local_controlled_mission_id);
create index if not exists idx_controlled_missions_status
  on public.clonestore_controlled_missions (user_id, server_persistence_status);
create index if not exists idx_controlled_missions_updated_at
  on public.clonestore_controlled_missions (user_id, updated_at desc);

-- ── Trigger updated_at ────────────────────────────────────────────────────────
create or replace function public.clonestore_controlled_missions_set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists trg_clonestore_controlled_missions_updated_at
  on public.clonestore_controlled_missions;

create trigger trg_clonestore_controlled_missions_updated_at
  before update on public.clonestore_controlled_missions
  for each row
  execute function public.clonestore_controlled_missions_set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.clonestore_controlled_missions
  enable row level security;

-- SELECT — lecture de ses propres lignes uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clonestore_controlled_missions'
      AND policyname = 'select_own_controlled_mission'
  ) THEN
    CREATE POLICY "select_own_controlled_mission"
      ON public.clonestore_controlled_missions
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- INSERT — uniquement ses propres lignes (route serveur future, flag OFF requis)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clonestore_controlled_missions'
      AND policyname = 'insert_own_controlled_mission'
  ) THEN
    CREATE POLICY "insert_own_controlled_mission"
      ON public.clonestore_controlled_missions
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- UPDATE — uniquement ses propres lignes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clonestore_controlled_missions'
      AND policyname = 'update_own_controlled_mission'
  ) THEN
    CREATE POLICY "update_own_controlled_mission"
      ON public.clonestore_controlled_missions
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Pas de policy DELETE intentionnel — préservation / audit.

comment on table public.clonestore_controlled_missions is
  'Controlled Missions (origine localStorage) — DRAFT non appliqué (PHASE 5.4). '
  'execution_enabled / runtime_execution_enabled / pierre_engine_enabled / '
  'ai_execution_enabled / email_sending_enabled / document_generation_enabled / '
  'clonevoice_enabled toujours false. runtime_status disabled. local_origin true. '
  'Aucune mission réelle. Aucune exécution. localStorage reste la source active. '
  'SERVER PERSISTENCE FLAG MUST REMAIN OFF. lancement public externe non validé.';

-- ── Notes d'activation ────────────────────────────────────────────────────────
-- Appliquer MANUELLEMENT via dashboard/CLI. Aucune application automatique.
-- Aucun .env.local modifié. Flag NEXT_PUBLIC_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED
-- reste false. STILL NO EXECUTION.
`;

export function buildControlledMissionServerPersistenceSqlDraft(): GovernedControlledMissionServerPersistenceSqlDraft {
  return {
    table_name: CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
    file_path: CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_FILE,
    applied: false,
    do_not_apply: true,
    markers: [...CONTROLLED_MISSION_SERVER_PERSISTENCE_SQL_MARKERS],
    sql: SQL_DRAFT,
  };
}

export function buildControlledMissionServerPersistenceRlsPolicyDraft(): GovernedControlledMissionServerPersistenceRlsPolicyDraft {
  return {
    table_name: CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
    rls_enabled: true,
    policies: [
      "select_own_controlled_mission — SELECT WHERE auth.uid() = user_id",
      "insert_own_controlled_mission — INSERT WITH CHECK auth.uid() = user_id (route serveur future, flag OFF)",
      "update_own_controlled_mission — UPDATE WHERE auth.uid() = user_id",
    ],
    delete_policy: "none_by_design",
    service_role_required: false,
    notes: [
      "Revue manuelle requise avant toute application.",
      "Aucune route serveur active dans cette phase.",
      "Flag serveur default false — persistance non activée.",
      "Aucun service role côté application. lancement public externe non validé.",
    ],
  };
}
