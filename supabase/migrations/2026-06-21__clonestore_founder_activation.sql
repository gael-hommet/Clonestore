-- supabase/migrations/2026-06-21__clonestore_founder_activation.sql
-- PHASE E.4 — Activation & vérité Stripe. Idempotent. Après les migrations E.2/E.3.
--
-- Ajoute le statut d'abonnement Stripe courant sur la réservation (vérité revenue :
-- seuls 'active'/'trialing' comptent dans le MRR). Lié à user_id Supabase une fois
-- l'activation faite. Les colonnes stripe_* existent déjà (migration de base).

alter table clonestore_founder_reservations add column if not exists subscription_status text
  check (subscription_status in ('active','trialing','past_due','canceled','unpaid','incomplete_expired','paused','none'));
alter table clonestore_founder_reservations add column if not exists user_id uuid;

create index if not exists idx_founder_reservation_sub_status on clonestore_founder_reservations(subscription_status)
  where subscription_status is not null;
create index if not exists idx_founder_reservation_user on clonestore_founder_reservations(user_id)
  where user_id is not null;
