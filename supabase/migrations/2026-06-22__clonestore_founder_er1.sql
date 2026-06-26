-- supabase/migrations/2026-06-22__clonestore_founder_er1.sql
-- PHASE E-R1 — durcissement sécurité / vérité Stripe / intégrité email. Idempotent.
-- S'applique après les migrations E.2–E.4.

-- §6 — statut d'abonnement Stripe complet : ajouter 'incomplete'.
alter table clonestore_founder_reservations drop constraint if exists clonestore_founder_reservations_subscription_status_check;
alter table clonestore_founder_reservations
  add constraint clonestore_founder_reservations_subscription_status_check
  check (subscription_status in ('active','trialing','incomplete','past_due','canceled','unpaid','incomplete_expired','paused','none'));

-- §7 — ordre monotone des événements Stripe sur la réservation.
alter table clonestore_founder_reservations add column if not exists stripe_event_created_at        timestamptz;
alter table clonestore_founder_reservations add column if not exists last_stripe_event_id           text;
alter table clonestore_founder_reservations add column if not exists last_stripe_event_type         text;
alter table clonestore_founder_reservations add column if not exists subscription_current_period_end timestamptz;

-- §10 — durcissement du journal d'événements Stripe (append-only déjà en place).
alter table clonestore_founder_stripe_events add column if not exists event_created_at  timestamptz;
alter table clonestore_founder_stripe_events add column if not exists livemode          boolean;
alter table clonestore_founder_stripe_events add column if not exists api_version       text;
alter table clonestore_founder_stripe_events add column if not exists processing_result text;
alter table clonestore_founder_stripe_events add column if not exists ignored_reason    text;
-- stripe_event_id obligatoire (idempotence forte). Backfill défensif avant NOT NULL.
update clonestore_founder_stripe_events set stripe_event_id = 'legacy:' || id::text where stripe_event_id is null;
alter table clonestore_founder_stripe_events alter column stripe_event_id set not null;

-- §12/§13 — file email : token de vérification STABLE par job + traçabilité fournisseur.
alter table clonestore_founder_email_jobs add column if not exists verification_token       text;
alter table clonestore_founder_email_jobs add column if not exists provider_attempt_id      text;
alter table clonestore_founder_email_jobs add column if not exists provider_idempotency_key text;
alter table clonestore_founder_email_jobs add column if not exists last_provider_response_at timestamptz;
