-- supabase/sql/partner_program_supabase_cron.sql
-- Crons Supabase (pg_cron + pg_net) du programme « Cabinets Fondateurs ».
-- À COLLER MANUELLEMENT dans le SQL Editor Supabase Pro (hors migrateur). Secrets via Vault.
-- Ne JAMAIS committer de secret ici. Reproduit le pattern clonestory_commercial_outbox.
--
-- Prérequis : extensions pg_cron + pg_net actives ; secrets dans Vault :
--   vault: partner_cron_base_url  = https://<domaine>
--   vault: partner_cron_secret    = <PARTNER_PAYOUT_CRON_SECRET / PARTNER_EMAIL_CRON_SECRET / CRON_SECRET>

-- Emails partenaires — toutes les 5 minutes.
select cron.schedule(
  'partner-emails',
  '*/5 * * * *',
  $$
  select net.http_post(
    url    := (select decrypted_secret from vault.decrypted_secrets where name='partner_cron_base_url') || '/api/cron/partner-emails',
    headers:= jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name='partner_cron_secret')),
    body   := '{}'::jsonb
  );
  $$
);

-- Versements partenaires — le 5 de chaque mois à 03:00 UTC (dry-run tant que PARTNER_PAYOUT_DRY_RUN≠false).
select cron.schedule(
  'partner-payouts',
  '0 3 5 * *',
  $$
  select net.http_post(
    url    := (select decrypted_secret from vault.decrypted_secrets where name='partner_cron_base_url') || '/api/cron/partner-payouts',
    headers:= jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name='partner_cron_secret')),
    body   := '{}'::jsonb
  );
  $$
);
