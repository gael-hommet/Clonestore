-- supabase/migrations/2026-06-19__clonestore_founder_access_hardening.sql
-- PHASE E — Hardening de Founder Access. Idempotent. S'applique APRÈS
-- 2026-06-19__clonestore_founder_access.sql (tri lexical : "_access.sql" < "_access_hardening.sql").
--
-- Corrige et durcit :
--   §3.2  funnel + audit + web_events + stripe_events RÉELLEMENT append-only
--         (REVOKE update/delete + triggers DB qui refusent UPDATE/DELETE) ;
--   §3.5  relation commerciale persistée (contact_status, contacted_at, …) ;
--   §3.6  rate limiting distribué (table partagée, fenêtré, atomique) ;
--   §4.5  anti-bruteforce de la porte propriétaire (réutilise la table de rate limit) ;
--   §6.3  journal append-only des événements Stripe (vérité d'activation) + idempotence.
--
-- Aucune donnée détruite. Aucune colonne supprimée. Aucun DROP de table.

-- ── §3.5 — Relation commerciale réelle sur les réservations ──────────────────
alter table clonestore_founder_reservations
  add column if not exists contact_status   text not null default 'not_requested'
    check (contact_status in ('not_requested','requested','to_contact','contacted','follow_up','converted','closed'));
alter table clonestore_founder_reservations add column if not exists contacted_at      timestamptz;
alter table clonestore_founder_reservations add column if not exists contacted_by      text;
alter table clonestore_founder_reservations add column if not exists next_followup_at  timestamptz;
alter table clonestore_founder_reservations add column if not exists last_contact_note text;
create index if not exists idx_founder_reservation_contact_status on clonestore_founder_reservations(contact_status);
create index if not exists idx_founder_reservation_followup on clonestore_founder_reservations(next_followup_at)
  where next_followup_at is not null;

-- ── §3.6 — Rate limiting distribué (fenêtre glissante atomique) ──────────────
create table if not exists clonestore_rate_limits (
  bucket_key  text primary key,
  count       integer not null default 0,
  window_ms   integer not null,
  expires_at  timestamptz not null,
  updated_at  timestamptz not null default now()
);
create index if not exists idx_rate_limits_expiry on clonestore_rate_limits(expires_at);

-- ── §6.3 — Journal append-only des événements Stripe (idempotent par event_id) ─
create table if not exists clonestore_founder_stripe_events (
  id              bigint generated always as identity primary key,
  stripe_event_id text unique,
  event_type      text not null,
  reservation_id  uuid references clonestore_founder_reservations(id) on delete set null,
  subscription_id text,
  customer_id     text,
  amount_cents    integer,
  currency        text,
  occurred_at     timestamptz not null default now(),
  payload_safe    jsonb not null default '{}'::jsonb
);
create index if not exists idx_founder_stripe_events_res on clonestore_founder_stripe_events(reservation_id);
create index if not exists idx_founder_stripe_events_sub on clonestore_founder_stripe_events(subscription_id);
create index if not exists idx_founder_stripe_events_time on clonestore_founder_stripe_events(occurred_at desc);

-- ── §3.2 — Application STRUCTURELLE de l'append-only ─────────────────────────
-- Fonction trigger refusant toute mutation/suppression. search_path fixe.
create or replace function clonestore_forbid_mutation() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
as $fn$
begin
  raise exception 'append-only: % interdit sur %', tg_op, tg_table_name
    using errcode = 'insufficient_privilege';
end;
$fn$;
revoke execute on function clonestore_forbid_mutation() from public;

do $$
declare t text;
begin
  foreach t in array array[
    'clonestore_founder_funnel_events',
    'clonestore_founder_admin_audit',
    'clonestore_web_events',
    'clonestore_founder_stripe_events'
  ] loop
    -- 1) Retirer toute capacité de mutation au rôle applicatif (insert + lecture seulement).
    execute format('revoke update, delete on %I from pierre_rt_app', t);
    -- 2) Garde DB infranchissable, même pour un futur grant erroné.
    execute format('drop trigger if exists trg_%I_append_only on %I', t, t);
    execute format(
      'create trigger trg_%I_append_only before update or delete on %I
         for each row execute function clonestore_forbid_mutation()', t, t);
  end loop;
end$$;

-- ── RLS + grants des nouvelles tables ────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    create role pierre_rt_app nologin;
  end if;
end$$;

do $$ begin
  -- rate_limits : le rôle applicatif lit/écrit/purge.
  execute 'alter table clonestore_rate_limits enable row level security';
  execute 'alter table clonestore_rate_limits force row level security';
  execute 'grant select, insert, update, delete on clonestore_rate_limits to pierre_rt_app';
  execute 'drop policy if exists rl_app on clonestore_rate_limits';
  execute 'create policy rl_app on clonestore_rate_limits to pierre_rt_app using (true) with check (true)';

  -- stripe_events : append-only → insert + select uniquement.
  execute 'alter table clonestore_founder_stripe_events enable row level security';
  execute 'alter table clonestore_founder_stripe_events force row level security';
  execute 'grant select, insert on clonestore_founder_stripe_events to pierre_rt_app';
  execute 'drop policy if exists se_app on clonestore_founder_stripe_events';
  execute 'create policy se_app on clonestore_founder_stripe_events to pierre_rt_app using (true) with check (true)';
end$$;
