-- =========================================================
-- PHASE 3.5 — Global Onboarding Persistence Draft
-- Table : clonestore_global_onboarding_drafts
--
-- IMPORTANT : Ce fichier est un DRAFT — NON appliqué automatiquement.
-- Activer manuellement en PHASE 3.6 après :
--   1. Vérification du schéma en environnement de test
--   2. Validation des politiques Row Level Security
--   3. Tests E2E sur données réelles
--   4. Passer NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED=true
--
-- Objectif :
--   Persister les brouillons d'onboarding global CloneStore côté serveur
--   (actuellement localStorage uniquement en PHASE 3.5).
--
-- Invariants :
--   - user_id = auth.uid() obligatoire (RLS)
--   - jamais de delete policy (préservation des brouillons)
--   - completion_score entre 0 et 100
--   - status parmi les valeurs autorisées
--   - données sensibles redactées avant persistence côté app
--   - aucun service role côté client
--   - pas de public launch flag
-- =========================================================

-- ── Table principale ──────────────────────────────────────────────────────────

create table if not exists public.clonestore_global_onboarding_drafts (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  company_id              text        not null,
  status                  text        not null default 'server_draft',
  current_step            text        not null default 'company_identity',
  completion_score        integer     not null default 0,
  company_json            jsonb       not null default '{}'::jsonb,
  humans_json             jsonb       not null default '[]'::jsonb,
  documents_json          jsonb       not null default '[]'::jsonb,
  rules_json              jsonb       not null default '[]'::jsonb,
  technologies_json       jsonb       not null default '[]'::jsonb,
  first_mission_json      jsonb       not null default '{}'::jsonb,
  cloneadn_preview_json   jsonb       not null default '{}'::jsonb,
  metadata                jsonb       not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── Contraintes ───────────────────────────────────────────────────────────────

-- Un brouillon par entreprise par utilisateur
alter table public.clonestore_global_onboarding_drafts
  add constraint if not exists uq_global_onboarding_user_company
  unique (user_id, company_id);

-- Score de complétion valide
alter table public.clonestore_global_onboarding_drafts
  add constraint if not exists chk_global_onboarding_score_range
  check (completion_score between 0 and 100);

-- Status parmi les valeurs autorisées
alter table public.clonestore_global_onboarding_drafts
  add constraint if not exists chk_global_onboarding_status_valid
  check (status in ('local_draft', 'server_draft', 'completed', 'archived'));

-- company_id non vide
alter table public.clonestore_global_onboarding_drafts
  add constraint if not exists chk_global_onboarding_company_id_not_empty
  check (length(trim(company_id)) > 0);

-- ── Index ─────────────────────────────────────────────────────────────────────

create index if not exists idx_global_onboarding_user_created
  on public.clonestore_global_onboarding_drafts (user_id, created_at desc);

create index if not exists idx_global_onboarding_user_company
  on public.clonestore_global_onboarding_drafts (user_id, company_id);

create index if not exists idx_global_onboarding_user_status
  on public.clonestore_global_onboarding_drafts (user_id, status);

-- ── Trigger updated_at ────────────────────────────────────────────────────────
-- Suppose que la fonction moddatetime ou set_current_timestamp est disponible.
-- Sinon, à gérer côté applicatif dans la payload (updated_at = now()).

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.clonestore_global_onboarding_drafts
  enable row level security;

-- Politique SELECT — lecture de ses propres brouillons uniquement
create policy "select_own_global_onboarding"
  on public.clonestore_global_onboarding_drafts
  for select
  using (auth.uid() = user_id);

-- Politique INSERT — créer ses propres brouillons uniquement
create policy "insert_own_global_onboarding"
  on public.clonestore_global_onboarding_drafts
  for insert
  with check (auth.uid() = user_id);

-- Politique UPDATE — modifier ses propres brouillons uniquement
create policy "update_own_global_onboarding"
  on public.clonestore_global_onboarding_drafts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE : DÉSACTIVÉE — les brouillons ne sont pas supprimables
-- (pas de politique delete = impossible de supprimer via API anon)

-- ── Commentaires ──────────────────────────────────────────────────────────────

comment on table public.clonestore_global_onboarding_drafts is
  'Brouillons d''onboarding global CloneStore — PHASE 3.5. '
  'Non activé en PHASE 3.5 (localStorage uniquement). '
  'Activation en PHASE 3.6 après validation RLS et tests E2E.';

comment on column public.clonestore_global_onboarding_drafts.company_json is
  'Identité entreprise sérialisée — GlobalOnboardingCompanyDraft. Redactée avant insert.';

comment on column public.clonestore_global_onboarding_drafts.humans_json is
  'Équipe RH sérialisée — GlobalOnboardingHumanDraft[]. Email non persisté (PII).';

comment on column public.clonestore_global_onboarding_drafts.first_mission_json is
  'Première mission Pierre — employee_slug toujours "pierre", plan_only toujours true.';

comment on column public.clonestore_global_onboarding_drafts.cloneadn_preview_json is
  'Aperçu CloneADN local — non critique, peut être recalculé côté client.';
