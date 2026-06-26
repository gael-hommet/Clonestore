-- =========================================================
-- PHASE 3.13 — Enterprise Footprint Server Persistence Design
-- Table : public.clonestore_enterprise_footprints
--
-- IMPORTANT : Ce fichier est un DRAFT — NON appliqué automatiquement.
-- Activer manuellement en PHASE 3.14 après :
--   1. Vérification du schéma en environnement de test
--   2. Validation des politiques Row Level Security
--   3. Tests health check sur données réelles
--   4. Passer NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED=true
--
-- Objectif :
--   Persister l'Empreinte Entreprise CloneStore côté serveur.
--   localStorage reste le fallback actif.
--
-- Invariants :
--   - user_id = auth.uid() obligatoire (RLS)
--   - jamais de delete policy (préservation des empreintes)
--   - scores entre 0 et 100
--   - status parmi les valeurs autorisées
--   - données sensibles redactées côté applicatif avant persistence
--   - aucun service role côté client
--   - lancement public externe non validé
-- =========================================================

-- ── Table principale ──────────────────────────────────────────────────────────

create table if not exists public.clonestore_enterprise_footprints (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  company_id              text        not null,
  status                  text        not null default 'draft',
  source                  text        not null default 'local_snapshot',
  company_json            jsonb       not null default '{}'::jsonb,
  humans_json             jsonb       not null default '[]'::jsonb,
  approval_rules_json     jsonb       not null default '[]'::jsonb,
  documents_json          jsonb       not null default '[]'::jsonb,
  technologies_json       jsonb       not null default '[]'::jsonb,
  cloneadn_summary_json   jsonb       not null default '{}'::jsonb,
  coverage_score          integer     not null default 0,
  readiness_score         integer     not null default 0,
  missing_items_json      jsonb       not null default '[]'::jsonb,
  warnings_json           jsonb       not null default '[]'::jsonb,
  metadata                jsonb       not null default '{}'::jsonb,
  last_local_updated_at   timestamptz,
  server_version          integer     not null default 1,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── Contraintes ───────────────────────────────────────────────────────────────

-- Un enregistrement par entreprise par utilisateur
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_enterprise_footprint_user_company'
      AND conrelid = 'public.clonestore_enterprise_footprints'::regclass
  ) THEN
    ALTER TABLE public.clonestore_enterprise_footprints
      ADD CONSTRAINT uq_enterprise_footprint_user_company
      UNIQUE (user_id, company_id);
  END IF;
END $$;

-- Coverage score valide (0-100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_enterprise_footprint_coverage_score'
      AND conrelid = 'public.clonestore_enterprise_footprints'::regclass
  ) THEN
    ALTER TABLE public.clonestore_enterprise_footprints
      ADD CONSTRAINT chk_enterprise_footprint_coverage_score
      CHECK (coverage_score BETWEEN 0 AND 100);
  END IF;
END $$;

-- Readiness score valide (0-100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_enterprise_footprint_readiness_score'
      AND conrelid = 'public.clonestore_enterprise_footprints'::regclass
  ) THEN
    ALTER TABLE public.clonestore_enterprise_footprints
      ADD CONSTRAINT chk_enterprise_footprint_readiness_score
      CHECK (readiness_score BETWEEN 0 AND 100);
  END IF;
END $$;

-- Status parmi les valeurs autorisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_enterprise_footprint_status_valid'
      AND conrelid = 'public.clonestore_enterprise_footprints'::regclass
  ) THEN
    ALTER TABLE public.clonestore_enterprise_footprints
      ADD CONSTRAINT chk_enterprise_footprint_status_valid
      CHECK (status IN ('draft', 'ready', 'incomplete', 'needs_review', 'archived'));
  END IF;
END $$;

-- Source parmi les valeurs autorisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_enterprise_footprint_source_valid'
      AND conrelid = 'public.clonestore_enterprise_footprints'::regclass
  ) THEN
    ALTER TABLE public.clonestore_enterprise_footprints
      ADD CONSTRAINT chk_enterprise_footprint_source_valid
      CHECK (source IN ('local_snapshot', 'onboarding_draft', 'server', 'cloneadn', 'demo'));
  END IF;
END $$;

-- company_id non vide
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_enterprise_footprint_company_id_not_empty'
      AND conrelid = 'public.clonestore_enterprise_footprints'::regclass
  ) THEN
    ALTER TABLE public.clonestore_enterprise_footprints
      ADD CONSTRAINT chk_enterprise_footprint_company_id_not_empty
      CHECK (length(trim(company_id)) > 0);
  END IF;
END $$;

-- ── Index ─────────────────────────────────────────────────────────────────────

create index if not exists idx_enterprise_footprint_user_company
  on public.clonestore_enterprise_footprints (user_id, company_id);

create index if not exists idx_enterprise_footprint_user_updated
  on public.clonestore_enterprise_footprints (user_id, updated_at desc);

create index if not exists idx_enterprise_footprint_user_status
  on public.clonestore_enterprise_footprints (user_id, status);

create index if not exists idx_enterprise_footprint_user_readiness
  on public.clonestore_enterprise_footprints (user_id, readiness_score);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.clonestore_enterprise_footprints
  enable row level security;

-- Politique SELECT — lecture de ses propres empreintes uniquement
create policy "select_own_enterprise_footprint"
  on public.clonestore_enterprise_footprints
  for select
  using (auth.uid() = user_id);

-- Politique INSERT — créer ses propres empreintes uniquement
create policy "insert_own_enterprise_footprint"
  on public.clonestore_enterprise_footprints
  for insert
  with check (auth.uid() = user_id);

-- Politique UPDATE — modifier ses propres empreintes uniquement
create policy "update_own_enterprise_footprint"
  on public.clonestore_enterprise_footprints
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Pas de politique DELETE intentionnel — préservation des empreintes.

-- ── Notes d'activation ────────────────────────────────────────────────────────

-- Ce fichier doit être appliqué manuellement via le dashboard Supabase ou CLI.
-- Ne jamais appliquer automatiquement depuis le code applicatif.
-- Vérifier que toutes les contraintes sont bien créées avant activation du flag.
-- localStorage reste le fallback actif pendant et après la migration.
