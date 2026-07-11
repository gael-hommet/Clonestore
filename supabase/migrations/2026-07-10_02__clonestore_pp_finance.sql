-- supabase/migrations/2026-07-10_02__clonestore_pp_finance.sql
-- PROGRAMME « CABINETS FONDATEURS » — couche financière (anti-corruption).
--
-- ADDITIF, IDEMPOTENT. Filtre migrator : clonestore_pp. ORDRE : après _01.
--
-- Principes structurels (imposés par la BASE, pas seulement par le code) :
--   • montants en UNITÉS MINEURES ENTIÈRES (bigint centimes), taux en basis points ;
--   • ledger de commissions : les colonnes financières sont IMMUABLES (trigger) et
--     la ligne est INDESTRUCTIBLE (delete interdit) — toute correction est une
--     NOUVELLE écriture compensatoire (entry_type='reversal'/'adjustment') ;
--   • un stripe_event_id ne peut produire qu'UNE conséquence financière
--     (contrainte unique) ; une facture n'a qu'UNE écriture 'commission' ;
--   • un transfert Stripe par (cabinet × période), clé d'idempotence unique ;
--   • une écriture ne peut être rattachée qu'à UN transfert non libéré ;
--   • ajustements manuels : DEUX validations distinctes (contrainte CHECK
--     approved_by <> requested_by) + raison obligatoire + audit append-only.

-- ── Ledger d'idempotence des événements Stripe du programme ───────────────────
create table if not exists clonestore_pp_stripe_events (
  id                 bigint generated always as identity primary key,
  stripe_event_id    text not null unique,
  type               text not null,
  livemode           boolean not null default false,
  object_id          text,
  processing_result  text not null default 'pending'
                       check (processing_result in ('pending','applied','ignored','duplicate','failed')),
  ignored_reason     text,
  error_safe         text,
  attempts           integer not null default 0,
  event_created_at   timestamptz,
  processed_at       timestamptz,
  evidence_safe      jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_pp_stripe_evt_result on clonestore_pp_stripe_events(processing_result, created_at);
create index if not exists idx_pp_stripe_evt_object on clonestore_pp_stripe_events(object_id) where object_id is not null;

-- ── Lots de versement (batch immuable du job mensuel) ─────────────────────────
create table if not exists clonestore_pp_payout_runs (
  id                  uuid primary key default gen_random_uuid(),
  run_key             text not null unique,       -- ex. pp-payout:2026-08 (verrou logique du job)
  dry_run             boolean not null default true,
  status              text not null default 'running'
                        check (status in ('running','completed','failed')),
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  partners_considered integer not null default 0,
  transfers_created   integer not null default 0,
  transfers_failed    integer not null default 0,
  total_amount_minor  bigint not null default 0,
  report_safe         jsonb not null default '{}'::jsonb,
  error_safe          text
);

-- ── Transferts Stripe Connect (un par cabinet × période) ──────────────────────
create table if not exists clonestore_pp_transfers (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  partner_id         uuid not null references clonestore_pp_partners(id) on delete restrict,
  payout_run_id      uuid references clonestore_pp_payout_runs(id) on delete set null,
  period_start       date not null,
  period_end         date not null,
  amount_minor       bigint not null check (amount_minor > 0),
  currency           text not null,
  entry_count        integer not null default 0,
  stripe_mode        text not null default 'test' check (stripe_mode in ('test','live')),

  status             text not null default 'created'
                       check (status in ('created','processing','paid','failed','released')),
  stripe_transfer_id text,
  idempotency_key    text not null unique,        -- pp-transfer:<partner>:<période>
  failure_code       text,
  failure_reason     text,
  paid_at            timestamptz,
  released_at        timestamptz,                 -- libération admin (double validation)
  released_reason    text
);
create unique index if not exists uq_pp_transfer_stripe_id
  on clonestore_pp_transfers(stripe_transfer_id) where stripe_transfer_id is not null;
-- Un seul transfert NON-libéré par cabinet et période (l'échec se retente sur la MÊME ligne).
create unique index if not exists uq_pp_transfer_partner_period
  on clonestore_pp_transfers(partner_id, period_start, period_end)
  where status in ('created','processing','paid','failed');
create index if not exists idx_pp_transfer_partner on clonestore_pp_transfers(partner_id, created_at);
create index if not exists idx_pp_transfer_status on clonestore_pp_transfers(status);

-- ── Ledger de commissions (écritures financières) ─────────────────────────────
create table if not exists clonestore_pp_commission_entries (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  partner_id             uuid not null references clonestore_pp_partners(id) on delete restrict,
  attribution_id         uuid references clonestore_pp_attributions(id) on delete set null,
  customer_id            uuid references clonestore_pp_customers(id) on delete set null,
  subject_user_id        uuid,
  company_id             uuid,

  stripe_customer_id     text,
  stripe_subscription_id text,
  stripe_invoice_id      text not null,
  stripe_payment_intent_id text,                  -- rattachement des remboursements (charge.refunded)
  stripe_event_id        text,                    -- null UNIQUEMENT pour un ajustement manuel approuvé
  stripe_mode            text not null default 'test' check (stripe_mode in ('test','live')),

  currency               text not null,
  invoice_total_minor    bigint not null default 0,   -- TTC (preuve)
  invoice_tax_minor      bigint not null default 0,
  eligible_net_minor     bigint not null,             -- delta de base HT nette (signé)
  rate_bps               integer not null check (rate_bps >= 0 and rate_bps <= 10000),
  commission_minor       bigint not null,             -- signé : négatif pour un reversal

  entry_type             text not null check (entry_type in ('commission','reversal','adjustment')),
  status                 text not null default 'pending'
                           check (status in ('pending','available','frozen','paid','void')),
  available_at           timestamptz not null,        -- created_at + reserve_days (réserve)
  frozen_reason          text,
  reversal_of_id         uuid references clonestore_pp_commission_entries(id) on delete restrict,
  approval_request_id    uuid,                        -- exigé pour entry_type='adjustment' (FK plus bas)
  reason                 text,
  evidence_safe          jsonb not null default '{}'::jsonb,

  constraint chk_pp_entry_adjustment_reason
    check (entry_type <> 'adjustment' or (reason is not null and approval_request_id is not null)),
  constraint chk_pp_entry_event_required
    check (entry_type = 'adjustment' or stripe_event_id is not null)
);
-- UN événement Stripe → UNE conséquence financière (anti double-crédit).
create unique index if not exists uq_pp_entry_event
  on clonestore_pp_commission_entries(stripe_event_id) where stripe_event_id is not null;
-- UNE écriture 'commission' par facture (les suivantes sont des reversals/ajustements).
create unique index if not exists uq_pp_entry_invoice_commission
  on clonestore_pp_commission_entries(stripe_invoice_id)
  where entry_type = 'commission' and status <> 'void';
create index if not exists idx_pp_entry_partner on clonestore_pp_commission_entries(partner_id, created_at);
create index if not exists idx_pp_entry_invoice on clonestore_pp_commission_entries(stripe_invoice_id);
create index if not exists idx_pp_entry_pi on clonestore_pp_commission_entries(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists idx_pp_entry_status on clonestore_pp_commission_entries(status, available_at);

-- Immuabilité financière STRUCTURELLE : les colonnes de montant/identité d'une
-- écriture ne changent JAMAIS après insertion ; seule la vie de l'écriture
-- (status, frozen_reason, evidence_safe, updated_at) évolue. DELETE interdit.
create or replace function clonestore_pp_entries_guard() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'ledger: suppression interdite sur %', tg_table_name
      using errcode = 'insufficient_privilege';
  end if;
  if new.partner_id             is distinct from old.partner_id
     or new.attribution_id      is distinct from old.attribution_id
     or new.subject_user_id     is distinct from old.subject_user_id
     or new.stripe_invoice_id   is distinct from old.stripe_invoice_id
     or new.stripe_event_id     is distinct from old.stripe_event_id
     or new.stripe_mode         is distinct from old.stripe_mode
     or new.currency            is distinct from old.currency
     or new.invoice_total_minor is distinct from old.invoice_total_minor
     or new.invoice_tax_minor   is distinct from old.invoice_tax_minor
     or new.eligible_net_minor  is distinct from old.eligible_net_minor
     or new.rate_bps            is distinct from old.rate_bps
     or new.commission_minor    is distinct from old.commission_minor
     or new.entry_type          is distinct from old.entry_type
     or new.reversal_of_id      is distinct from old.reversal_of_id
     or new.approval_request_id is distinct from old.approval_request_id
     or new.available_at        is distinct from old.available_at
     or new.created_at          is distinct from old.created_at
  then
    raise exception 'ledger: colonne financière immuable sur %', tg_table_name
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$fn$;
revoke execute on function clonestore_pp_entries_guard() from public;

drop trigger if exists trg_pp_entries_guard on clonestore_pp_commission_entries;
create trigger trg_pp_entries_guard
  before update or delete on clonestore_pp_commission_entries
  for each row execute function clonestore_pp_entries_guard();

-- ── Événements de commission (APPEND-ONLY — trace de chaque transition) ───────
create table if not exists clonestore_pp_commission_events (
  id            bigint generated always as identity primary key,
  entry_id      uuid references clonestore_pp_commission_entries(id) on delete restrict,
  partner_id    uuid not null references clonestore_pp_partners(id) on delete restrict,
  type          text not null check (type in (
                  'commission_recorded','reversal_recorded','adjustment_recorded',
                  'entry_available','entry_frozen','entry_unfrozen','entry_paid','entry_voided',
                  'transfer_created','transfer_paid','transfer_failed','transfer_released',
                  'reconciliation','conflict_detected','manual_review_required')),
  from_status   text,
  to_status     text,
  actor         text not null default 'system',
  reason        text,
  evidence_safe jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);
create index if not exists idx_pp_centry_evt_entry on clonestore_pp_commission_events(entry_id);
create index if not exists idx_pp_centry_evt_partner on clonestore_pp_commission_events(partner_id, occurred_at);

-- ── Rattachement écriture ↔ transfert ─────────────────────────────────────────
create table if not exists clonestore_pp_transfer_items (
  id           bigint generated always as identity primary key,
  transfer_id  uuid not null references clonestore_pp_transfers(id) on delete restrict,
  partner_id   uuid not null references clonestore_pp_partners(id) on delete restrict,
  entry_id     uuid not null references clonestore_pp_commission_entries(id) on delete restrict,
  amount_minor bigint not null,
  created_at   timestamptz not null default now(),
  released_at  timestamptz
);
-- Une écriture n'est rattachée qu'à UN transfert vivant (anti double-paiement).
create unique index if not exists uq_pp_item_entry_live
  on clonestore_pp_transfer_items(entry_id) where released_at is null;
create index if not exists idx_pp_item_transfer on clonestore_pp_transfer_items(transfer_id);

-- ── Demandes d'approbation (séparation demande/approbation/exécution) ─────────
create table if not exists clonestore_pp_approval_requests (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  action_kind           text not null check (action_kind in (
                          'manual_attribution','attribution_revocation',
                          'financial_adjustment','transfer_release')),
  entity_type           text,
  entity_id             text,
  payload_safe          jsonb not null default '{}'::jsonb,
  requested_by          text not null,
  reason                text not null,

  status                text not null default 'pending'
                          check (status in ('pending','approved','rejected','executed','expired','canceled')),
  approved_by           text,
  approved_at           timestamptz,
  rejected_by           text,
  rejected_at           timestamptz,
  rejection_reason      text,
  executed_at           timestamptz,
  executed_by           text,
  execution_result_safe jsonb,

  -- DOUBLE VALIDATION structurelle : l'approbateur n'est JAMAIS le demandeur.
  constraint chk_pp_approval_two_actors
    check (approved_by is null or approved_by <> requested_by)
);
create index if not exists idx_pp_approval_status on clonestore_pp_approval_requests(status, created_at);

-- FK écriture d'ajustement → demande approuvée (après coup, idempotente).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fk_pp_entry_approval') then
    alter table clonestore_pp_commission_entries
      add constraint fk_pp_entry_approval
      foreign key (approval_request_id) references clonestore_pp_approval_requests(id) on delete restrict;
  end if;
end$$;

-- ── Journal administrateur (APPEND-ONLY) ──────────────────────────────────────
create table if not exists clonestore_pp_admin_audit (
  id          bigint generated always as identity primary key,
  actor       text not null,
  action      text not null,
  entity_type text,
  entity_id   text,
  reason      text not null,               -- toujours exigée
  prev_state  jsonb,
  new_state   jsonb,
  request_id  text,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_pp_audit_entity on clonestore_pp_admin_audit(entity_type, entity_id);
create index if not exists idx_pp_audit_time on clonestore_pp_admin_audit(occurred_at);

-- ── Append-only structurel ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'clonestore_pp_commission_events',
    'clonestore_pp_admin_audit'
  ] loop
    execute format('drop trigger if exists trg_%I_append_only on %I', t, t);
    execute format(
      'create trigger trg_%I_append_only before update or delete on %I
         for each row execute function clonestore_pp_forbid_mutation()', t, t);
  end loop;
end$$;

-- ── RLS forcée + grants (aucun DELETE) ────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'clonestore_pp_stripe_events',
    'clonestore_pp_payout_runs',
    'clonestore_pp_transfers',
    'clonestore_pp_commission_entries',
    'clonestore_pp_commission_events',
    'clonestore_pp_transfer_items',
    'clonestore_pp_approval_requests',
    'clonestore_pp_admin_audit'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
  grant select, insert, update on clonestore_pp_stripe_events      to pierre_rt_app;
  grant select, insert, update on clonestore_pp_payout_runs        to pierre_rt_app;
  grant select, insert, update on clonestore_pp_transfers          to pierre_rt_app;
  grant select, insert, update on clonestore_pp_commission_entries to pierre_rt_app;
  grant select, insert         on clonestore_pp_commission_events  to pierre_rt_app;
  grant select, insert, update on clonestore_pp_transfer_items     to pierre_rt_app;
  grant select, insert, update on clonestore_pp_approval_requests  to pierre_rt_app;
  grant select, insert         on clonestore_pp_admin_audit        to pierre_rt_app;
end$$;

-- Service uniquement : ledger Stripe, runs, approbations, audit.
drop policy if exists pp_stripe_evt_access on clonestore_pp_stripe_events;
create policy pp_stripe_evt_access on clonestore_pp_stripe_events for all
  using (nullif(current_setting('app.pp_service', true), '') = 'on')
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_payout_run_access on clonestore_pp_payout_runs;
create policy pp_payout_run_access on clonestore_pp_payout_runs for all
  using (nullif(current_setting('app.pp_service', true), '') = 'on')
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_approval_access on clonestore_pp_approval_requests;
create policy pp_approval_access on clonestore_pp_approval_requests for all
  using (nullif(current_setting('app.pp_service', true), '') = 'on')
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_audit_access on clonestore_pp_admin_audit;
create policy pp_audit_access on clonestore_pp_admin_audit for all
  using (nullif(current_setting('app.pp_service', true), '') = 'on')
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

-- Service complet OU lecture par le cabinet de SES propres lignes.
drop policy if exists pp_transfer_access on clonestore_pp_transfers;
create policy pp_transfer_access on clonestore_pp_transfers for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_entry_access on clonestore_pp_commission_entries;
create policy pp_entry_access on clonestore_pp_commission_entries for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_centry_evt_access on clonestore_pp_commission_events;
create policy pp_centry_evt_access on clonestore_pp_commission_events for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

drop policy if exists pp_item_access on clonestore_pp_transfer_items;
create policy pp_item_access on clonestore_pp_transfer_items for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');
