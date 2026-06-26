-- supabase/migrations/2026-06-23__clonestore_founder_er2.sql
-- PHASE E-R2 — journal Stripe non falsifiable (§5) + token de vérification non
-- exploitable au repos (§6). Idempotent. Après les migrations E.2–E-R1.

-- ── §5 — INSERT contrôlé du journal Stripe (fonction SECURITY DEFINER) ───────
-- Le rôle applicatif ne peut plus insérer arbitrairement : seule cette fonction,
-- au search_path fixe, écrit dans le journal (append-only, déjà sans UPDATE/DELETE).
create or replace function clonestore_record_founder_stripe_event(p jsonb)
  returns bigint
  language plpgsql
  security definer
  set search_path = pg_catalog, public
as $fn$
declare new_id bigint;
begin
  insert into public.clonestore_founder_stripe_events
    (stripe_event_id, event_type, event_created_at, livemode, api_version, reservation_id,
     subscription_id, customer_id, amount_cents, currency, processing_result, ignored_reason, payload_safe)
  values (
    p->>'stripe_event_id',
    p->>'event_type',
    nullif(p->>'event_created_at','')::timestamptz,
    nullif(p->>'livemode','')::boolean,
    p->>'api_version',
    nullif(p->>'reservation_id','')::uuid,
    p->>'subscription_id',
    p->>'customer_id',
    nullif(p->>'amount_cents','')::int,
    p->>'currency',
    p->>'processing_result',
    p->>'ignored_reason',
    coalesce(p->'payload_safe','{}'::jsonb))
  on conflict (stripe_event_id) do nothing
  returning id into new_id;
  return new_id; -- null si l'événement existait déjà (idempotence)
end
$fn$;

-- EXECUTE révoqué à PUBLIC ; accordé au rôle applicatif uniquement.
revoke all on function clonestore_record_founder_stripe_event(jsonb) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    execute 'grant execute on function clonestore_record_founder_stripe_event(jsonb) to pierre_rt_app';
    -- Plus d'INSERT brut applicatif sur le journal (SELECT conservé pour le cockpit).
    execute 'revoke insert on clonestore_founder_stripe_events from pierre_rt_app';
  end if;
end $$;
revoke insert on clonestore_founder_stripe_events from public;

-- ── §6 — version de token de vérification (token déterministe HMAC, jamais stocké) ─
alter table clonestore_founder_reservations add column if not exists verification_token_version integer not null default 1;
-- La colonne en clair des jobs n'est plus utilisée pour stocker un token exploitable.
comment on column clonestore_founder_email_jobs.verification_token is
  'DEPRECATED E-R2 §6 : ne plus stocker de token en clair. Token reconstruit par HMAC(secret, version+reservation_id).';
