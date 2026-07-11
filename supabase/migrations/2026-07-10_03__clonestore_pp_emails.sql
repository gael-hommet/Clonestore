-- supabase/migrations/2026-07-10_03__clonestore_pp_emails.sql
-- PROGRAMME « CABINETS FONDATEURS » — outbox d'emails transactionnelle.
-- ADDITIF, IDEMPOTENT. Filtre migrator : clonestore_pp. ORDRE : après _02.
-- Même pattern éprouvé que clonestory_fp_commercial_outbox : enqueue dans la MÊME transaction
-- que la mutation métier, worker claim FOR UPDATE SKIP LOCKED, backoff, dead-letter.
-- RLS FORCÉE, service uniquement. Aucun secret/token brut dans payload_safe.

create table if not exists clonestore_pp_email_outbox (
  id               bigint generated always as identity primary key,
  partner_id       uuid references clonestore_pp_partners(id) on delete set null,
  application_id   uuid references clonestore_pp_applications(id) on delete set null,
  kind             text not null check (kind in (
                     'application_received','application_accepted','application_rejected',
                     'contract_pending','stripe_onboarding_pending','partner_activated',
                     'introduction_received','client_converted','client_active',
                     'commission_recorded','commission_available','monthly_statement',
                     'transfer_executed','transfer_failed','partner_suspended')),
  idempotency_key  text not null unique,
  status           text not null default 'pending'
                     check (status in ('pending','sending','sent','failed_retryable','dead','superseded')),
  attempts         integer not null default 0,
  max_attempts     integer not null default 6,
  to_email         text not null,
  subject          text not null,
  payload_safe     jsonb not null default '{}'::jsonb,
  last_error       text,
  provider_message_id text,
  next_attempt_at  timestamptz not null default now(),
  locked_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_pp_email_due on clonestore_pp_email_outbox(status, next_attempt_at);

alter table clonestore_pp_email_outbox enable row level security;
alter table clonestore_pp_email_outbox force  row level security;
grant select, insert, update on clonestore_pp_email_outbox to pierre_rt_app;

drop policy if exists pp_email_access on clonestore_pp_email_outbox;
create policy pp_email_access on clonestore_pp_email_outbox for all
  using (nullif(current_setting('app.pp_service', true), '') = 'on')
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');
