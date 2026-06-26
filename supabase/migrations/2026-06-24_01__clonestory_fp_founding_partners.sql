-- supabase/migrations/2026-06-24_01__clonestory_fp_founding_partners.sql
-- CLONESTORY — Le Cercle des Partenaires Fondateurs (BLOC 2).
-- Tables réelles du moteur d'inscription + contribution vérifiée, dans le Postgres
-- runtime (getRuntimeDb / DATABASE_URL / PGlite). NON exposées via l'API REST
-- Supabase → un navigateur ne lit jamais ces tables ; l'accès passe uniquement par
-- des routes serveur. RLS FORCÉE + politiques pilotées par GUC = isolation réelle :
--   app.clonestory_service = 'on'  → mode service (code serveur de confiance) ;
--   app.clonestory_partner = <uuid> → mode membre (ne voit QUE ses propres lignes).
-- Une transaction sans GUC ne voit RIEN (fail-closed). Idempotent. Filtre migrator : clonestory_fp.

-- Le rôle applicatif runtime doit exister (garde idempotente).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    create role pierre_rt_app nologin;
  end if;
  -- PostgreSQL 16+ : pour qu'un rôle de connexion NON-superuser (ex. « postgres » sur
  -- Supabase, qui a de surcroît BYPASSRLS) puisse ASSUMER pierre_rt_app via
  -- `set local role` — indispensable pour que la RLS FORCÉE s'applique réellement —
  -- l'appartenance doit porter l'option SET (sinon « permission denied to set role »).
  -- Idempotent ; toléré si le rôle de connexion est déjà superuser (PGlite/local) ou
  -- si l'option SET est déjà présente.
  begin
    execute format('grant pierre_rt_app to %I with set true', current_user);
  exception when others then null;
  end;
end$$;

-- Fonction trigger append-only partagée (create or replace : sans dépendance d'ordre).
create or replace function clonestory_forbid_mutation() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
as $fn$
begin
  raise exception 'append-only: % interdit sur %', tg_op, tg_table_name
    using errcode = 'insufficient_privilege';
end;
$fn$;
revoke execute on function clonestory_forbid_mutation() from public;

-- Limiteur de débit partagé (réutilisé par request-utils.distributedRateLimit).
create table if not exists clonestore_rate_limits (
  bucket_key  text primary key,
  count       integer not null default 0,
  window_ms   integer not null,
  expires_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);
create index if not exists idx_rate_limits_expiry on clonestore_rate_limits(expires_at);

-- ── Partenaires (membres du Cercle) ──────────────────────────────────────────
create table if not exists clonestory_fp_partners (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  email                    text not null,
  email_normalized         text not null,
  first_name               text not null,
  last_name                text not null,
  display_name             text not null,          -- nom public futur choisi
  phone                    text,
  company                  text,
  role                     text,

  status                   text not null default 'registered'
                             check (status in ('registered','email_verified','identity_verified',
                                               'active_contributor','founding_partner','suspended','withdrawn')),
  introduced_by_partner_id uuid references clonestory_fp_partners(id) on delete set null,

  registry_number          integer,                -- alloué SEULEMENT à la 1ʳᵉ contribution vérifiée
  public_slug              text,

  email_verified_at        timestamptz,
  identity_verified_at     timestamptz,
  joined_at                timestamptz not null default now(),

  -- Lien personnel (identifiant partageable, opaque, révocable) + code lisible.
  link_token               text,                   -- opaque, non devinable, sans PII
  link_revoked_at          timestamptz,
  link_rotated_at          timestamptz,
  personal_code            text,

  -- Vérification email (HASH uniquement — le secret n'est jamais stocké en clair).
  verification_token_hash  text,
  verification_expires_at  timestamptz,

  suspended_at             timestamptz,
  suspended_reason         text,
  withdrawal_requested_at  timestamptz
);
create unique index if not exists uq_csy_partner_email on clonestory_fp_partners(email_normalized);
create unique index if not exists uq_csy_partner_link on clonestory_fp_partners(link_token) where link_token is not null;
create unique index if not exists uq_csy_partner_code on clonestory_fp_partners(personal_code) where personal_code is not null;
create unique index if not exists uq_csy_partner_slug on clonestory_fp_partners(public_slug) where public_slug is not null;
create unique index if not exists uq_csy_partner_registry on clonestory_fp_partners(registry_number) where registry_number is not null;
create index if not exists idx_csy_partner_status on clonestory_fp_partners(status);
create index if not exists idx_csy_partner_branch on clonestory_fp_partners(introduced_by_partner_id);

-- ── Introductions (lien membre → prospect/entreprise) ────────────────────────
create table if not exists clonestory_fp_introductions (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  partner_id               uuid not null references clonestory_fp_partners(id) on delete cascade,
  method                   text not null check (method in ('link','code','declared')),
  status                   text not null default 'declared'
                             check (status in ('declared','prospect_confirmed','prospect_registered',
                                               'company_created','purchase_captured','activation_completed',
                                               'validation_pending','verified','canceled','disputed','expired')),

  prospect_first_name      text,
  prospect_company         text not null,
  prospect_email           text,                   -- PII (recommandation) — purgée si refus
  prospect_email_normalized text,
  note                     text,
  company_fingerprint      text not null,          -- haché, sans PII en clair

  reservation_id           uuid,                   -- ancrage Phase E (achat réel) — futur
  consumed_stripe_event_id text,                   -- anti-rejeu paiement — futur

  confirm_token_hash       text,                   -- token de confirmation envoyé au prospect
  confirm_expires_at       timestamptz,

  declared_at              timestamptz not null default now(),
  confirmed_at             timestamptz,
  purchase_at              timestamptz,
  verified_at              timestamptz,
  canceled_at              timestamptz,
  dispute_flag             boolean not null default false,
  refused_at               timestamptz
);
create index if not exists idx_csy_intro_partner on clonestory_fp_introductions(partner_id);
create index if not exists idx_csy_intro_status on clonestory_fp_introductions(status);
-- Un membre ne déclare pas deux fois le même prospect actif.
create unique index if not exists uq_csy_intro_partner_prospect
  on clonestory_fp_introductions(partner_id, prospect_email_normalized)
  where prospect_email_normalized is not null and status not in ('canceled','expired','disputed');
-- Une entreprise n'a qu'UNE attribution active confirmée (au-delà de declared).
create unique index if not exists uq_csy_intro_company_active
  on clonestory_fp_introductions(company_fingerprint)
  where status in ('prospect_confirmed','prospect_registered','company_created',
                   'purchase_captured','activation_completed','validation_pending','verified');

-- ── Événements de contribution (APPEND-ONLY — seule source des chiffres) ──────
create table if not exists clonestory_fp_contribution_events (
  id              bigint generated always as identity primary key,
  partner_id      uuid not null references clonestory_fp_partners(id) on delete cascade,
  introduction_id uuid references clonestory_fp_introductions(id) on delete set null,
  type            text not null check (type in (
                    'introduction_declared','introduction_confirmed','prospect_registered',
                    'company_created','purchase_captured','activation_completed',
                    'contribution_verified','contribution_canceled','contribution_disputed','manual_validation')),
  source          text not null check (source in ('link','code','declared','stripe','phase_e','manual')),
  evidence_ref    text,
  occurred_at     timestamptz not null default now(),
  metadata_safe   jsonb not null default '{}'::jsonb
);
create index if not exists idx_csy_events_partner on clonestory_fp_contribution_events(partner_id, occurred_at);
create index if not exists idx_csy_events_intro on clonestory_fp_contribution_events(introduction_id);

-- ── Journal des usages de lien/code (APPEND-ONLY) ────────────────────────────
create table if not exists clonestory_fp_link_usage (
  id            bigint generated always as identity primary key,
  partner_id    uuid not null references clonestory_fp_partners(id) on delete cascade,
  method        text not null check (method in ('link','code')),
  outcome       text not null check (outcome in ('landed','attributed','invalid','revoked')),
  hashed_ip     text,
  occurred_at   timestamptz not null default now(),
  metadata_safe jsonb not null default '{}'::jsonb
);
create index if not exists idx_csy_usage_partner on clonestory_fp_link_usage(partner_id, occurred_at);

-- ── Journal administrateur (APPEND-ONLY) ─────────────────────────────────────
create table if not exists clonestory_fp_admin_audit (
  id              bigint generated always as identity primary key,
  actor           text not null,
  action          text not null,
  partner_id      uuid,
  introduction_id uuid,
  reason          text not null,          -- toujours exigée
  prev_state      jsonb,
  new_state       jsonb,
  occurred_at     timestamptz not null default now()
);
create index if not exists idx_csy_audit_partner on clonestory_fp_admin_audit(partner_id, occurred_at);

-- ── Demandes de retrait (RGPD) ───────────────────────────────────────────────
create table if not exists clonestory_fp_withdrawals (
  id               bigint generated always as identity primary key,
  partner_id       uuid references clonestory_fp_partners(id) on delete set null,
  email_normalized text not null,
  status           text not null default 'requested' check (status in ('requested','processed','refused')),
  requested_at     timestamptz not null default now(),
  processed_at     timestamptz,
  note             text
);

-- ── Append-only structurel : revoke + triggers ───────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'clonestory_fp_contribution_events',
    'clonestory_fp_link_usage',
    'clonestory_fp_admin_audit'
  ] loop
    execute format('drop trigger if exists trg_%I_append_only on %I', t, t);
    execute format(
      'create trigger trg_%I_append_only before update or delete on %I
         for each row execute function clonestory_forbid_mutation()', t, t);
  end loop;
end$$;

-- ── RLS forcée + politiques GUC + grants ─────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'clonestory_fp_partners',
    'clonestory_fp_introductions',
    'clonestory_fp_contribution_events',
    'clonestory_fp_link_usage',
    'clonestory_fp_admin_audit',
    'clonestory_fp_withdrawals'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('grant select, insert, update on %I to pierre_rt_app', t);
  end loop;
end$$;

-- Politiques (PUBLIC : s'appliquent à tout rôle, owner compris sous FORCE).
-- USING  : mode service OU ligne appartenant au partenaire courant.
-- CHECK  : écriture autorisée UNIQUEMENT en mode service (le code serveur de confiance).
drop policy if exists csy_partners_access on clonestory_fp_partners;
create policy csy_partners_access on clonestory_fp_partners for all
  using (
    nullif(current_setting('app.clonestory_service', true), '') = 'on'
    or id::text = nullif(current_setting('app.clonestory_partner', true), '')
  )
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_intro_access on clonestory_fp_introductions;
create policy csy_intro_access on clonestory_fp_introductions for all
  using (
    nullif(current_setting('app.clonestory_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.clonestory_partner', true), '')
  )
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_events_access on clonestory_fp_contribution_events;
create policy csy_events_access on clonestory_fp_contribution_events for all
  using (
    nullif(current_setting('app.clonestory_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.clonestory_partner', true), '')
  )
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_usage_access on clonestory_fp_link_usage;
create policy csy_usage_access on clonestory_fp_link_usage for all
  using (
    nullif(current_setting('app.clonestory_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.clonestory_partner', true), '')
  )
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

-- Audit + retraits : service uniquement (jamais lisibles par un membre).
drop policy if exists csy_audit_access on clonestory_fp_admin_audit;
create policy csy_audit_access on clonestory_fp_admin_audit for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_withdrawals_access on clonestory_fp_withdrawals;
create policy csy_withdrawals_access on clonestory_fp_withdrawals for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

-- grant sur la table de rate limit (réutilisée).
grant select, insert, update, delete on clonestore_rate_limits to pierre_rt_app;
