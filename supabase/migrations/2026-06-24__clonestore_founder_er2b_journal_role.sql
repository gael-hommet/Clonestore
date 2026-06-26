-- supabase/migrations/2026-06-24__clonestore_founder_er2b_journal_role.sql
-- PHASE E-R2 §3 — journal Stripe RÉELLEMENT non falsifiable. Idempotent.
--
-- Le rôle applicatif général (pierre_rt_app) ne doit pas pouvoir fabriquer un faux
-- événement Stripe. On retire son EXECUTE sur la fonction de journalisation et on
-- réserve l'écriture à un rôle webhook DÉDIÉ (clonestore_stripe_webhook_writer).
-- La connexion runtime du webhook doit être membre de ce rôle (ou propriétaire de la
-- fonction). Une route métier sous pierre_rt_app ne peut ni INSERT, ni UPDATE, ni
-- DELETE, ni EXECUTE la fonction → aucune forge possible.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'clonestore_stripe_webhook_writer') then
    create role clonestore_stripe_webhook_writer nologin;
  end if;
end $$;

-- §4 (E-R2 reprise) — la fonction VALIDE le payload : event_id non vide, type
-- allowlisté, processing_result allowlisté. Un faux type/résultat est rejeté.
create or replace function clonestore_record_founder_stripe_event(p jsonb)
  returns bigint
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $fn$
declare new_id bigint;
begin
  if coalesce(p->>'stripe_event_id','') = '' then
    raise exception 'stripe_event_id requis' using errcode = 'check_violation';
  end if;
  if (p->>'event_type') not in (
    'checkout.session.completed','customer.subscription.created','customer.subscription.updated',
    'customer.subscription.deleted','invoice.paid','invoice.payment_failed') then
    raise exception 'event_type non autorisé: %', p->>'event_type' using errcode = 'check_violation';
  end if;
  if (p->>'processing_result') not in (
    'applied','no_reservation','reservation_missing','ignored_stale','ignored_same_order',
    'ignored_terminal_precedence','unsupported','proof_failed') then
    raise exception 'processing_result non autorisé: %', p->>'processing_result' using errcode = 'check_violation';
  end if;

  insert into public.clonestore_founder_stripe_events
    (stripe_event_id, event_type, event_created_at, livemode, api_version, reservation_id,
     subscription_id, customer_id, amount_cents, currency, processing_result, ignored_reason, payload_safe)
  values (
    p->>'stripe_event_id', p->>'event_type', nullif(p->>'event_created_at','')::timestamptz,
    nullif(p->>'livemode','')::boolean, p->>'api_version', nullif(p->>'reservation_id','')::uuid,
    p->>'subscription_id', p->>'customer_id', nullif(p->>'amount_cents','')::int, p->>'currency',
    p->>'processing_result', p->>'ignored_reason', coalesce(p->'payload_safe','{}'::jsonb))
  on conflict (stripe_event_id) do nothing
  returning id into new_id;
  return new_id;
end
$fn$;

-- EXECUTE de la fonction : RETIRÉ au rôle applicatif général et à PUBLIC.
revoke execute on function clonestore_record_founder_stripe_event(jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    execute 'revoke execute on function clonestore_record_founder_stripe_event(jsonb) from pierre_rt_app';
    -- Filet : pas d'INSERT/UPDATE/DELETE brut non plus (déjà posé, ré-affirmé).
    execute 'revoke insert, update, delete on clonestore_founder_stripe_events from pierre_rt_app';
  end if;
end $$;

-- Seul le rôle webhook dédié peut écrire le journal (via la fonction contrôlée).
grant execute on function clonestore_record_founder_stripe_event(jsonb) to clonestore_stripe_webhook_writer;
