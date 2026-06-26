-- supabase/migrations/2026-06-26_07__clonestory_fp_commercial_contributions.sql
-- CLONESTORY — CS-FINAL 3 : contribution commerciale vérifiée (paiement → activation → preuve).
--
-- ADDITIF, IDEMPOTENT, NON destructif. PostgreSQL 17 / PGlite compatible.
-- Filtre migrator : clonestory_fp. ORDRE : après _05 et _06.
-- Transforme une attribution durable (compte/entreprise → partenaire) en CONTRIBUTION
-- COMMERCIALE prouvée par une source serveur autoritative (webhook Stripe signé) :
--   attribution → commande → paiement confirmé → produit activé → validation → vérifiée.
--
-- N'invente AUCUNE commission, AUCUN payout, AUCUN crédit. La preuve du paiement vient
-- exclusivement d'événements Stripe signés (jamais du navigateur, jamais d'une page /success).
-- Montants en UNITÉS MINEURES ENTIÈRES (centimes) — aucun float financier.
--
-- ACTIVATION PRODUCTION (contrôlée, séparée — NON appliquée par ce bloc) :
--   MIGRATIONS_FILTER=clonestory_fp DATABASE_URL="<prod>" npm run db:migrate:pg
-- ROLLBACK :
--   drop table if exists clonestory_fp_commercial_outbox;
--   drop table if exists clonestory_fp_commercial_events;
--   drop table if exists clonestory_fp_commercial_contributions;
--   drop table if exists clonestory_fp_stripe_events;

-- 1) LEDGER d'idempotence des événements Stripe (propre à CloneStory ; jamais couplé à
--    la base fondateur dédiée). Unique par stripe_event_id → aucun double traitement sur
--    retry Stripe. AUCUN secret, AUCUNE donnée bancaire, AUCUN e-mail prospect en clair.
create table if not exists clonestory_fp_stripe_events (
  id                 bigint generated always as identity primary key,
  stripe_event_id    text not null unique,
  type               text not null,
  livemode           boolean not null default false,
  object_id          text,                      -- subscription/invoice/charge id (non sensible)
  processing_result  text not null default 'pending'
                       check (processing_result in ('pending','applied','ignored','duplicate','failed')),
  ignored_reason     text,
  attempts           integer not null default 0,
  event_created_at   timestamptz,
  processed_at       timestamptz,
  evidence_safe      jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_csy_stripe_evt_result on clonestory_fp_stripe_events(processing_result, created_at);
create index if not exists idx_csy_stripe_evt_object on clonestory_fp_stripe_events(object_id) where object_id is not null;

-- 2) CONTRIBUTION COMMERCIALE — une par abonnement (commande Stripe). État autoritatif.
create table if not exists clonestory_fp_commercial_contributions (
  id                       uuid primary key default gen_random_uuid(),
  attribution_id           uuid references clonestory_fp_attributions(id) on delete set null,
  partner_id               uuid not null references clonestory_fp_partners(id) on delete cascade,
  introduction_id          uuid references clonestory_fp_introductions(id) on delete set null,
  account_user_id          uuid,                -- compte du PROSPECT (≠ compte partenaire)
  company_id               uuid,                -- futur : entité entreprise réelle (aucune FK)
  company_fingerprint      text,
  order_ref                text,                -- repère stable de commande ("<user_id>:<agent_slug>")
  product_slug             text,                -- agent acheté (pierre, …)
  stripe_mode              text not null default 'test' check (stripe_mode in ('test','live')),
  stripe_customer_id       text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id        text,
  stripe_subscription_id   text,
  currency                 text,
  gross_amount             bigint not null default 0,   -- centimes (unités mineures). JAMAIS de float.
  refunded_amount          bigint not null default 0,
  net_amount               bigint not null default 0,
  status                   text not null default 'activation_pending'
                             check (status in (
                               'activation_pending','purchase_captured','activation_completed',
                               'validation_pending','verified',
                               'refunded','canceled','disputed','invalidated')),
  verified_active          boolean not null default false,  -- compte pour les distinctions UNIQUEMENT si vérifiée ET active
  purchase_captured_at     timestamptz,
  activation_completed_at  timestamptz,
  validation_started_at    timestamptz,
  verified_at              timestamptz,
  refunded_at              timestamptz,
  disputed_at              timestamptz,
  canceled_at              timestamptz,
  invalidated_at           timestamptz,
  decision_reason          text,
  evidence_safe            jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
-- UNE seule contribution par abonnement Stripe (anti-doublon sur retry / renouvellement).
create unique index if not exists uq_csy_cc_subscription
  on clonestory_fp_commercial_contributions(stripe_subscription_id)
  where stripe_subscription_id is not null;
-- À défaut d'abonnement (futur paiement unique) : une par session de paiement.
create unique index if not exists uq_csy_cc_checkout_session
  on clonestory_fp_commercial_contributions(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null and stripe_subscription_id is null;
create index if not exists idx_csy_cc_partner on clonestory_fp_commercial_contributions(partner_id, created_at);
create index if not exists idx_csy_cc_account on clonestory_fp_commercial_contributions(account_user_id) where account_user_id is not null;
create index if not exists idx_csy_cc_attribution on clonestory_fp_commercial_contributions(attribution_id) where attribution_id is not null;
create index if not exists idx_csy_cc_status on clonestory_fp_commercial_contributions(status, validation_started_at);
create index if not exists idx_csy_cc_verified_active on clonestory_fp_commercial_contributions(partner_id) where status = 'verified' and verified_active;

-- 3) ÉVÉNEMENTS commerciaux (APPEND-ONLY). Trace inaltérable de la machine d'états.
create table if not exists clonestory_fp_commercial_events (
  id              bigint generated always as identity primary key,
  contribution_id uuid references clonestory_fp_commercial_contributions(id) on delete cascade,
  partner_id      uuid not null references clonestory_fp_partners(id) on delete cascade,
  type            text not null check (type in (
                    'purchase_captured','activation_completed','validation_started','contribution_verified',
                    'refund_recorded','refund_full','dispute_opened','dispute_closed','contribution_canceled',
                    'contribution_invalidated','renewal_recorded','reconciliation','conflict_detected',
                    'manual_review_required','founding_partner_promoted','registry_number_allocated',
                    'distinction_awarded','distinction_revoked')),
  from_status     text,
  to_status       text,
  reason          text,
  evidence_safe   jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now()
);
create index if not exists idx_csy_cc_evt_partner on clonestory_fp_commercial_events(partner_id, occurred_at);
create index if not exists idx_csy_cc_evt_contrib on clonestory_fp_commercial_events(contribution_id);

drop trigger if exists trg_clonestory_fp_commercial_events_append_only on clonestory_fp_commercial_events;
create trigger trg_clonestory_fp_commercial_events_append_only
  before update or delete on clonestory_fp_commercial_events
  for each row execute function clonestory_forbid_mutation();

-- 4) OUTBOX des notifications commerciales (robuste, ISOLÉE de l'outbox de vérification —
--    aucune fragilisation de l'existant). Idempotente, retry à backoff, provider_message_id.
create table if not exists clonestory_fp_commercial_outbox (
  id               bigint generated always as identity primary key,
  partner_id       uuid not null references clonestory_fp_partners(id) on delete cascade,
  contribution_id  uuid references clonestory_fp_commercial_contributions(id) on delete set null,
  kind             text not null check (kind in (
                     'client_paid','activation_completed','validation_pending',
                     'contribution_verified','contribution_refunded','contribution_disputed','distinction_awarded')),
  idempotency_key  text not null unique,
  status           text not null default 'pending'
                     check (status in ('pending','sending','sent','failed_retryable','dead','superseded')),
  attempts         integer not null default 0,
  max_attempts     integer not null default 6,
  to_email         text not null,
  subject          text not null,
  payload_safe     jsonb not null default '{}'::jsonb,   -- données de rendu (registryUrl…), AUCUN secret
  last_error       text,
  provider_message_id text,
  next_attempt_at  timestamptz not null default now(),
  locked_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_csy_cc_outbox_due on clonestory_fp_commercial_outbox(status, next_attempt_at);

-- RLS FORCÉE + grants applicatifs (rôle non-superuser). Aucun DELETE accordé nulle part.
do $$ begin
  alter table clonestory_fp_stripe_events              enable row level security;
  alter table clonestory_fp_stripe_events              force  row level security;
  alter table clonestory_fp_commercial_contributions   enable row level security;
  alter table clonestory_fp_commercial_contributions   force  row level security;
  alter table clonestory_fp_commercial_events          enable row level security;
  alter table clonestory_fp_commercial_events          force  row level security;
  alter table clonestory_fp_commercial_outbox          enable row level security;
  alter table clonestory_fp_commercial_outbox          force  row level security;
  grant select, insert, update on clonestory_fp_stripe_events            to pierre_rt_app;
  grant select, insert, update on clonestory_fp_commercial_contributions to pierre_rt_app;
  grant select, insert         on clonestory_fp_commercial_events        to pierre_rt_app;
  grant select, insert, update on clonestory_fp_commercial_outbox        to pierre_rt_app;
end $$;

-- Ledger Stripe + outbox : SERVICE uniquement (jamais le partenaire, jamais le prospect).
drop policy if exists csy_stripe_evt_access on clonestory_fp_stripe_events;
create policy csy_stripe_evt_access on clonestory_fp_stripe_events for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_cc_outbox_access on clonestory_fp_commercial_outbox;
create policy csy_cc_outbox_access on clonestory_fp_commercial_outbox for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

-- Contributions + événements : SERVICE complet, OU le PARTENAIRE lit ses propres lignes
-- (jamais le prospect ; jamais un autre partenaire). Écriture réservée au SERVICE.
drop policy if exists csy_cc_access on clonestory_fp_commercial_contributions;
create policy csy_cc_access on clonestory_fp_commercial_contributions for all
  using (
    nullif(current_setting('app.clonestory_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.clonestory_partner', true), '')
  )
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_cc_evt_access on clonestory_fp_commercial_events;
create policy csy_cc_evt_access on clonestory_fp_commercial_events for all
  using (
    nullif(current_setting('app.clonestory_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.clonestory_partner', true), '')
  )
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');
