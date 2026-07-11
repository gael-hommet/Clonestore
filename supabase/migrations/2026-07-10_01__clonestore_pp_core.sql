-- supabase/migrations/2026-07-10_01__clonestore_pp_core.sql
-- PROGRAMME « CABINETS FONDATEURS CLONESTORE » (partner-program) — noyau.
--
-- ADDITIF, IDEMPOTENT, NON destructif. PostgreSQL 16+/17 / PGlite compatible.
-- Filtre migrator : clonestore_pp. Univers distinct de clonestory_fp (Cercle
-- institutionnel, non commercial) : AUCUNE table clonestory_fp n'est touchée.
--
-- Tables réelles du programme de recommandation commerciale des cabinets
-- (candidature → activation → lien → attribution → clients). NON exposées via
-- l'API REST Supabase → un navigateur ne lit jamais ces tables ; l'accès passe
-- uniquement par des routes serveur. RLS FORCÉE + politiques pilotées par GUC :
--   app.pp_service = 'on'   → mode service (code serveur de confiance) ;
--   app.pp_partner = <uuid> → mode cabinet (ne voit QUE ses propres lignes).
-- Une transaction sans GUC ne voit RIEN (fail-closed).
--
-- ACTIVATION PRODUCTION (contrôlée, séparée — NON appliquée par ce bloc) :
--   MIGRATIONS_FILTER=clonestore_pp DATABASE_URL="<prod>" npm run db:migrate:pg
-- ROLLBACK (ordre inverse des FK) : voir bas de fichier 03.

-- Le rôle applicatif runtime doit exister (garde idempotente, même contrat que
-- les autres familles : le rôle de connexion doit pouvoir l'assumer via SET).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    create role pierre_rt_app nologin;
  end if;
  begin
    execute format('grant pierre_rt_app to %I with set true', current_user);
  exception when others then null;
  end;
end$$;

-- Fonction trigger append-only DÉDIÉE (aucune dépendance d'ordre avec clonestory_fp).
create or replace function clonestore_pp_forbid_mutation() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
as $fn$
begin
  raise exception 'append-only: % interdit sur %', tg_op, tg_table_name
    using errcode = 'insufficient_privilege';
end;
$fn$;
revoke execute on function clonestore_pp_forbid_mutation() from public;

-- Limiteur de débit partagé (même définition que clonestory_fp — idempotent, afin
-- que distributedRateLimit fonctionne même si la famille clonestory_fp n'est pas
-- appliquée dans l'environnement).
create table if not exists clonestore_rate_limits (
  bucket_key  text primary key,
  count       integer not null default 0,
  window_ms   integer not null,
  expires_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);
create index if not exists idx_rate_limits_expiry on clonestore_rate_limits(expires_at);
grant select, insert, update, delete on clonestore_rate_limits to pierre_rt_app;

-- ── Paramètres serveur du programme (clé → valeur JSON, service uniquement) ────
-- Tous les paramètres commerciaux sont configurables côté serveur : taux, fenêtre
-- d'attribution, durée de protection, seuil de versement, délai de réserve, jour
-- de versement, devise, statut du programme. Les défauts vivent dans le code
-- (config.ts) ; toute surcharge passe par une action admin AUDITÉE.
create table if not exists clonestore_pp_settings (
  key         text primary key,
  value_json  jsonb not null,
  updated_by  text not null,
  updated_at  timestamptz not null default now()
);

-- ── Candidatures de cabinets (formulaire public) ──────────────────────────────
create table if not exists clonestore_pp_applications (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  cabinet_name         text not null,
  first_name           text not null,
  last_name            text not null,
  role_title           text,
  email                text not null,
  email_normalized     text not null,
  phone                text,
  website              text,
  country              text not null,
  cabinet_type         text not null,
  clients_count_bucket text,
  services             text[] not null default '{}',
  message              text,
  consent_contact      boolean not null default false,
  consent_privacy      boolean not null default false,

  status               text not null default 'received'
                         check (status in ('received','under_review','accepted','rejected','withdrawn')),
  review_reason        text,
  reviewed_by          text,
  reviewed_at          timestamptz,
  created_partner_id   uuid,                    -- FK ajoutée après création de la table partenaires

  dedupe_key           text not null,           -- hash(email_normalized + cabinet normalisé)
  ip_hash              text,                    -- IP pseudonymisée (SHA-256 salé), jamais brute
  ua_summary           text
);
-- Une seule candidature OUVERTE par email (anti-doublon ; re-candidature possible après refus).
create unique index if not exists uq_pp_app_open_email
  on clonestore_pp_applications(email_normalized)
  where status in ('received','under_review');
create index if not exists idx_pp_app_status on clonestore_pp_applications(status, created_at);
create index if not exists idx_pp_app_dedupe on clonestore_pp_applications(dedupe_key);

-- ── Cabinets partenaires ──────────────────────────────────────────────────────
create table if not exists clonestore_pp_partners (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  application_id              uuid references clonestore_pp_applications(id) on delete set null,
  account_user_id             uuid,             -- compte Supabase lié (espace partenaire)

  email                       text not null,
  email_normalized            text not null,
  display_name                text not null,    -- nom public du cabinet
  legal_name                  text,
  contact_first_name          text,
  contact_last_name           text,
  contact_role                text,
  phone                       text,
  website                     text,
  country                     text not null,
  cabinet_type                text,

  public_slug                 text not null,    -- identifiant public du lien (jamais l'id interne)

  status                      text not null default 'pending'
                                check (status in ('pending','contract_pending','stripe_pending',
                                                  'active','suspended','archived')),

  -- Paramètres commerciaux PAR cabinet (défauts programme copiés à la création,
  -- surchargeables par action admin auditée). Taux en basis points : 20 % = 2000.
  commission_rate_bps         integer not null default 2000
                                check (commission_rate_bps >= 0 and commission_rate_bps <= 5000),
  attribution_window_days     integer not null default 90  check (attribution_window_days > 0),
  protection_window_days      integer not null default 180 check (protection_window_days > 0),
  reserve_days                integer not null default 30  check (reserve_days >= 0),
  payout_threshold_minor      bigint  not null default 10000 check (payout_threshold_minor >= 0),
  payout_currency             text    not null default 'eur',

  -- Stripe Connect (versements). JAMAIS activé tant que les exigences du compte
  -- connecté ne sont pas satisfaites (account.updated → payouts_enabled).
  stripe_connected_account_id text,
  stripe_onboarding_status    text not null default 'none'
                                check (stripe_onboarding_status in ('none','pending','complete','restricted')),
  payouts_enabled             boolean not null default false,

  contract_accepted_at        timestamptz,
  contract_version            text,
  activated_at                timestamptz,
  suspended_at                timestamptz,
  suspended_reason            text,
  archived_at                 timestamptz,

  -- Anti-auto-parrainage : domaines déclarés/observés du cabinet lui-même.
  self_domains                text[] not null default '{}',
  evidence_safe               jsonb not null default '{}'::jsonb
);
create unique index if not exists uq_pp_partner_email on clonestore_pp_partners(email_normalized);
create unique index if not exists uq_pp_partner_slug on clonestore_pp_partners(public_slug);
create unique index if not exists uq_pp_partner_account
  on clonestore_pp_partners(account_user_id) where account_user_id is not null;
create unique index if not exists uq_pp_partner_stripe_account
  on clonestore_pp_partners(stripe_connected_account_id) where stripe_connected_account_id is not null;
create index if not exists idx_pp_partner_status on clonestore_pp_partners(status);

-- FK candidature → partenaire créé (après coup, idempotente).
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_pp_app_created_partner'
  ) then
    alter table clonestore_pp_applications
      add constraint fk_pp_app_created_partner
      foreign key (created_partner_id) references clonestore_pp_partners(id) on delete set null;
  end if;
end$$;

-- ── Codes de recommandation (forte entropie, HASH uniquement, rotation) ───────
-- Le code en clair n'est JAMAIS stocké : montré une seule fois à la génération.
-- L'historique des générations est conservé (rotation/révocation auditables).
create table if not exists clonestore_pp_partner_codes (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references clonestore_pp_partners(id) on delete cascade,
  code_hash      text not null,          -- SHA-256 du code (comparaison serveur)
  code_hint      text not null,          -- 4 derniers caractères pour l'affichage
  generation     integer not null,
  status         text not null default 'active' check (status in ('active','revoked')),
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_reason text
);
create unique index if not exists uq_pp_code_hash on clonestore_pp_partner_codes(code_hash);
create unique index if not exists uq_pp_code_active_partner
  on clonestore_pp_partner_codes(partner_id) where status = 'active';
create index if not exists idx_pp_code_partner on clonestore_pp_partner_codes(partner_id, generation);

-- ── Referral touches (APPEND-ONLY — enregistrées CÔTÉ SERVEUR au clic) ─────────
-- Le cookie signé ne référence que touch_key ; la vérité (partenaire, expiration,
-- source) reste ici. On ne fait JAMAIS confiance à la seule valeur du cookie.
create table if not exists clonestore_pp_referral_touches (
  id            bigint generated always as identity primary key,
  touch_key     uuid not null default gen_random_uuid(),
  partner_id    uuid not null references clonestore_pp_partners(id) on delete cascade,
  source        text not null check (source in ('link','code')),
  campaign      text,
  landing_page  text,
  ip_hash       text,
  ua_summary    text,
  occurred_at   timestamptz not null default now(),
  expires_at    timestamptz not null,
  metadata_safe jsonb not null default '{}'::jsonb
);
create unique index if not exists uq_pp_touch_key on clonestore_pp_referral_touches(touch_key);
create index if not exists idx_pp_touch_partner on clonestore_pp_referral_touches(partner_id, occurred_at);

-- ── Mises en relation nominatives (protection 6 mois après validation) ─────────
create table if not exists clonestore_pp_introductions (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  partner_id                uuid not null references clonestore_pp_partners(id) on delete cascade,
  company_name              text not null,
  company_fingerprint       text not null,      -- hash normalisé (nom + domaine), sans PII en clair
  contact_name              text,
  contact_email             text,
  contact_email_normalized  text,
  consent_basis             text not null default 'partner_declared',
  note                      text,

  status                    text not null default 'submitted'
                              check (status in ('submitted','validated','rejected','matched','expired')),
  submitted_at              timestamptz not null default now(),
  validated_at              timestamptz,
  validated_by              text,
  rejected_reason           text,
  protected_until           timestamptz,        -- posée à la validation (protection nominative)
  matched_company_id        uuid,
  matched_user_id           uuid
);
create index if not exists idx_pp_intro_partner on clonestore_pp_introductions(partner_id, submitted_at);
create index if not exists idx_pp_intro_status on clonestore_pp_introductions(status);
-- Un cabinet ne déclare pas deux fois la même entreprise active.
create unique index if not exists uq_pp_intro_partner_company
  on clonestore_pp_introductions(partner_id, company_fingerprint)
  where status in ('submitted','validated','matched');
-- Une entreprise n'est protégée que pour UN cabinet à la fois (cross-partenaires).
create unique index if not exists uq_pp_intro_company_protected
  on clonestore_pp_introductions(company_fingerprint)
  where status in ('validated','matched');

-- ── Attributions (le lien prospect/client → cabinet, verrouillable) ────────────
create table if not exists clonestore_pp_attributions (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  partner_id          uuid not null references clonestore_pp_partners(id) on delete restrict,
  subject_user_id     uuid not null,            -- compte Supabase du prospect/client
  company_id          uuid,                     -- entreprise Pierre (pierre_rt_companies) si connue
  source              text not null check (source in ('link','code','introduction','invitation','admin')),
  touch_id            bigint references clonestore_pp_referral_touches(id) on delete set null,
  introduction_id     uuid references clonestore_pp_introductions(id) on delete set null,

  status              text not null default 'pending'
                        check (status in ('pending','locked','revoked','superseded')),
  first_touch_at      timestamptz,
  expires_at          timestamptz,              -- fin de fenêtre d'attribution (source lien/code)
  locked_at           timestamptz,
  locked_by_event_id  text,                     -- stripe_event_id de la 1ʳᵉ facture payée
  revoked_at          timestamptz,
  revoked_reason      text,
  superseded_by       uuid references clonestore_pp_attributions(id) on delete set null,
  evidence_safe       jsonb not null default '{}'::jsonb
);
-- UN client = UN cabinet principal : une seule attribution active par prospect.
create unique index if not exists uq_pp_attr_active_subject
  on clonestore_pp_attributions(subject_user_id)
  where status in ('pending','locked');
-- Une seule attribution verrouillée par entreprise (si connue).
create unique index if not exists uq_pp_attr_locked_company
  on clonestore_pp_attributions(company_id)
  where company_id is not null and status = 'locked';
create index if not exists idx_pp_attr_partner on clonestore_pp_attributions(partner_id, created_at);
create index if not exists idx_pp_attr_subject on clonestore_pp_attributions(subject_user_id);

-- ── Événements d'attribution (APPEND-ONLY — historique inaltérable) ────────────
create table if not exists clonestore_pp_attribution_events (
  id             bigint generated always as identity primary key,
  attribution_id uuid references clonestore_pp_attributions(id) on delete cascade,
  partner_id     uuid not null references clonestore_pp_partners(id) on delete cascade,
  type           text not null check (type in (
                   'created','locked','revoked','superseded','conflict_detected',
                   'expired','admin_override_requested','admin_override_applied')),
  from_status    text,
  to_status      text,
  actor          text not null default 'system',
  reason         text,
  evidence_safe  jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now()
);
create index if not exists idx_pp_attr_evt_attr on clonestore_pp_attribution_events(attribution_id);
create index if not exists idx_pp_attr_evt_partner on clonestore_pp_attribution_events(partner_id, occurred_at);

-- ── Relation cabinet ↔ client (créée à la 1ʳᵉ facture payée) ──────────────────
create table if not exists clonestore_pp_customers (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  partner_id             uuid not null references clonestore_pp_partners(id) on delete restrict,
  attribution_id         uuid references clonestore_pp_attributions(id) on delete set null,
  subject_user_id        uuid not null,
  company_id             uuid,
  company_label          text,                  -- libellé minimal montré au cabinet (confidentialité)
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text not null default 'active'
                           check (status in ('active','past_due','canceled')),
  started_at             timestamptz not null default now(),
  ended_at               timestamptz
);
create unique index if not exists uq_pp_customer_subscription
  on clonestore_pp_customers(stripe_subscription_id) where stripe_subscription_id is not null;
-- Un client actif n'appartient qu'à UN cabinet.
create unique index if not exists uq_pp_customer_active_subject
  on clonestore_pp_customers(subject_user_id) where status in ('active','past_due');
create index if not exists idx_pp_customer_partner on clonestore_pp_customers(partner_id, status);

-- ── Indicateurs de risque EXPLICABLES (jamais un score opaque bloquant) ────────
create table if not exists clonestore_pp_risk_flags (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  partner_id    uuid references clonestore_pp_partners(id) on delete cascade,
  entity_type   text,                            -- attribution/application/entry/customer…
  entity_id     text,
  kind          text not null check (kind in (
                  'self_referral_suspected','same_account','shared_domain','duplicate_company',
                  'volume_spike','code_bruteforce','generic_email','attribution_conflict','manual')),
  severity      text not null default 'medium' check (severity in ('low','medium','high')),
  explanation   text not null,                   -- toujours explicable en clair
  evidence_safe jsonb not null default '{}'::jsonb,
  status        text not null default 'open'
                  check (status in ('open','reviewed_ok','confirmed','dismissed')),
  reviewed_by   text,
  reviewed_at   timestamptz,
  review_reason text
);
create index if not exists idx_pp_risk_partner on clonestore_pp_risk_flags(partner_id, created_at);
create index if not exists idx_pp_risk_status on clonestore_pp_risk_flags(status, severity);

-- ── Append-only structurel : triggers ─────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'clonestore_pp_referral_touches',
    'clonestore_pp_attribution_events'
  ] loop
    execute format('drop trigger if exists trg_%I_append_only on %I', t, t);
    execute format(
      'create trigger trg_%I_append_only before update or delete on %I
         for each row execute function clonestore_pp_forbid_mutation()', t, t);
  end loop;
end$$;

-- ── RLS forcée + grants (aucun DELETE accordé nulle part) ─────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'clonestore_pp_settings',
    'clonestore_pp_applications',
    'clonestore_pp_partners',
    'clonestore_pp_partner_codes',
    'clonestore_pp_referral_touches',
    'clonestore_pp_introductions',
    'clonestore_pp_attributions',
    'clonestore_pp_attribution_events',
    'clonestore_pp_customers',
    'clonestore_pp_risk_flags'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
  grant select, insert, update on clonestore_pp_settings           to pierre_rt_app;
  grant select, insert, update on clonestore_pp_applications       to pierre_rt_app;
  grant select, insert, update on clonestore_pp_partners           to pierre_rt_app;
  grant select, insert, update on clonestore_pp_partner_codes      to pierre_rt_app;
  grant select, insert         on clonestore_pp_referral_touches   to pierre_rt_app;
  grant select, insert, update on clonestore_pp_introductions      to pierre_rt_app;
  grant select, insert, update on clonestore_pp_attributions       to pierre_rt_app;
  grant select, insert         on clonestore_pp_attribution_events to pierre_rt_app;
  grant select, insert, update on clonestore_pp_customers          to pierre_rt_app;
  grant select, insert, update on clonestore_pp_risk_flags         to pierre_rt_app;
end$$;

-- Politiques. USING : service OU ligne du cabinet courant. CHECK : service uniquement.
drop policy if exists pp_settings_access on clonestore_pp_settings;
create policy pp_settings_access on clonestore_pp_settings for all
  using (nullif(current_setting('app.pp_service', true), '') = 'on')
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_app_access on clonestore_pp_applications;
create policy pp_app_access on clonestore_pp_applications for all
  using (nullif(current_setting('app.pp_service', true), '') = 'on')
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_partner_access on clonestore_pp_partners;
create policy pp_partner_access on clonestore_pp_partners for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_code_access on clonestore_pp_partner_codes;
create policy pp_code_access on clonestore_pp_partner_codes for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

-- Touches : service uniquement (contiennent des IP pseudonymisées).
drop policy if exists pp_touch_access on clonestore_pp_referral_touches;
create policy pp_touch_access on clonestore_pp_referral_touches for all
  using (nullif(current_setting('app.pp_service', true), '') = 'on')
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_intro_access on clonestore_pp_introductions;
create policy pp_intro_access on clonestore_pp_introductions for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_attr_access on clonestore_pp_attributions;
create policy pp_attr_access on clonestore_pp_attributions for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_attr_evt_access on clonestore_pp_attribution_events;
create policy pp_attr_evt_access on clonestore_pp_attribution_events for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_customer_access on clonestore_pp_customers;
create policy pp_customer_access on clonestore_pp_customers for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

-- Risk flags : service uniquement (revue interne, jamais montrés bruts au cabinet).
drop policy if exists pp_risk_access on clonestore_pp_risk_flags;
create policy pp_risk_access on clonestore_pp_risk_flags for all
  using (nullif(current_setting('app.pp_service', true), '') = 'on')
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');
