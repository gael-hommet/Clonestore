-- supabase/migrations/2026-06-19__clonestore_founder_access.sql
-- PHASE E — Founder Access : réservations, funnel, file email, présence web,
-- audit administrateur. Tables CLONESTORE-GLOBALES (non tenant-scopées) dans le
-- Postgres runtime. Non exposées via l'API REST Supabase → un navigateur ne peut
-- pas les lire ; l'accès passe uniquement par des routes serveur (getRuntimeDb).
-- RLS forcée + grant restreint à pierre_rt_app = couche secondaire. Idempotent.
-- Daté après pierre_v11 pour que le rôle pierre_rt_app existe déjà.

-- Le rôle applicatif runtime doit exister (créé par pierre_v2 en séquence ;
-- garde idempotente pour un apply autonome de cette migration).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    create role pierre_rt_app nologin;
  end if;
end$$;

-- ── Réservations ────────────────────────────────────────────────────────────
create table if not exists clonestore_founder_reservations (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  email                   text not null,
  email_normalized        text not null,
  email_domain_type       text not null default 'unknown'
                            check (email_domain_type in ('professional','personal','role_based','disposable','unknown')),
  company_name            text not null,
  company_size            text not null check (company_size in ('1-49','50-249','250-999','1000+')),
  sector                  text,

  full_name               text,
  role                    text,
  primary_hr_need         text,
  website                 text,
  phone                   text,
  contact_requested       boolean not null default false,

  status                  text not null default 'started'
                            check (status in ('started','email_to_confirm','confirmed','qualified','strong_intent',
                                              'activation_sent','activation_started','active_client','expired','unsubscribed')),
  strong_intent           boolean not null default false,
  internal_notes          text,

  email_verified_at         timestamptz,
  verification_token_hash   text,
  verification_expires_at   timestamptz,

  source                  text,
  referrer                text,
  landing_path            text,
  utm_source              text,
  utm_medium              text,
  utm_campaign            text,
  utm_content             text,
  utm_term                text,
  anonymous_session_id    text,

  demo_started_at           timestamptz,
  demo_completed_at         timestamptz,
  pierre_demo_started_at    timestamptz,
  pierre_demo_completed_at  timestamptz,

  activation_invited_at     timestamptz,
  activation_started_at     timestamptz,
  activated_at              timestamptz,
  expired_at                timestamptz,
  unsubscribed_at           timestamptz,

  stripe_customer_id        text,
  stripe_subscription_id    text,
  subscription_amount_cents integer,
  currency                  text default 'EUR',

  privacy_consent_at        timestamptz,
  ip_hash                   text,
  user_agent_summary        text
);
-- Déduplication idempotente : une réservation par email normalisé.
create unique index if not exists uq_founder_reservation_email on clonestore_founder_reservations(email_normalized);
create index if not exists idx_founder_reservation_status on clonestore_founder_reservations(status);
create index if not exists idx_founder_reservation_created on clonestore_founder_reservations(created_at desc);
create index if not exists idx_founder_reservation_session on clonestore_founder_reservations(anonymous_session_id);
create index if not exists idx_founder_reservation_company_size on clonestore_founder_reservations(company_size);
create index if not exists idx_founder_reservation_utm_source on clonestore_founder_reservations(utm_source);

-- ── Événements de funnel (append-only) ──────────────────────────────────────
create table if not exists clonestore_founder_funnel_events (
  id                   bigint generated always as identity primary key,
  reservation_id       uuid references clonestore_founder_reservations(id) on delete set null,
  anonymous_session_id text,
  event_name           text not null,
  occurred_at          timestamptz not null default now(),
  source               text,
  commercial_phase     text,
  metadata_safe        jsonb not null default '{}'::jsonb
);
create index if not exists idx_founder_events_name_time on clonestore_founder_funnel_events(event_name, occurred_at desc);
create index if not exists idx_founder_events_reservation on clonestore_founder_funnel_events(reservation_id);
create index if not exists idx_founder_events_session on clonestore_founder_funnel_events(anonymous_session_id);

-- ── File d'envoi email idempotente ──────────────────────────────────────────
create table if not exists clonestore_founder_email_jobs (
  id              bigint generated always as identity primary key,
  job_key         text not null unique,                 -- reservation_id:kind → un seul envoi
  reservation_id  uuid not null references clonestore_founder_reservations(id) on delete cascade,
  kind            text not null,
  status          text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts        integer not null default 0,
  send_at         timestamptz not null default now(),
  sent_at         timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_founder_email_jobs_due on clonestore_founder_email_jobs(status, send_at);

-- ── Présence web first-party (anonyme) ──────────────────────────────────────
create table if not exists clonestore_web_sessions (
  anonymous_session_id text primary key,
  started_at           timestamptz not null default now(),
  last_seen_at         timestamptz not null default now(),
  current_path         text,
  landing_path         text,
  referrer             text,
  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  utm_content          text,
  utm_term             text,
  device_category      text,
  browser_family       text,
  country_code         text,
  commercial_phase     text,
  reservation_id       uuid references clonestore_founder_reservations(id) on delete set null,
  user_id              uuid
);
create index if not exists idx_web_sessions_last_seen on clonestore_web_sessions(last_seen_at desc);
create index if not exists idx_web_sessions_path on clonestore_web_sessions(current_path);

create table if not exists clonestore_web_events (
  id                   bigint generated always as identity primary key,
  anonymous_session_id text,
  event_name           text not null,
  path                 text,
  occurred_at          timestamptz not null default now(),
  metadata_safe        jsonb not null default '{}'::jsonb
);
create index if not exists idx_web_events_time on clonestore_web_events(occurred_at desc);

-- ── Audit des actions administrateur (append-only) ──────────────────────────
create table if not exists clonestore_founder_admin_audit (
  id          bigint generated always as identity primary key,
  actor_email text not null,
  action      text not null,
  target      text,
  occurred_at timestamptz not null default now(),
  result      text,
  context_safe jsonb not null default '{}'::jsonb
);
create index if not exists idx_founder_audit_time on clonestore_founder_admin_audit(occurred_at desc);

-- ── RLS : forcée + accès restreint au rôle applicatif runtime ───────────────
do $$
declare t text;
begin
  foreach t in array array[
    'clonestore_founder_reservations',
    'clonestore_founder_funnel_events',
    'clonestore_founder_email_jobs',
    'clonestore_web_sessions',
    'clonestore_web_events',
    'clonestore_founder_admin_audit'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('grant select, insert, update on %I to pierre_rt_app', t);
    execute format('drop policy if exists fa_app_%I on %I', t, t);
    execute format('create policy fa_app_%I on %I to pierre_rt_app using (true) with check (true)', t, t);
  end loop;
  -- l'audit et le funnel sont append-only : pas de DELETE accordé (non listé ci-dessus).
end$$;
