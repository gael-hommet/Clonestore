-- =========================================================
-- PHASE 4.10 — Controlled Mission Governed Persistence Design
-- Table : public.clonestore_controlled_mission_candidates
--
-- IMPORTANT : Ce fichier est un DRAFT — NON appliqué automatiquement.
-- Activer manuellement plus tard (PHASE 4.11+) après :
--   1. Vérification du schéma en environnement de test
--   2. Validation des politiques Row Level Security
--   3. Health check sur données réelles
--   4. Passer NEXT_PUBLIC_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED=true
--
-- Objectif :
--   Persister plus tard les CANDIDATES de ControlledMission (contrats de promotion).
--   Un candidate n'est JAMAIS une mission réelle ni une exécution.
--   localStorage reste le fallback actif. Le candidate est local/in-memory en P4.8/P4.9/P4.10.
--
-- Invariants :
--   - user_id = auth.uid() obligatoire (RLS)
--   - multi-tenant strict par user_id (+ company_id)
--   - jamais de delete policy (préservation des candidates / audit)
--   - promotion_applied / mission_created / execution_enabled toujours false
--   - human_validation_required / preview_only / read_only toujours true
--   - safety_flags doivent empêcher toute exécution (CHECK)
--   - aucune mission réelle créée via cette table
--   - aucun service role côté client
--   - scale 80k non prouvé
--   - lancement public externe non validé
-- =========================================================

-- ── Table principale ──────────────────────────────────────────────────────────

create table if not exists public.clonestore_controlled_mission_candidates (
  id                          uuid        primary key default gen_random_uuid(),
  user_id                     uuid        not null references auth.users(id) on delete cascade,
  company_id                  text        null,
  candidate_id                text        not null,
  promotion_id                text        not null,
  controlled_mission_id       text        null,
  draft_id                    text        not null,
  command_id                  text        not null,
  intent_id                   text        not null,
  route_id                    text        not null,
  plan_id                     text        not null,
  employee_key                text        null,
  source                      text        not null,
  status                      text        not null,
  verdict                     text        not null,
  title                       text        not null,
  objective                   text        not null,
  summary                     text        not null,
  domain                      text        not null,
  risk_level                  text        not null,
  validation_mode             text        not null,
  human_validation_required   boolean     not null default true,
  promotion_applied           boolean     not null default false,
  controlled_mission_created  boolean     not null default false,
  mission_created             boolean     not null default false,
  execution_enabled           boolean     not null default false,
  execution_started           boolean     not null default false,
  preview_only                boolean     not null default true,
  read_only                   boolean     not null default true,
  candidate_payload           jsonb       not null default '{}'::jsonb,
  promotion_contract          jsonb       not null default '{}'::jsonb,
  controlled_mission_payload  jsonb       not null default '{}'::jsonb,
  safety_flags                jsonb       not null default '{}'::jsonb,
  guard_snapshot              jsonb       not null default '{}'::jsonb,
  trace_snapshot              jsonb       not null default '{}'::jsonb,
  validation_gates            jsonb       not null default '[]'::jsonb,
  blockers                    jsonb       not null default '[]'::jsonb,
  idempotency_snapshot        jsonb       not null default '{}'::jsonb,
  queue_snapshot              jsonb       not null default '{}'::jsonb,
  cost_snapshot               jsonb       not null default '{}'::jsonb,
  scale_snapshot              jsonb       not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ── Contraintes d'unicité ─────────────────────────────────────────────────────

-- Unicité (user_id, company_id, candidate_id). company_id étant nullable, on gère
-- deux index uniques partiels (NULL vs NOT NULL) pour une déduplication propre.
create unique index if not exists uq_controlled_mission_candidate_user_company_candidate
  on public.clonestore_controlled_mission_candidates (user_id, company_id, candidate_id)
  where company_id is not null;

create unique index if not exists uq_controlled_mission_candidate_user_candidate_nullcompany
  on public.clonestore_controlled_mission_candidates (user_id, candidate_id)
  where company_id is null;

-- Unicité (user_id, promotion_id).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_controlled_mission_candidate_user_promotion'
      AND conrelid = 'public.clonestore_controlled_mission_candidates'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_mission_candidates
      ADD CONSTRAINT uq_controlled_mission_candidate_user_promotion
      UNIQUE (user_id, promotion_id);
  END IF;
END $$;

-- ── Contraintes de valeurs ────────────────────────────────────────────────────

-- Status parmi les valeurs autorisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_controlled_mission_candidate_status_valid'
      AND conrelid = 'public.clonestore_controlled_mission_candidates'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_mission_candidates
      ADD CONSTRAINT chk_controlled_mission_candidate_status_valid
      CHECK (status IN (
        'draft_review', 'promotable_preview', 'awaiting_human_validation',
        'blocked', 'missing_context', 'unsupported', 'simulated_only'
      ));
  END IF;
END $$;

-- Verdict parmi les valeurs autorisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_controlled_mission_candidate_verdict_valid'
      AND conrelid = 'public.clonestore_controlled_mission_candidates'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_mission_candidates
      ADD CONSTRAINT chk_controlled_mission_candidate_verdict_valid
      CHECK (verdict IN (
        'promotable', 'requires_human_validation', 'blocked',
        'missing_context', 'unsupported', 'eligible', 'not_eligible'
      ));
  END IF;
END $$;

-- candidate_id / promotion_id / draft_id / command_id / plan_id non vides
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_controlled_mission_candidate_ids_not_empty'
      AND conrelid = 'public.clonestore_controlled_mission_candidates'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_mission_candidates
      ADD CONSTRAINT chk_controlled_mission_candidate_ids_not_empty
      CHECK (
        length(trim(candidate_id)) > 0 AND length(trim(promotion_id)) > 0
        AND length(trim(draft_id)) > 0 AND length(trim(command_id)) > 0
        AND length(trim(plan_id)) > 0
      );
  END IF;
END $$;

-- ── Gouvernance : candidate JAMAIS une mission réelle / exécutée ──────────────
-- Ces colonnes booléennes garantissent qu'un candidate ne peut PAS représenter une
-- mission réelle, une promotion appliquée, ni une exécution.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_controlled_mission_candidate_governed'
      AND conrelid = 'public.clonestore_controlled_mission_candidates'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_mission_candidates
      ADD CONSTRAINT chk_controlled_mission_candidate_governed
      CHECK (
        human_validation_required = true
        AND promotion_applied = false
        AND controlled_mission_created = false
        AND mission_created = false
        AND execution_enabled = false
        AND execution_started = false
        AND preview_only = true
        AND read_only = true
      );
  END IF;
END $$;

-- ── Safety flags : empêcher toute exécution via la table ─────────────────────
-- Toute valeur autre que celle attendue est rejetée.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_controlled_mission_candidate_no_execution'
      AND conrelid = 'public.clonestore_controlled_mission_candidates'::regclass
  ) THEN
    ALTER TABLE public.clonestore_controlled_mission_candidates
      ADD CONSTRAINT chk_controlled_mission_candidate_no_execution
      CHECK (
        safety_flags->>'promotion_applied' = 'false'
        AND safety_flags->>'execution_enabled' = 'false'
        AND safety_flags->>'mission_executed' = 'false'
        AND safety_flags->>'autonomous_execution' = 'false'
        AND safety_flags->>'pierre_engine_called' = 'false'
        AND safety_flags->>'ai_call_performed' = 'false'
        AND safety_flags->>'db_write_performed' = 'false'
        AND safety_flags->>'email_sent' = 'false'
        AND safety_flags->>'message_sent' = 'false'
        AND safety_flags->>'document_generated' = 'false'
        AND safety_flags->>'clonevoice_active' = 'false'
        AND safety_flags->>'public_launch_external_validated' = 'false'
        AND safety_flags->>'requires_human_validation' = 'true'
        AND safety_flags->>'controlled' = 'true'
        AND safety_flags->>'scale_80k_not_proven' = 'true'
      );
  END IF;
END $$;

-- ── Index ─────────────────────────────────────────────────────────────────────

create index if not exists idx_controlled_mission_candidate_user_id
  on public.clonestore_controlled_mission_candidates (user_id);

create index if not exists idx_controlled_mission_candidate_company_id
  on public.clonestore_controlled_mission_candidates (company_id);

create index if not exists idx_controlled_mission_candidate_candidate_id
  on public.clonestore_controlled_mission_candidates (candidate_id);

create index if not exists idx_controlled_mission_candidate_promotion_id
  on public.clonestore_controlled_mission_candidates (promotion_id);

create index if not exists idx_controlled_mission_candidate_controlled_mission_id
  on public.clonestore_controlled_mission_candidates (controlled_mission_id);

create index if not exists idx_controlled_mission_candidate_draft_id
  on public.clonestore_controlled_mission_candidates (draft_id);

create index if not exists idx_controlled_mission_candidate_command_id
  on public.clonestore_controlled_mission_candidates (command_id);

create index if not exists idx_controlled_mission_candidate_plan_id
  on public.clonestore_controlled_mission_candidates (plan_id);

create index if not exists idx_controlled_mission_candidate_employee_key
  on public.clonestore_controlled_mission_candidates (user_id, employee_key);

create index if not exists idx_controlled_mission_candidate_status
  on public.clonestore_controlled_mission_candidates (user_id, status);

create index if not exists idx_controlled_mission_candidate_verdict
  on public.clonestore_controlled_mission_candidates (user_id, verdict);

create index if not exists idx_controlled_mission_candidate_updated_at
  on public.clonestore_controlled_mission_candidates (user_id, updated_at desc);

create index if not exists idx_controlled_mission_candidate_payload_gin
  on public.clonestore_controlled_mission_candidates using gin (candidate_payload);

create index if not exists idx_controlled_mission_candidate_contract_gin
  on public.clonestore_controlled_mission_candidates using gin (promotion_contract);

-- ── Trigger updated_at ────────────────────────────────────────────────────────

create or replace function public.clonestore_controlled_mission_candidates_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clonestore_controlled_mission_candidates_updated_at
  on public.clonestore_controlled_mission_candidates;

create trigger trg_clonestore_controlled_mission_candidates_updated_at
  before update on public.clonestore_controlled_mission_candidates
  for each row
  execute function public.clonestore_controlled_mission_candidates_set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.clonestore_controlled_mission_candidates
  enable row level security;

-- SELECT — lecture de ses propres candidates uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clonestore_controlled_mission_candidates'
      AND policyname = 'select_own_controlled_mission_candidate'
  ) THEN
    CREATE POLICY "select_own_controlled_mission_candidate"
      ON public.clonestore_controlled_mission_candidates
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- INSERT — créer ses propres candidates uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clonestore_controlled_mission_candidates'
      AND policyname = 'insert_own_controlled_mission_candidate'
  ) THEN
    CREATE POLICY "insert_own_controlled_mission_candidate"
      ON public.clonestore_controlled_mission_candidates
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- UPDATE — modifier ses propres candidates uniquement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clonestore_controlled_mission_candidates'
      AND policyname = 'update_own_controlled_mission_candidate'
  ) THEN
    CREATE POLICY "update_own_controlled_mission_candidate"
      ON public.clonestore_controlled_mission_candidates
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Pas de politique DELETE intentionnel — préservation des candidates (audit).

-- ── Commentaires de sécurité ──────────────────────────────────────────────────

comment on table public.clonestore_controlled_mission_candidates is
  'Candidates de mission contrôlée (contrats de promotion) — DRAFT non appliqué (PHASE 4.10). '
  'promotion_applied / mission_created / execution_enabled toujours false. '
  'human_validation_required / preview_only / read_only toujours true. '
  'safety_flags empêchent toute exécution. Aucune mission réelle. '
  'localStorage reste le fallback actif. Activation manuelle future. '
  'lancement public externe non validé. scale 80k non prouvé.';

-- ── Notes d'activation ────────────────────────────────────────────────────────
-- Ce fichier doit être appliqué MANUELLEMENT via le dashboard Supabase ou CLI.
-- Aucune application automatique. Aucun .env.local modifié. Flag default false.
