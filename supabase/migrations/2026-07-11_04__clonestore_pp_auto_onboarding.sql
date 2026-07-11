-- supabase/migrations/2026-07-11_04__clonestore_pp_auto_onboarding.sql
-- CABINETS FONDATEURS — admission AUTOMATIQUE (plus de validation humaine systématique).
--
-- ADDITIF, IDEMPOTENT, NON destructif. Filtre migrator : clonestore_pp. ORDRE : après _03.
-- N'altère aucune donnée, ne supprime aucune colonne. Étend uniquement :
--   • les statuts (onboarding_pending / manual_review) ;
--   • le code de recommandation RE-PARTAGEABLE (chiffré AES-256-GCM, jamais en clair) ;
--   • le domaine d'entreprise NORMALISÉ (rapprochement d'attribution fiable) ;
--   • un journal APPEND-ONLY des décisions d'attribution ;
--   • de nouveaux types d'emails.
--
-- Le taux (2000 bps), le calcul sur le HT encaissé, les ledgers, les reversals,
-- les litiges, Stripe Connect et la RLS restent INCHANGÉS.

-- ── 1) Statuts : admission automatique + revue par exception ──────────────────
-- partenaires : ajout de 'onboarding_pending' (créé automatiquement, en cours
-- d'onboarding) et 'manual_review' (revue humaine UNIQUEMENT si risque réel).
alter table clonestore_pp_partners drop constraint if exists clonestore_pp_partners_status_check;
alter table clonestore_pp_partners add constraint clonestore_pp_partners_status_check
  check (status in ('pending','onboarding_pending','contract_pending','stripe_pending',
                    'manual_review','active','suspended','archived'));

-- candidatures : 'auto_approved' (provisionnée sans intervention) et 'manual_review'.
alter table clonestore_pp_applications drop constraint if exists clonestore_pp_applications_status_check;
alter table clonestore_pp_applications add constraint clonestore_pp_applications_status_check
  check (status in ('received','under_review','manual_review','auto_approved',
                    'accepted','rejected','withdrawn'));

-- ── 2) Code de recommandation RE-PARTAGEABLE ──────────────────────────────────
-- Le partenaire doit pouvoir re-consulter son code (il le partage régulièrement).
-- Il n'est JAMAIS stocké en clair : chiffrement AES-256-GCM (clé hors base, env).
-- Le hash reste la seule voie de VÉRIFICATION (résolution d'un code saisi).
alter table clonestore_pp_partner_codes add column if not exists code_cipher     text;
alter table clonestore_pp_partner_codes add column if not exists code_cipher_iv  text;
alter table clonestore_pp_partner_codes add column if not exists code_cipher_tag text;

-- ── 3) Domaine d'entreprise NORMALISÉ (rapprochement d'attribution) ───────────
-- L'attribution ne doit jamais reposer sur une comparaison de texte non normalisée.
alter table clonestore_pp_introductions add column if not exists company_domain text;
create index if not exists idx_pp_intro_domain
  on clonestore_pp_introductions(company_domain) where company_domain is not null;
create index if not exists idx_pp_intro_contact_email
  on clonestore_pp_introductions(contact_email_normalized) where contact_email_normalized is not null;
-- Pagination : tri stable par (partner_id, submitted_at desc, id).
create index if not exists idx_pp_intro_partner_paged
  on clonestore_pp_introductions(partner_id, submitted_at desc, id);

-- ── 4) Journal APPEND-ONLY des décisions d'attribution ────────────────────────
-- Toute décision (attribuée, refusée, conflit, auto-parrainage, client existant)
-- est tracée avec sa source, sa raison et son acteur. Jamais modifiable.
create table if not exists clonestore_pp_attribution_decisions (
  id                bigint generated always as identity primary key,
  occurred_at       timestamptz not null default now(),
  decision          text not null check (decision in (
                      'attributed','superseded','rejected_self_referral','rejected_existing_client',
                      'rejected_no_source','rejected_partner_inactive','conflict_manual_review',
                      'kept_existing','locked')),
  source            text check (source in ('link','code','introduction','invitation','admin')),
  partner_id        uuid references clonestore_pp_partners(id) on delete set null,
  competing_partner_id uuid references clonestore_pp_partners(id) on delete set null,
  subject_user_id   uuid,
  company_domain    text,
  company_fingerprint text,
  attribution_id    uuid references clonestore_pp_attributions(id) on delete set null,
  touch_id          bigint references clonestore_pp_referral_touches(id) on delete set null,
  introduction_id   uuid references clonestore_pp_introductions(id) on delete set null,
  used_code         boolean not null default false,
  reason            text not null,
  actor             text not null default 'system',
  conflict          boolean not null default false,
  evidence_safe     jsonb not null default '{}'::jsonb
);
create index if not exists idx_pp_attr_dec_partner on clonestore_pp_attribution_decisions(partner_id, occurred_at desc);
create index if not exists idx_pp_attr_dec_subject on clonestore_pp_attribution_decisions(subject_user_id);
create index if not exists idx_pp_attr_dec_conflict on clonestore_pp_attribution_decisions(conflict) where conflict;

drop trigger if exists trg_clonestore_pp_attribution_decisions_append_only on clonestore_pp_attribution_decisions;
create trigger trg_clonestore_pp_attribution_decisions_append_only
  before update or delete on clonestore_pp_attribution_decisions
  for each row execute function clonestore_pp_forbid_mutation();

alter table clonestore_pp_attribution_decisions enable row level security;
alter table clonestore_pp_attribution_decisions force  row level security;
grant select, insert on clonestore_pp_attribution_decisions to pierre_rt_app;

drop policy if exists pp_attr_dec_access on clonestore_pp_attribution_decisions;
create policy pp_attr_dec_access on clonestore_pp_attribution_decisions for all
  using (
    nullif(current_setting('app.pp_service', true), '') = 'on'
    or partner_id::text = nullif(current_setting('app.pp_partner', true), '')
  )
  with check (nullif(current_setting('app.pp_service', true), '') = 'on');

-- ── 5) Nouveaux types d'emails (parcours automatique) ─────────────────────────
alter table clonestore_pp_email_outbox drop constraint if exists clonestore_pp_email_outbox_kind_check;
alter table clonestore_pp_email_outbox add constraint clonestore_pp_email_outbox_kind_check
  check (kind in (
    'application_received','application_accepted','application_rejected',
    'contract_pending','stripe_onboarding_pending','partner_activated',
    'introduction_received','client_converted','client_active',
    'commission_recorded','commission_available','monthly_statement',
    'transfer_executed','transfer_failed','partner_suspended',
    -- parcours automatique :
    'onboarding_access','terms_accepted','manual_review_pending',
    'prospect_signed_up','attribution_conflict'));

-- ── 6) Marque de provenance de l'activation (audit) ───────────────────────────
alter table clonestore_pp_partners add column if not exists activation_mode text
  check (activation_mode is null or activation_mode in ('automatic','manual'));

-- ── 7) Risk flags : nouveaux types issus de l'admission automatique ───────────
-- Seuls les types BLOQUANTS empêchent l'activation automatique (cf. onboarding-rules.ts).
alter table clonestore_pp_risk_flags drop constraint if exists clonestore_pp_risk_flags_kind_check;
alter table clonestore_pp_risk_flags add constraint clonestore_pp_risk_flags_kind_check
  check (kind in (
    'self_referral_suspected','same_account','shared_domain','duplicate_company',
    'volume_spike','code_bruteforce','generic_email','attribution_conflict','manual',
    -- admission automatique :
    'disposable_email','non_professional_email','domain_mismatch','duplicate_applications',
    'existing_partner_domain','country_not_allowed','shared_stripe_account','abnormal_volume',
    'existing_client'));
