-- supabase/migrations/2026-06-26_06__clonestory_fp_attribution_engine.sql
-- CLONESTORY — CS-FINAL 2 : moteur d'attribution unifié (lien + introduction).
--
-- ADDITIF, IDEMPOTENT, NON destructif, PostgreSQL 17 / PGlite compatible.
-- Filtre migrator : clonestory_fp. ORDRE : après _05.
-- Unifie les deux origines (clic lien partenaire / introduction nominative confirmée)
-- en une attribution centrale auditable et dédupliquée :
--   « ce compte et cette entreprise proviennent de ce partenaire fondateur ».
--
-- Ce bloc NE capture PAS encore de paiement Stripe (purchase_captured/verified =
-- CS-FINAL 3) ; le modèle est PRÊT à les recevoir (statuts d'introduction déjà définis).
--
-- ACTIVATION PRODUCTION (contrôlée, séparée — NON appliquée par ce bloc) :
--   MIGRATIONS_FILTER=clonestory_fp DATABASE_URL="<prod>" npm run db:migrate:pg
-- ROLLBACK :
--   drop table if exists clonestory_fp_attribution_events;
--   drop table if exists clonestory_fp_attributions;

-- 1) Attribution centrale. Une seule active par compte / par entreprise (index partiels).
create table if not exists clonestory_fp_attributions (
  id                    uuid primary key default gen_random_uuid(),
  partner_id            uuid not null references clonestory_fp_partners(id) on delete cascade,
  source_type           text not null check (source_type in ('partner_link','confirmed_introduction','manual_admin')),
  source_introduction_id uuid references clonestory_fp_introductions(id) on delete set null,
  source_link_usage_id  bigint references clonestory_fp_link_usage(id) on delete set null,
  anonymous_visitor_id  text,
  account_user_id       uuid,                  -- compte du PROSPECT attribué (≠ compte du partenaire)
  company_id            uuid,                  -- futur : identifiant d'entreprise réel (aucune FK : pas d'entité prod)
  company_ref           text,                  -- repère stable d'entreprise tant qu'aucun company_id (nom normalisé)
  email_fingerprint     text,                  -- haché, jamais l'e-mail en clair
  company_fingerprint   text,                  -- haché (csy-company:salt:dedupKey)
  status                text not null default 'anonymous'
                          check (status in ('anonymous','account_linked','company_linked','superseded','invalidated','disputed')),
  priority              integer not null default 0,
  decision_reason       text,
  evidence_safe         jsonb not null default '{}'::jsonb,
  first_seen_at         timestamptz not null default now(),
  linked_at             timestamptz,
  expires_at            timestamptz,
  superseded_at         timestamptz,
  invalidated_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Une SEULE attribution active par compte ; une SEULE par entreprise (anti-vol).
create unique index if not exists uq_csy_attr_active_account
  on clonestory_fp_attributions(account_user_id)
  where account_user_id is not null and status in ('account_linked','company_linked');
create unique index if not exists uq_csy_attr_active_company
  on clonestory_fp_attributions(company_fingerprint)
  where company_fingerprint is not null and company_fingerprint <> '' and status in ('company_linked');
-- Idempotence du clic : une attribution anonyme par (visiteur, partenaire).
create unique index if not exists uq_csy_attr_visitor_partner
  on clonestory_fp_attributions(anonymous_visitor_id, partner_id)
  where anonymous_visitor_id is not null and status = 'anonymous';
create index if not exists idx_csy_attr_partner on clonestory_fp_attributions(partner_id, created_at);
create index if not exists idx_csy_attr_account on clonestory_fp_attributions(account_user_id) where account_user_id is not null;
create index if not exists idx_csy_attr_intro on clonestory_fp_attributions(source_introduction_id) where source_introduction_id is not null;

-- 2) Événements du moteur (APPEND-ONLY ; le partner-facing reste contribution_events).
create table if not exists clonestory_fp_attribution_events (
  id             bigint generated always as identity primary key,
  attribution_id uuid references clonestory_fp_attributions(id) on delete cascade,
  partner_id     uuid not null references clonestory_fp_partners(id) on delete cascade,
  type           text not null check (type in (
                   'attribution_link_visited','attribution_candidate_created','attribution_conflict_detected',
                   'attribution_account_linked','attribution_company_linked','attribution_superseded',
                   'attribution_invalidated','attribution_manual_review_required')),
  reason         text,
  evidence_safe  jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now()
);
create index if not exists idx_csy_attr_evt_partner on clonestory_fp_attribution_events(partner_id, occurred_at);
create index if not exists idx_csy_attr_evt_attr on clonestory_fp_attribution_events(attribution_id);

-- Append-only sur les événements (réutilise la fonction trigger partagée de _01).
drop trigger if exists trg_clonestory_fp_attribution_events_append_only on clonestory_fp_attribution_events;
create trigger trg_clonestory_fp_attribution_events_append_only
  before update or delete on clonestory_fp_attribution_events
  for each row execute function clonestory_forbid_mutation();

-- RLS FORCÉE + grants (rôle non-superuser). Attributions : update autorisé (transitions) ;
-- événements : insert seulement (append-only via trigger).
do $$ begin
  alter table clonestory_fp_attributions       enable row level security;
  alter table clonestory_fp_attributions       force  row level security;
  alter table clonestory_fp_attribution_events enable row level security;
  alter table clonestory_fp_attribution_events force  row level security;
  grant select, insert, update on clonestory_fp_attributions       to pierre_rt_app;
  grant select, insert         on clonestory_fp_attribution_events to pierre_rt_app;
end $$;

-- Service complet, OU le PARTENAIRE lit uniquement ses propres lignes (jamais le prospect).
drop policy if exists csy_attr_access on clonestory_fp_attributions;
create policy csy_attr_access on clonestory_fp_attributions for all
  using (
    nullif(current_setting('app.clonestory_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.clonestory_partner', true), '')
  )
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

drop policy if exists csy_attr_evt_access on clonestory_fp_attribution_events;
create policy csy_attr_evt_access on clonestory_fp_attribution_events for all
  using (
    nullif(current_setting('app.clonestory_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.clonestory_partner', true), '')
  )
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');
