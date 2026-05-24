-- =========================================================
-- CloneStore — clonestore_company_technologies v1
-- Table plateforme dédiée aux configurations technologies.
-- Remplace le stockage temporaire dans :
--   pierre_company_memory.reusable_rh_context_json.clone_technologies
-- Clé: (user_id, technology_key) — unique par entreprise + technologie.
-- Compatible migration douce : les routes conservent un fallback
-- lecture depuis l'ancien JSON si cette table est vide.
-- =========================================================

-- ── Table principale ──────────────────────────────────────────────────────────

create table if not exists public.clonestore_company_technologies (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null,
  technology_key       text        not null,
  technology_name      text        not null,
  enabled              boolean     not null default true,
  mode                 text        not null default 'standard',
  autonomy_level       text        not null default 'controlled',
  config_json          jsonb       not null default '{}'::jsonb,
  rules_json           jsonb       not null default '[]'::jsonb,
  preferences_json     jsonb       not null default '{}'::jsonb,
  limits_json          jsonb       not null default '{}'::jsonb,
  connections_json     jsonb       not null default '{}'::jsonb,
  metadata_json        jsonb       not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint clonestore_company_technologies_unique
    unique (user_id, technology_key),

  constraint clonestore_company_technologies_key_not_empty
    check (length(trim(technology_key)) > 0),

  constraint clonestore_company_technologies_name_not_empty
    check (length(trim(technology_name)) > 0),

  constraint clonestore_company_technologies_mode_valid
    check (mode in ('standard', 'guarded', 'strict', 'locked', 'normal')),

  constraint clonestore_company_technologies_autonomy_valid
    check (autonomy_level in ('off', 'suggest_only', 'supervised', 'semi_autonomous', 'autonomous', 'controlled'))
);

-- ── updated_at trigger ────────────────────────────────────────────────────────

create or replace function public.clonestore_company_technologies_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clonestore_company_technologies_updated_at
  on public.clonestore_company_technologies;

create trigger trg_clonestore_company_technologies_updated_at
  before update on public.clonestore_company_technologies
  for each row
  execute function public.clonestore_company_technologies_set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Lecture par entreprise (user_id) — liste de toutes les technologies
create index if not exists idx_cct_user_id
  on public.clonestore_company_technologies (user_id);

-- Lecture par entreprise + clé technologie (lookup principal)
create unique index if not exists idx_cct_user_technology_key
  on public.clonestore_company_technologies (user_id, technology_key);

-- Filtre par statut activé/désactivé
create index if not exists idx_cct_user_enabled
  on public.clonestore_company_technologies (user_id, enabled);

-- Recherche par mode de risque
create index if not exists idx_cct_user_mode
  on public.clonestore_company_technologies (user_id, mode);

-- Tri par date de création desc
create index if not exists idx_cct_user_created_desc
  on public.clonestore_company_technologies (user_id, created_at desc);

-- Tri par date de mise à jour desc (pour détection de changements récents)
create index if not exists idx_cct_user_updated_desc
  on public.clonestore_company_technologies (user_id, updated_at desc);

-- GIN sur config_json (requêtes JSON avancées)
create index if not exists idx_cct_config_json_gin
  on public.clonestore_company_technologies using gin (config_json jsonb_path_ops);

-- GIN sur metadata_json (requêtes sur enabled_for / disabled_for employee slugs)
create index if not exists idx_cct_metadata_json_gin
  on public.clonestore_company_technologies using gin (metadata_json jsonb_path_ops);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.clonestore_company_technologies enable row level security;

-- Drop existing policies for idempotency
drop policy if exists "cct_select_own"  on public.clonestore_company_technologies;
drop policy if exists "cct_insert_own"  on public.clonestore_company_technologies;
drop policy if exists "cct_update_own"  on public.clonestore_company_technologies;
drop policy if exists "cct_delete_own"  on public.clonestore_company_technologies;

create policy "cct_select_own"
  on public.clonestore_company_technologies
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "cct_insert_own"
  on public.clonestore_company_technologies
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "cct_update_own"
  on public.clonestore_company_technologies
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "cct_delete_own"
  on public.clonestore_company_technologies
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── Commentaires ──────────────────────────────────────────────────────────────

comment on table public.clonestore_company_technologies is
  'Configurations technologies CloneStore par entreprise. Couche plateforme transversale — indépendante de Pierre ou de tout autre employé IA. Remplace pierre_company_memory.reusable_rh_context_json.clone_technologies.';

comment on column public.clonestore_company_technologies.technology_key is
  'Identifiant technique de la technologie (ex: cloneos, cloneguard). Correspond à TechnologySlug dans le code TypeScript.';

comment on column public.clonestore_company_technologies.config_json is
  'Stockage complet et sans perte du TechnologyCompanySetting (round-trip lossless). Source de vérité pour la lecture.';

comment on column public.clonestore_company_technologies.enabled is
  'Champ dénormalisé queryable. true si status enabled/degraded/maintenance, false si disabled/not_configured.';

comment on column public.clonestore_company_technologies.mode is
  'Champ dénormalisé queryable. Correspond à risk_mode dans TechnologyCompanySetting.';

comment on column public.clonestore_company_technologies.metadata_json is
  'Champs auxiliaires queryables : status, configuration_status, enabled_for_employee_slugs, disabled_for_employee_slugs.';
