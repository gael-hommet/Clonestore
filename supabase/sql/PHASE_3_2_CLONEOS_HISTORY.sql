-- =========================================================
-- PHASE 3.2 — CloneOS History Server Persistence Design
-- Table : clonestore_cloneos_history
--
-- IMPORTANT : Ce fichier est un DRAFT — NON appliqué automatiquement.
-- Activer manuellement en PHASE 3.3 après :
--   1. Vérification du schéma en environnement de test
--   2. Validation des politiques Row Level Security
--   3. Tests E2E sur données réelles
--   4. Passer CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED = true
--
-- Objectif :
--   Persister l'historique CloneOS (actuellement localStorage uniquement)
--   côté serveur pour cross-device et intégration /profile/messages.
--
-- Invariants :
--   - user_id = auth.uid() obligatoire (RLS)
--   - raw_request_summary ≤ 500 chars (jamais prompt complet si sensible)
--   - pas de delete policy (audit trail immuable)
--   - pas de public launch flag
-- =========================================================

-- ── Table principale ──────────────────────────────────────────────────────────

create table if not exists public.clonestore_cloneos_history (
  id                         uuid        primary key default gen_random_uuid(),
  user_id                    uuid        not null references auth.users(id) on delete cascade,
  company_id                 text        not null,
  command_id                 text        not null,
  employee_slug              text,
  domain                     text        not null default 'unknown',
  intent                     text        not null default 'unknown',
  status                     text        not null default 'unknown',
  risk_level                 text        not null default 'low',
  raw_request_summary        text        not null,
  mission_title              text,
  mission_summary            text,
  task_count                 integer     not null default 0,
  guard_decision             text,
  human_validation_required  boolean     not null default false,
  blocked                    boolean     not null default false,
  refused                    boolean     not null default false,
  trace_event_count          integer     not null default 0,
  next_action                text,
  metadata                   jsonb       not null default '{}'::jsonb,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  -- Un utilisateur ne peut avoir qu'une entrée par command_id
  constraint clonestore_cloneos_history_unique_command
    unique (user_id, command_id),

  -- Longueur résumé : jamais de prompt complet si sensible
  constraint clonestore_cloneos_history_summary_length
    check (length(raw_request_summary) between 1 and 500),

  -- Statuts valides
  constraint clonestore_cloneos_history_status_valid
    check (status in (
      'received', 'classified', 'routed', 'planned', 'guarded',
      'trace_ready', 'ready_for_execution', 'requires_validation',
      'blocked', 'refused', 'failed', 'unknown'
    )),

  -- Niveaux de risque valides
  constraint clonestore_cloneos_history_risk_valid
    check (risk_level in ('low', 'medium', 'high', 'critical')),

  -- company_id non vide
  constraint clonestore_cloneos_history_company_not_empty
    check (length(trim(company_id)) > 0),

  -- command_id non vide
  constraint clonestore_cloneos_history_command_not_empty
    check (length(trim(command_id)) > 0)
);

-- ── Trigger updated_at ────────────────────────────────────────────────────────

create or replace function public.clonestore_cloneos_history_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clonestore_cloneos_history_updated_at
  on public.clonestore_cloneos_history;

create trigger trg_clonestore_cloneos_history_updated_at
  before update on public.clonestore_cloneos_history
  for each row
  execute function public.clonestore_cloneos_history_set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Lecture par utilisateur, ordre chronologique inverse (liste messagerie)
create index if not exists idx_cloneos_history_user_created
  on public.clonestore_cloneos_history (user_id, created_at desc);

-- Lookup par company + user
create index if not exists idx_cloneos_history_user_company
  on public.clonestore_cloneos_history (user_id, company_id);

-- Filtre par statut (onglet Alertes : blocked/requires_validation)
create index if not exists idx_cloneos_history_user_status
  on public.clonestore_cloneos_history (user_id, status);

-- Filtre par risque
create index if not exists idx_cloneos_history_user_risk
  on public.clonestore_cloneos_history (user_id, risk_level);

-- Déduplication par command_id
create unique index if not exists idx_cloneos_history_command_id
  on public.clonestore_cloneos_history (command_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.clonestore_cloneos_history enable row level security;

-- DROP existing policies (idempotent)
drop policy if exists "cloneos_history_select_own" on public.clonestore_cloneos_history;
drop policy if exists "cloneos_history_insert_own" on public.clonestore_cloneos_history;

-- SELECT : chaque utilisateur voit uniquement ses propres commandes
create policy "cloneos_history_select_own"
  on public.clonestore_cloneos_history
  for select
  to authenticated
  using (auth.uid() = user_id);

-- INSERT : chaque utilisateur ne peut insérer que ses propres commandes
create policy "cloneos_history_insert_own"
  on public.clonestore_cloneos_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE : désactivé en v1 (audit trail immuable — les commandes ne sont pas modifiables)
-- DELETE  : désactivé (audit trail — jamais supprimé)

-- ── Commentaires de sécurité ──────────────────────────────────────────────────

comment on table public.clonestore_cloneos_history is
  'Historique des commandes CloneOS — lecture seule depuis messagerie. '
  'Pas de suppression — audit trail immuable. '
  'raw_request_summary uniquement (≤500 chars) — jamais prompt complet sensible. '
  'PHASE 3.2 DRAFT — non appliqué. Activer en PHASE 3.3.';

comment on column public.clonestore_cloneos_history.raw_request_summary is
  'Résumé tronqué ≤ 500 chars. Jamais le prompt complet si sensible.';

comment on column public.clonestore_cloneos_history.metadata is
  'Metadata redacted — aucun secret, token, clé API.';
