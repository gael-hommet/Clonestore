-- supabase/migrations/2026-06-25_05__clonestory_fp_partner_account_and_distinctions.sql
-- CLONESTORY — CS-FINAL 1 : liaison compte durable + fondation des distinctions.
--
-- ADDITIF, IDEMPOTENT, NON destructif. Filtre migrator : clonestory_fp.
-- Prépare (sans rien supprimer) :
--   1. account_user_id : lien DURABLE partenaire ↔ compte CloneStore (user_id Supabase).
--      Tant qu'il n'est pas backfillé, la résolution se fait par e-mail vérifié (sûr).
--   2. clonestory_fp_distinctions : CATALOGUE des distinctions (honorifiques, jamais
--      commerciales) — identifiant stable, nom, description, catégorie, mode d'attribution.
--   3. clonestory_fp_partner_awards : attributions par partenaire (auto/manuel), sans
--      doublon, révocables (revoked_at) mais JAMAIS supprimées (pas de DELETE).
-- RLS FORCÉE + politiques GUC, comme le reste de CloneStory.
--
-- ACTIVATION PRODUCTION (contrôlée, séparée — NON appliquée par ce bloc) :
--   MIGRATIONS_FILTER=clonestory_fp DATABASE_URL="<prod>" npm run db:migrate:pg
-- ROLLBACK :
--   drop table if exists clonestory_fp_partner_awards;
--   drop table if exists clonestory_fp_distinctions;
--   alter table clonestory_fp_partners drop column if exists account_user_id;

-- 1) Lien durable compte CloneStore (user_id Supabase). Nullable : aucune écriture forcée.
--    UNIQUE (partiel) : un compte CloneStore ne peut être lié qu'à UN partenaire
--    (corrigé CS-FINAL 2 : empêche deux partenaires de revendiquer le même compte).
alter table clonestory_fp_partners add column if not exists account_user_id uuid;
drop index if exists idx_csy_partner_account;
create unique index if not exists uq_csy_partner_account on clonestory_fp_partners(account_user_id)
  where account_user_id is not null;

-- 2) Catalogue des distinctions (source persistée, alignée sur le catalogue code).
create table if not exists clonestory_fp_distinctions (
  code         text primary key,
  name         text not null,
  description  text not null,
  category     text not null check (category in ('statut','etape','engagement','honneur')),
  grant_mode   text not null check (grant_mode in ('auto','manuel')),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 3) Attributions par partenaire. Unique (partenaire, distinction) → aucun doublon.
--    Révocation par revoked_at (jamais de DELETE). Source auto/manuel tracée.
create table if not exists clonestory_fp_partner_awards (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references clonestory_fp_partners(id) on delete cascade,
  distinction_code text not null references clonestory_fp_distinctions(code),
  source           text not null default 'auto' check (source in ('auto','manuel')),
  awarded_at       timestamptz not null default now(),
  awarded_by       text,                       -- admin/email côté service (jamais exposé au membre)
  evidence_ref     text,
  revoked_at       timestamptz,
  metadata_safe    jsonb not null default '{}'::jsonb
);
create unique index if not exists uq_csy_award_partner_code
  on clonestory_fp_partner_awards(partner_id, distinction_code);
create index if not exists idx_csy_award_partner on clonestory_fp_partner_awards(partner_id, awarded_at);

-- RLS FORCÉE + grants applicatifs (rôle non-superuser).
do $$ begin
  alter table clonestory_fp_distinctions       enable row level security;
  alter table clonestory_fp_distinctions       force  row level security;
  alter table clonestory_fp_partner_awards     enable row level security;
  alter table clonestory_fp_partner_awards     force  row level security;
  grant select, insert, update on clonestory_fp_distinctions   to pierre_rt_app;
  grant select, insert, update on clonestory_fp_partner_awards to pierre_rt_app;
end $$;

-- Catalogue : lecture/écriture SERVICE uniquement (le membre lit ses awards, pas le catalogue brut).
drop policy if exists csy_distinctions_access on clonestory_fp_distinctions;
create policy csy_distinctions_access on clonestory_fp_distinctions for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

-- Awards : SERVICE complet, OU le partenaire LIT uniquement ses propres attributions.
drop policy if exists csy_awards_access on clonestory_fp_partner_awards;
create policy csy_awards_access on clonestory_fp_partner_awards for all
  using (
    nullif(current_setting('app.clonestory_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.clonestory_partner', true), '')
  )
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');

-- Seed idempotent du catalogue (aligné sur src/lib/clonestory/founding-partners/distinctions.ts).
insert into clonestory_fp_distinctions (code, name, description, category, grant_mode) values
  ('founding_member','Membre du Cercle Fondateur','Entrée vérifiée dans le Cercle des Partenaires Fondateurs.','statut','auto'),
  ('founding_partner','Partenaire Fondateur','Titre permanent accordé après une première contribution vérifiée au commencement de CloneStore.','honneur','auto'),
  ('first_introduction','Première introduction','Première entreprise présentée à CloneStore.','etape','auto'),
  ('first_confirmed','Premier prospect confirmé','Une première mise en relation confirmée par le contact.','etape','auto'),
  ('first_client','Premier client','Une entreprise présentée est devenue cliente de CloneStore.','etape','auto'),
  ('builder_5','Bâtisseur du Cercle','Cinq contributions vérifiées au développement de CloneStore.','engagement','auto'),
  ('ambassador_10','Ambassadeur du Cercle','Dix contributions vérifiées au développement de CloneStore.','engagement','auto'),
  ('pioneer','Pionnier du Cercle','Distinction réservée aux tout premiers partenaires du Cercle.','honneur','manuel'),
  ('architect','Architecte du Cercle','Distinction exceptionnelle, accordée manuellement pour une contribution majeure.','honneur','manuel')
on conflict (code) do update
  set name = excluded.name, description = excluded.description,
      category = excluded.category, grant_mode = excluded.grant_mode, updated_at = now();
