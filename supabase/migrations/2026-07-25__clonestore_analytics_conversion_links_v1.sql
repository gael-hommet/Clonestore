-- Canonical Analytics Runtime Wiring — table de liaison de corrélation de conversion.
-- Relie durablement le visiteur/session D'ORIGINE à reservation/checkout/order, de façon
-- interrogeable par le webhook (qui n'a pas de cookie). Additive, aucune PII (jamais email/IP/nom
-- /téléphone), références Stripe HACHÉES. Ne remplace, ne migre aucune table existante.

create table if not exists clonestore_analytics_conversion_links_v1 (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Clé de corrélation primaire : l'id de réservation (UUID persisté serveur).
  reservation_id text not null,
  -- Identités canoniques d'origine (cookies signés first-party, lecture seule).
  visitor_id uuid,
  session_id uuid,
  -- Utilisateur authentifié (Supabase auth uid), jamais un email.
  authenticated_user_id uuid,
  -- Références Stripe HACHÉES (jamais l'id brut) pour retrouver la corrélation sans cookie.
  checkout_session_ref text,   -- sha256(stripe checkout session id) borné
  order_ref text,              -- sha256(subscription/order id) borné
  -- Attribution Partner déjà résolue serveur (identifiant interne borné), jamais un partner_id client.
  partner_attribution_id text,
  environment text not null check (environment in ('production','preview','development','test'))
);

-- Une seule ligne de corrélation par réservation et par environnement (upsert idempotent).
create unique index if not exists analytics_conv_links_reservation_env_uq
  on clonestore_analytics_conversion_links_v1 (reservation_id, environment);
-- Retrouver la corrélation depuis un événement facture/abonnement sans cookie.
create index if not exists analytics_conv_links_order_ref_idx
  on clonestore_analytics_conversion_links_v1 (order_ref) where order_ref is not null;
create index if not exists analytics_conv_links_checkout_ref_idx
  on clonestore_analytics_conversion_links_v1 (checkout_session_ref) where checkout_session_ref is not null;
create index if not exists analytics_conv_links_visitor_idx
  on clonestore_analytics_conversion_links_v1 (visitor_id) where visitor_id is not null;

comment on table clonestore_analytics_conversion_links_v1 is
  'Corrélation de conversion (Canonical Analytics Runtime Wiring). Relie visitor/session d''origine à reservation/checkout/order pour attribuer les vérités serveur au parcours visiteur. Aucune PII, références Stripe hachées.';

-- ── RLS forcée, accès service applicatif uniquement ────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    create role pierre_rt_app nologin;
  end if;
end$$;

alter table clonestore_analytics_conversion_links_v1 enable row level security;
alter table clonestore_analytics_conversion_links_v1 force row level security;
grant select, insert, update on clonestore_analytics_conversion_links_v1 to pierre_rt_app;
drop policy if exists analytics_conv_links_app on clonestore_analytics_conversion_links_v1;
create policy analytics_conv_links_app on clonestore_analytics_conversion_links_v1
  to pierre_rt_app using (true) with check (true);

-- updated_at auto sur upsert.
create or replace function clonestore_analytics_conv_links_touch() returns trigger
  language plpgsql set search_path = pg_catalog, public
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;
drop trigger if exists trg_analytics_conv_links_touch on clonestore_analytics_conversion_links_v1;
create trigger trg_analytics_conv_links_touch
  before update on clonestore_analytics_conversion_links_v1
  for each row execute function clonestore_analytics_conv_links_touch();
