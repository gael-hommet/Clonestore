-- supabase/migrations/2026-06-26_08__clonestory_fp_hardening_admin_compliance.sql
-- CLONESTORY — CS-FINAL 4 : durcissement, administration, conformité, observabilité.
--
-- ADDITIF, IDEMPOTENT, NON destructif. PostgreSQL 17 / PGlite compatible.
-- Filtre migrator : clonestory_fp. ORDRE : après _05, _06, _07.
-- Apporte les fondations de la clôture production :
--   1. confirm_generation (token de confirmation d'introduction STATELESS, révocable) ;
--   2. outbox de notifications GÉNÉRALE (tous les emails transactionnels non-vérification :
--      robuste, idempotente, retry/backoff, provider_message_id — fini l'envoi direct avalé) ;
--   3. observabilité structurée (événements techniques append-only, sans PII/secret) ;
--   4. notes admin, décisions antifraude, consentements/versions légales (append-only) ;
--   5. métadonnées d'anonymisation RGPD (jamais de DELETE — marquage anonymized_at).
--
-- ACTIVATION PRODUCTION (contrôlée, séparée — NON appliquée par ce bloc) :
--   MIGRATIONS_FILTER=clonestory_fp DATABASE_URL="<prod>" npm run db:migrate:pg
-- ROLLBACK :
--   drop table if exists clonestory_fp_consents;
--   drop table if exists clonestory_fp_fraud_decisions;
--   drop table if exists clonestory_fp_admin_notes;
--   drop table if exists clonestory_fp_observability_events;
--   drop table if exists clonestory_fp_notifications_outbox;
--   alter table clonestory_fp_introductions drop column if exists confirm_generation;
--   alter table clonestory_fp_introductions drop column if exists anonymized_at;
--   alter table clonestory_fp_partners      drop column if exists anonymized_at;

-- 1) Token de confirmation d'introduction STATELESS (révocable par génération).
alter table clonestory_fp_introductions add column if not exists confirm_generation integer not null default 1;
alter table clonestory_fp_introductions add column if not exists anonymized_at timestamptz;
alter table clonestory_fp_partners       add column if not exists anonymized_at timestamptz;

-- 2) OUTBOX de notifications GÉNÉRALE (robuste). N'altère PAS les outboxes existantes
--    (vérification partenaire, commerciale) : elle les COMPLÈTE pour tous les autres emails.
--    payload_safe NE contient JAMAIS de token brut (le worker reconstruit les liens).
create table if not exists clonestory_fp_notifications_outbox (
  id               bigint generated always as identity primary key,
  partner_id       uuid references clonestory_fp_partners(id) on delete cascade,
  introduction_id  uuid references clonestory_fp_introductions(id) on delete set null,
  kind             text not null check (kind in (
                     'intro_confirm','intro_confirmed_member','intro_refused_member','welcome',
                     'partner_suspended','partner_reinstated','partner_withdrawn','link_revoked')),
  idempotency_key  text not null unique,
  status           text not null default 'pending'
                     check (status in ('pending','sending','sent','failed_retryable','dead','superseded')),
  attempts         integer not null default 0,
  max_attempts     integer not null default 6,
  to_email         text not null,
  payload_safe     jsonb not null default '{}'::jsonb,   -- params de rendu (nom, masque…), AUCUN token brut
  last_error       text,
  provider_message_id text,
  next_attempt_at  timestamptz not null default now(),
  locked_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_csy_notif_due on clonestory_fp_notifications_outbox(status, next_attempt_at);
create index if not exists idx_csy_notif_partner on clonestory_fp_notifications_outbox(partner_id);

-- 3) OBSERVABILITÉ structurée (append-only). Aucune PII en clair, aucun token, aucun secret.
create table if not exists clonestory_fp_observability_events (
  id            bigint generated always as identity primary key,
  kind          text not null,
  ref_type      text,            -- 'partner' | 'introduction' | 'attribution' | 'contribution' | 'stripe_event' | 'email' | 'admin' | 'cron'
  ref_id        text,            -- identifiant non sensible (uuid masqué côté lecture)
  level         text not null default 'info' check (level in ('debug','info','warn','error')),
  message_safe  text,
  evidence_safe jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);
create index if not exists idx_csy_obs_kind on clonestory_fp_observability_events(kind, occurred_at);
create index if not exists idx_csy_obs_level on clonestory_fp_observability_events(level, occurred_at) where level in ('warn','error');
create index if not exists idx_csy_obs_ref on clonestory_fp_observability_events(ref_type, ref_id);

drop trigger if exists trg_clonestory_fp_observability_append_only on clonestory_fp_observability_events;
create trigger trg_clonestory_fp_observability_append_only
  before update or delete on clonestory_fp_observability_events
  for each row execute function clonestory_forbid_mutation();

-- 4) NOTES ADMIN (append-only ; jamais de donnée bancaire).
create table if not exists clonestory_fp_admin_notes (
  id          bigint generated always as identity primary key,
  partner_id  uuid not null references clonestory_fp_partners(id) on delete cascade,
  author      text not null,
  note        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_csy_admin_notes_partner on clonestory_fp_admin_notes(partner_id, created_at);
drop trigger if exists trg_clonestory_fp_admin_notes_append_only on clonestory_fp_admin_notes;
create trigger trg_clonestory_fp_admin_notes_append_only
  before update or delete on clonestory_fp_admin_notes
  for each row execute function clonestory_forbid_mutation();

-- 5) DÉCISIONS ANTIFRAUDE (append-only). allow | review | block + motif + preuves sûres.
create table if not exists clonestory_fp_fraud_decisions (
  id            bigint generated always as identity primary key,
  subject_type  text not null check (subject_type in ('registration','introduction','attribution','contribution','link')),
  subject_id    text,
  decision      text not null check (decision in ('allow','review','block')),
  reason        text not null,
  evidence_safe jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);
create index if not exists idx_csy_fraud_subject on clonestory_fp_fraud_decisions(subject_type, subject_id);
create index if not exists idx_csy_fraud_decision on clonestory_fp_fraud_decisions(decision, occurred_at);
drop trigger if exists trg_clonestory_fp_fraud_append_only on clonestory_fp_fraud_decisions;
create trigger trg_clonestory_fp_fraud_append_only
  before update or delete on clonestory_fp_fraud_decisions
  for each row execute function clonestory_forbid_mutation();

-- 6) CONSENTEMENTS / versions légales acceptées (append-only).
create table if not exists clonestory_fp_consents (
  id            bigint generated always as identity primary key,
  partner_id    uuid references clonestory_fp_partners(id) on delete cascade,
  kind          text not null check (kind in ('partner_terms','prospect_notice')),
  version       text not null,
  accepted_at   timestamptz not null default now(),
  evidence_safe jsonb not null default '{}'::jsonb
);
create index if not exists idx_csy_consents_partner on clonestory_fp_consents(partner_id, kind);
drop trigger if exists trg_clonestory_fp_consents_append_only on clonestory_fp_consents;
create trigger trg_clonestory_fp_consents_append_only
  before update or delete on clonestory_fp_consents
  for each row execute function clonestory_forbid_mutation();

-- RLS FORCÉE + grants applicatifs. SERVICE seulement (jamais le partenaire/prospect).
-- Aucun DELETE accordé nulle part.
do $$ begin
  alter table clonestory_fp_notifications_outbox   enable row level security;
  alter table clonestory_fp_notifications_outbox   force  row level security;
  alter table clonestory_fp_observability_events   enable row level security;
  alter table clonestory_fp_observability_events   force  row level security;
  alter table clonestory_fp_admin_notes            enable row level security;
  alter table clonestory_fp_admin_notes            force  row level security;
  alter table clonestory_fp_fraud_decisions        enable row level security;
  alter table clonestory_fp_fraud_decisions        force  row level security;
  alter table clonestory_fp_consents               enable row level security;
  alter table clonestory_fp_consents               force  row level security;
  grant select, insert, update on clonestory_fp_notifications_outbox to pierre_rt_app;
  grant select, insert         on clonestory_fp_observability_events to pierre_rt_app;
  grant select, insert         on clonestory_fp_admin_notes          to pierre_rt_app;
  grant select, insert         on clonestory_fp_fraud_decisions      to pierre_rt_app;
  grant select, insert         on clonestory_fp_consents             to pierre_rt_app;
end $$;

drop policy if exists csy_notif_service on clonestory_fp_notifications_outbox;
create policy csy_notif_service on clonestory_fp_notifications_outbox for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_obs_service on clonestory_fp_observability_events;
create policy csy_obs_service on clonestory_fp_observability_events for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_admin_notes_service on clonestory_fp_admin_notes;
create policy csy_admin_notes_service on clonestory_fp_admin_notes for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_fraud_service on clonestory_fp_fraud_decisions;
create policy csy_fraud_service on clonestory_fp_fraud_decisions for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_consents_service on clonestory_fp_consents;
create policy csy_consents_service on clonestory_fp_consents for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');
