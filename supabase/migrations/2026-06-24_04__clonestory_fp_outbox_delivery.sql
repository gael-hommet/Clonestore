-- supabase/migrations/2026-06-24_04__clonestory_fp_outbox_delivery.sql
-- CLONESTORY — FIABILITÉ DE LIVRAISON EMAIL. Additif, idempotent. Filtre : clonestory_fp.
--   • génération d'email (retry technique vs vrai renvoi) ;
--   • token de vérification STATELESS reconstructible (HMAC) — aucun token brut stocké :
--     on persiste seulement (partner_id, generation, token_exp_ms) ;
--   • états d'envoi incertain (sending / delivery_unknown) + bail de worker (locked_at) ;
--   • supersession des anciennes générations.

-- Génération de vérification courante du partenaire (révocation par incrément).
alter table clonestory_fp_partners add column if not exists verification_generation integer not null default 1;

-- Colonnes de livraison sur l'outbox.
alter table clonestory_fp_email_outbox add column if not exists generation integer not null default 1;
alter table clonestory_fp_email_outbox add column if not exists token_exp_ms bigint;
alter table clonestory_fp_email_outbox add column if not exists locked_at timestamptz;
alter table clonestory_fp_email_outbox add column if not exists provider_message_id text;

-- Statuts de livraison étendus (incertitude + supersession explicites).
alter table clonestory_fp_email_outbox drop constraint if exists clonestory_fp_email_outbox_status_check;
alter table clonestory_fp_email_outbox
  add constraint clonestory_fp_email_outbox_status_check
  check (status in ('pending','sending','sent','failed_retryable','delivery_unknown','dead','superseded'));

create index if not exists idx_csy_outbox_claim
  on clonestory_fp_email_outbox(status, next_attempt_at);
create index if not exists idx_csy_outbox_gen
  on clonestory_fp_email_outbox(partner_id, generation);
