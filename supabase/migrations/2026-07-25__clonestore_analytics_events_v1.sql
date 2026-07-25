-- Analytics, Funnel and Launch Measurement Closure — table canonique unique d'événements.
-- Append-only, identités distinctes (visitor/session/page-view/demo-run), aucune PII, aucune IP
-- brute, propriétés fermées (jsonb borné, validé côté application avant écriture).
-- Ne modifie, ne remplace, ne migre aucune table existante (founder_access/BLOC3 intactes).

create table if not exists clonestore_analytics_events_v1 (
  id bigint generated always as identity primary key,
  event_id text not null,
  schema_version smallint not null default 1,
  event_name text not null check (char_length(event_name) between 1 and 128),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  source text not null check (source in ('web', 'server', 'stripe', 'system')),
  trust_level text not null check (
    trust_level in (
      'CLIENT_OBSERVED',
      'SERVER_ACCEPTED',
      'SERVER_PERSISTED',
      'SERVER_CONFIRMED',
      'PAYMENT_PROVIDER_CONFIRMED'
    )
  ),
  environment text not null check (environment in ('production', 'preview', 'development', 'test')),
  traffic_class text not null default 'unknown'
    check (traffic_class in ('external', 'internal', 'test', 'automated', 'unknown')),
  visitor_id uuid,
  session_id uuid,
  page_view_id uuid,
  demo_run_id uuid,
  authenticated_user_id uuid,
  route_key text,
  step_id text,
  country_code text check (country_code is null or char_length(country_code) = 2),
  source_channel text,
  campaign_key text,
  partner_attribution_id text,
  properties_json jsonb not null default '{}'::jsonb,
  consent_state text not null default 'unknown'
    check (consent_state in ('unknown', 'necessary_only', 'all')),

  -- Fenêtre de plausibilité temporelle (Phase 14) — documentée, pas arbitraire :
  -- un événement ne peut pas prétendre s'être produit après sa réception, ni plus de 400 jours
  -- avant elle (borne alignée sur la politique de rétention test de ANALYTICS_PRIVACY_AND_RETENTION_MATRIX.md).
  constraint analytics_events_v1_occurred_at_plausible check (
    occurred_at <= received_at + interval '5 minutes'
    and occurred_at >= received_at - interval '400 days'
  ),
  -- Borne dure sur la taille du payload (défense en profondeur ; l'application rejette déjà
  -- toute clé hors allowlist avant d'arriver ici).
  constraint analytics_events_v1_properties_bounded check (pg_column_size(properties_json) <= 8192)
);

-- Idempotence : le même event_id ne peut jamais être écrit deux fois dans le même environnement.
create unique index if not exists analytics_events_v1_event_id_env_uq
  on clonestore_analytics_events_v1 (event_id, environment);

create index if not exists analytics_events_v1_visitor_idx on clonestore_analytics_events_v1 (visitor_id);
create index if not exists analytics_events_v1_session_idx on clonestore_analytics_events_v1 (session_id);
create index if not exists analytics_events_v1_page_view_idx on clonestore_analytics_events_v1 (page_view_id);
create index if not exists analytics_events_v1_demo_run_idx on clonestore_analytics_events_v1 (demo_run_id);
create index if not exists analytics_events_v1_name_time_idx
  on clonestore_analytics_events_v1 (event_name, occurred_at);
create index if not exists analytics_events_v1_env_traffic_idx
  on clonestore_analytics_events_v1 (environment, traffic_class);
create index if not exists analytics_events_v1_received_idx on clonestore_analytics_events_v1 (received_at);

comment on table clonestore_analytics_events_v1 is
  'Sink canonique unique du funnel CloneStore (Analytics, Funnel and Launch Measurement Closure, 2026-07-25). Append-only. Ne remplace pas clonestore_web_events/clonestore_founder_funnel_events (founder-access) ni clonestore_bloc3_conversion_events (inerte en prod) — coexistence via adaptateurs additifs, voir ANALYTICS_LEGACY_MIGRATION_MATRIX.md.';

-- ── Append-only forcé, avec une échappatoire étroite pour la SEULE fonction de purge
-- par rétention ci-dessous (un trigger BEFORE n'est jamais contourné par SECURITY DEFINER —
-- la fonction générique clonestore_forbid_mutation() ne conviendrait donc pas ici sans purge
-- possible ; ce trigger dédié vérifie un drapeau local à la transaction, positionné
-- exclusivement par clonestore_analytics_purge_before()).
create or replace function clonestore_analytics_events_v1_forbid_mutation() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
as $fn$
begin
  if tg_op = 'DELETE' and current_setting('clonestore.allow_analytics_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'append-only: % interdit sur %', tg_op, tg_table_name
    using errcode = 'insufficient_privilege';
end;
$fn$;
revoke execute on function clonestore_analytics_events_v1_forbid_mutation() from public;

drop trigger if exists trg_clonestore_analytics_events_v1_append_only on clonestore_analytics_events_v1;
create trigger trg_clonestore_analytics_events_v1_append_only
  before update or delete on clonestore_analytics_events_v1
  for each row execute function clonestore_analytics_events_v1_forbid_mutation();

-- ── RLS forcée, accès exclusivement par le rôle applicatif serveur ─────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    create role pierre_rt_app nologin;
  end if;
end$$;

alter table clonestore_analytics_events_v1 enable row level security;
alter table clonestore_analytics_events_v1 force row level security;
grant select, insert on clonestore_analytics_events_v1 to pierre_rt_app;
drop policy if exists analytics_events_v1_app on clonestore_analytics_events_v1;
create policy analytics_events_v1_app on clonestore_analytics_events_v1
  to pierre_rt_app using (true) with check (true);

-- ── Purge par rétention — fonction créée, jamais planifiée automatiquement dans ce bloc ────
-- Décision propriétaire/juridique en attente (ANALYTICS_PRIVACY_AND_RETENTION_MATRIX.md) :
-- aucun cron n'appelle cette fonction tant que la durée de production n'est pas validée.
create or replace function clonestore_analytics_purge_before(cutoff timestamptz)
  returns bigint
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $fn$
declare
  deleted_count bigint;
begin
  if cutoff >= now() then
    raise exception 'cutoff must be in the past' using errcode = 'invalid_parameter_value';
  end if;
  -- La purge est la seule opération autorisée à contourner l'append-only (drapeau local à LA
  -- transaction courante uniquement — `set_config(..., true)` = portée transactionnelle,
  -- jamais persistant, jamais visible d'une autre session).
  perform set_config('clonestore.allow_analytics_purge', 'on', true);
  delete from clonestore_analytics_events_v1 where received_at < cutoff;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$fn$;
revoke execute on function clonestore_analytics_purge_before(timestamptz) from public;
revoke execute on function clonestore_analytics_purge_before(timestamptz) from pierre_rt_app;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'clonestore_analytics_retention_operator') then
    create role clonestore_analytics_retention_operator nologin;
  end if;
end$$;
grant execute on function clonestore_analytics_purge_before(timestamptz) to clonestore_analytics_retention_operator;
