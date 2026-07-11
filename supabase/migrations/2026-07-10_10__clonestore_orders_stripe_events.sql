-- supabase/migrations/2026-07-10_10__clonestore_orders_stripe_events.sql
-- BLOC 4 — Ledger d'idempotence + anti-replay des événements Stripe du flux `orders`.
--
-- Cette table vit dans la MÊME base Supabase que la table `orders` (écrite via supabase-js
-- avec la clé service-role). Elle N'EST PAS gérée par le migrateur PGlite `scripts/db/migrate.mjs`
-- (dédié aux familles pierre_v / clonestory_fp). Application PRODUCTION = action opérateur
-- délibérée : coller ce fichier dans le SQL Editor Supabase, OU l'inclure dans le script
-- d'application Supabase de l'orders-flow. ADDITIF, IDEMPOTENT, NON destructif.
--
-- ROLLBACK : drop table if exists clonestore_orders_stripe_events;

create table if not exists clonestore_orders_stripe_events (
  id                 bigint generated always as identity primary key,
  stripe_event_id    text not null unique,           -- un event → une conséquence (idempotence)
  event_type         text not null,
  object_id          text,                           -- id de l'ABONNEMENT (ligne d'eau par objet)
  event_created      bigint not null,                -- created Stripe (unix s) → ordre monotone
  livemode           boolean not null default false,
  payload_fingerprint text not null,                 -- SHA-256 canonique (détection conflit même-id)
  processing_result  text not null default 'pending'
                       check (processing_result in ('pending','applied','ignored','duplicate','failed','conflict')),
  ignored_reason     text,
  error_safe         text,                            -- message d'erreur borné (aucun secret)
  attempts           integer not null default 0,
  claimed_at         timestamptz,                     -- bail de traitement (reprise après crash)
  processed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Ligne d'eau : dernier event APPLIQUÉ par objet, trié (event_created desc, stripe_event_id desc).
create index if not exists idx_orders_stripe_evt_object
  on clonestore_orders_stripe_events(object_id, processing_result, event_created desc, stripe_event_id desc);
create index if not exists idx_orders_stripe_evt_result
  on clonestore_orders_stripe_events(processing_result, created_at);

-- Verrouillage : RLS activée SANS politique → aucun accès via PostgREST (anon/authenticated).
-- Seule la clé service-role (qui bypasse la RLS) écrit/lit cette table depuis le webhook serveur.
-- Un navigateur ne peut jamais la lire.
alter table clonestore_orders_stripe_events enable row level security;
