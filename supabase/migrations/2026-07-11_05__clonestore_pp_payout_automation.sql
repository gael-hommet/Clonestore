-- Cabinets Fondateurs — VERSEMENTS AUTOMATIQUES Stripe Connect.
-- Additive et idempotente. Ne touche à aucun montant, à aucun taux, à aucune règle
-- d'attribution. Corrige la sémantique des transferts :
--
--   • statuts EXPLICITES (preview n'existe pas en base : une prévisualisation n'écrit RIEN) ;
--   • une écriture n'est `paid` QU'APRÈS confirmation du transfert Stripe ;
--   • un lot en échec est LIBÉRÉ (les commissions retournent au pool) ;
--   • un lot dont l'issue est inconnue reste verrouillé en `reconciliation_required`.

-- ── 1. Statuts de transfert explicites ───────────────────────────────────────
-- Anciens : created | processing | paid | failed | released
-- Nouveaux : pending | processing | transferred | failed_retryable | failed_permanent
--            | reconciliation_required   (+ anciens conservés pour compatibilité)
alter table clonestore_pp_transfers drop constraint if exists clonestore_pp_transfers_status_check;
alter table clonestore_pp_transfers add constraint clonestore_pp_transfers_status_check
  check (status in (
    'pending','processing','transferred','failed_retryable','failed_permanent',
    'reconciliation_required','released',
    -- compatibilité ascendante (lignes créées avant cette migration) :
    'created','paid','failed'
  ));

-- Empreinte du lot : (partenaire, période, ensemble exact des écritures).
alter table clonestore_pp_transfers add column if not exists batch_hash text;
alter table clonestore_pp_transfers add column if not exists attempts integer not null default 0;
alter table clonestore_pp_transfers add column if not exists last_attempt_at timestamptz;
-- Action explicite attendue de l'admin (jamais un message vague).
alter table clonestore_pp_transfers add column if not exists required_action text;

-- Un seul transfert VIVANT par (cabinet, période). Un lot libéré/échoué-définitif ne bloque plus.
drop index if exists uq_pp_transfer_partner_period;
create unique index if not exists uq_pp_transfer_partner_period
  on clonestore_pp_transfers(partner_id, period_start, period_end)
  where status in ('pending','processing','transferred','reconciliation_required','failed_retryable','created','paid','failed');

create index if not exists idx_pp_transfer_needs_attention
  on clonestore_pp_transfers(status) where status in ('failed_retryable','failed_permanent','reconciliation_required');

-- ── 2. Notification « commission disponible » (exactement une fois) ───────────
-- Colonne NON financière : le trigger clonestore_pp_entries_guard ne la protège pas.
alter table clonestore_pp_commission_entries add column if not exists available_notified_at timestamptz;
create index if not exists idx_pp_entry_available_pool
  on clonestore_pp_commission_entries(partner_id, status, available_at);

-- ── 3. Stripe Connect : état réel, jamais de donnée bancaire ─────────────────
-- CloneStore ne stocke NI IBAN, NI RIB, NI compte bancaire : uniquement l'état de complétude
-- renvoyé par Stripe et la liste des exigences encore dues (identifiants de champs Stripe).
alter table clonestore_pp_partners add column if not exists stripe_details_submitted boolean not null default false;
alter table clonestore_pp_partners add column if not exists stripe_requirements_due text[] not null default '{}';
alter table clonestore_pp_partners add column if not exists stripe_disabled_reason text;
alter table clonestore_pp_partners add column if not exists last_payout_at timestamptz;

-- ── 4. E-mails du circuit de versement ───────────────────────────────────────
alter table clonestore_pp_email_outbox drop constraint if exists clonestore_pp_email_outbox_kind_check;
alter table clonestore_pp_email_outbox add constraint clonestore_pp_email_outbox_kind_check
  check (kind in (
    'application_received','application_accepted','application_rejected',
    'contract_pending','stripe_onboarding_pending','partner_activated',
    'introduction_received','client_converted','client_active',
    'commission_recorded','commission_available','monthly_statement',
    'transfer_executed','transfer_failed','partner_suspended',
    'onboarding_access','terms_accepted','manual_review_pending',
    'prospect_signed_up','attribution_conflict',
    -- circuit de versement :
    'connect_ready','payout_blocked'
  ));

-- ── 5. Index d'analytique admin (agrégats calculés côté PostgreSQL) ──────────
create index if not exists idx_pp_entry_partner_status on clonestore_pp_commission_entries(partner_id, status);
create index if not exists idx_pp_attr_partner_status on clonestore_pp_attributions(partner_id, status);
create index if not exists idx_pp_touch_partner on clonestore_pp_referral_touches(partner_id);
create index if not exists idx_pp_partner_status_country on clonestore_pp_partners(status, country);
