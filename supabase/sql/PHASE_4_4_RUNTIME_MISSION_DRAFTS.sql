-- =========================================================
-- PHASE 4.4 — Runtime Mission Draft Safe Persistence Design
-- Table : public.clonestore_runtime_mission_drafts
--
-- IMPORTANT : Ce fichier est un DRAFT — NON appliqué automatiquement.
-- Activer manuellement en PHASE 4.5 après :
--   1. Vérification du schéma en environnement de test
--   2. Validation des politiques Row Level Security
--   3. Health check sur données réelles
--   4. Passer NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED=true
--
-- Objectif :
--   Persister plus tard les brouillons de mission runtime (RuntimeMissionDraft).
--   localStorage reste le fallback actif. Le brouillon est local/in-memory en P4.3/P4.4.
--
-- Invariants :
--   - user_id = auth.uid() obligatoire (RLS)
--   - multi-tenant strict par user_id (+ company_id)
--   - jamais de delete policy (préservation des brouillons)
--   - safety_flags doivent empêcher toute exécution (CHECK = 'false')
--   - aucune mission réelle créée via cette table
--   - aucun service role côté client
--   - scale 80k non prouvé
--   - lancement public externe non validé
-- =========================================================

-- ── Table principale ──────────────────────────────────────────────────────────

create table if not exists public.clonestore_runtime_mission_drafts (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users(id) on delete cascade,
  company_id             text        null,
  draft_id               text        not null,
  command_id             text        not null,
  intent_id              text        not null,
  route_id               text        not null,
  plan_id                text        not null,
  employee_key           text        null,
  kind                   text        not null,
  status                 text        not null,
  source                 text        not null,
  title                  text        not null,
  objective              text        not null,
  summary                text        not null,
  domain                 text        not null,
  risk_level             text        not null,
  validation_mode        text        not null,
  draft_payload          jsonb       not null default '{}'::jsonb,
  safety_flags           jsonb       not null default '{}'::jsonb,
  guard_snapshot         jsonb       not null default '{}'::jsonb,
  trace_snapshot         jsonb       not null default '{}'::jsonb,
  idempotency_snapshot   jsonb       not null default '{}'::jsonb,
  queue_snapshot         jsonb       not null default '{}'::jsonb,
  cost_snapshot          jsonb       not null default '{}'::jsonb,
  scale_snapshot         jsonb       not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── Contraintes ───────────────────────────────────────────────────────────────

-- Un brouillon unique par (user_id, company_id, draft_id).
-- NOTE : company_id étant nullable, l'unicité ne s'applique qu'aux lignes non-NULL
-- via un index unique partiel. La contrainte (user_id, command_id, plan_id) couvre
-- la déduplication principale.
create unique index if not exists uq_runtime_mission_draft_user_company_draft
  on public.clonestore_runtime_mission_drafts (user_id, company_id, draft_id)
  where company_id is not null;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_runtime_mission_draft_user_command_plan'
      AND conrelid = 'public.clonestore_runtime_mission_drafts'::regclass
  ) THEN
    ALTER TABLE public.clonestore_runtime_mission_drafts
      ADD CONSTRAINT uq_runtime_mission_draft_user_command_plan
      UNIQUE (user_id, command_id, plan_id);
  END IF;
END $$;

-- Status parmi les valeurs autorisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_runtime_mission_draft_status_valid'
      AND conrelid = 'public.clonestore_runtime_mission_drafts'::regclass
  ) THEN
    ALTER TABLE public.clonestore_runtime_mission_drafts
      ADD CONSTRAINT chk_runtime_mission_draft_status_valid
      CHECK (status IN ('draft', 'ready_for_review', 'awaiting_validation', 'blocked', 'simulated_only'));
  END IF;
END $$;

-- Kind parmi les valeurs autorisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_runtime_mission_draft_kind_valid'
      AND conrelid = 'public.clonestore_runtime_mission_drafts'::regclass
  ) THEN
    ALTER TABLE public.clonestore_runtime_mission_drafts
      ADD CONSTRAINT chk_runtime_mission_draft_kind_valid
      CHECK (kind IN ('pierre_mission_draft', 'unsupported_domain_draft', 'blocked_draft'));
  END IF;
END $$;

-- draft_id / command_id / plan_id non vides
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_runtime_mission_draft_ids_not_empty'
      AND conrelid = 'public.clonestore_runtime_mission_drafts'::regclass
  ) THEN
    ALTER TABLE public.clonestore_runtime_mission_drafts
      ADD CONSTRAINT chk_runtime_mission_draft_ids_not_empty
      CHECK (length(trim(draft_id)) > 0 AND length(trim(command_id)) > 0 AND length(trim(plan_id)) > 0);
  END IF;
END $$;

-- ── Safety flags : empêcher toute exécution via la table ─────────────────────
-- Ces contraintes garantissent qu'un enregistrement ne peut JAMAIS représenter
-- une exécution réelle. Toute valeur autre que 'false' est rejetée.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_runtime_mission_draft_no_execution'
      AND conrelid = 'public.clonestore_runtime_mission_drafts'::regclass
  ) THEN
    ALTER TABLE public.clonestore_runtime_mission_drafts
      ADD CONSTRAINT chk_runtime_mission_draft_no_execution
      CHECK (
        safety_flags->>'execution_enabled' = 'false'
        AND safety_flags->>'db_write_enabled' = 'false'
        AND safety_flags->>'api_execution_enabled' = 'false'
        AND safety_flags->>'pierre_engine_called' = 'false'
        AND safety_flags->>'ai_call_performed' = 'false'
        AND safety_flags->>'email_sent' = 'false'
        AND safety_flags->>'message_sent' = 'false'
        AND safety_flags->>'document_generated' = 'false'
        AND safety_flags->>'clonevoice_active' = 'false'
        AND safety_flags->>'public_launch_external_validated' = 'false'
      );
  END IF;
END $$;

-- ── Index ─────────────────────────────────────────────────────────────────────

create index if not exists idx_runtime_mission_draft_user_id
  on public.clonestore_runtime_mission_drafts (user_id);

create index if not exists idx_runtime_mission_draft_company_id
  on public.clonestore_runtime_mission_drafts (company_id);

create index if not exists idx_runtime_mission_draft_draft_id
  on public.clonestore_runtime_mission_drafts (draft_id);

create index if not exists idx_runtime_mission_draft_command_id
  on public.clonestore_runtime_mission_drafts (command_id);

create index if not exists idx_runtime_mission_draft_plan_id
  on public.clonestore_runtime_mission_drafts (plan_id);

create index if not exists idx_runtime_mission_draft_status
  on public.clonestore_runtime_mission_drafts (user_id, status);

create index if not exists idx_runtime_mission_draft_employee_key
  on public.clonestore_runtime_mission_drafts (user_id, employee_key);

create index if not exists idx_runtime_mission_draft_updated_at
  on public.clonestore_runtime_mission_drafts (user_id, updated_at desc);

-- ── Trigger updated_at ────────────────────────────────────────────────────────

create or replace function public.clonestore_runtime_mission_drafts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clonestore_runtime_mission_drafts_updated_at
  on public.clonestore_runtime_mission_drafts;

create trigger trg_clonestore_runtime_mission_drafts_updated_at
  before update on public.clonestore_runtime_mission_drafts
  for each row
  execute function public.clonestore_runtime_mission_drafts_set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.clonestore_runtime_mission_drafts
  enable row level security;

-- SELECT — lecture de ses propres brouillons uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clonestore_runtime_mission_drafts'
      AND policyname = 'select_own_runtime_mission_draft'
  ) THEN
    CREATE POLICY "select_own_runtime_mission_draft"
      ON public.clonestore_runtime_mission_drafts
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- INSERT — créer ses propres brouillons uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clonestore_runtime_mission_drafts'
      AND policyname = 'insert_own_runtime_mission_draft'
  ) THEN
    CREATE POLICY "insert_own_runtime_mission_draft"
      ON public.clonestore_runtime_mission_drafts
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- UPDATE — modifier ses propres brouillons uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clonestore_runtime_mission_drafts'
      AND policyname = 'update_own_runtime_mission_draft'
  ) THEN
    CREATE POLICY "update_own_runtime_mission_draft"
      ON public.clonestore_runtime_mission_drafts
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Pas de politique DELETE intentionnel — préservation des brouillons (audit).

-- ── Commentaires de sécurité ──────────────────────────────────────────────────

comment on table public.clonestore_runtime_mission_drafts is
  'Brouillons de mission runtime — DRAFT non appliqué (PHASE 4.4). '
  'safety_flags empêchent toute exécution. Aucune mission réelle. '
  'localStorage reste le fallback actif. Activation manuelle en PHASE 4.5. '
  'lancement public externe non validé. scale 80k non prouvé.';

-- ── Notes d'activation ────────────────────────────────────────────────────────
-- Ce fichier doit être appliqué MANUELLEMENT via le dashboard Supabase ou CLI.
-- Aucune application automatique. Aucun .env.local modifié. Flag default false.
