-- =============================================================================
-- CloneStory — Cron de l'outbox COMMERCIALE via Supabase Cron (pg_cron + pg_net)
-- CS-FINAL 3 — notifications de contribution commerciale.
-- =============================================================================
-- SCRIPT OPÉRATEUR — NON appliqué automatiquement (hors supabase/migrations/, donc
-- jamais pris par `npm run db:migrate:pg`). À exécuter MANUELLEMENT par l'opérateur
-- dans le SQL Editor Supabase (projet Pro) au moment de l'activation production.
--
-- POURQUOI : Vercel Hobby n'autorise pas les crons « plusieurs fois par jour ». On
-- déclenche donc le worker depuis Supabase Pro (pg_cron) toutes les 5 minutes, qui
-- appelle (pg_net) la route protégée INCHANGÉE :
--     POST https://clonestore.pro/api/cron/clonestory-commercial-outbox
--     Authorization: Bearer <secret>   (CLONESTORY_COMMERCIAL_CRON_SECRET, repli OUTBOX/CRON)
--
-- SÉCURITÉ : ni l'URL ni le secret ne sont écrits en clair dans ce dépôt. Ils sont
-- lus à l'EXÉCUTION depuis Supabase Vault. La définition du job ne contient donc QUE
-- des expressions de lecture Vault — jamais la valeur du secret.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- 1) Secrets dans Vault — À CRÉER UNE FOIS par l'opérateur (placeholders explicites).
--    Remplacer les <<…>> par les vraies valeurs DANS LE SQL EDITOR (jamais commitées).
--
--    select vault.create_secret(
--      '<<https://clonestore.pro/api/cron/clonestory-commercial-outbox>>',
--      'clonestory_commercial_outbox_url',
--      'CloneStory — URL de la route worker outbox commerciale (pg_cron)'
--    );
--    select vault.create_secret(
--      '<<REMPLACER_PAR_LE_SECRET_DU_CRON>>',
--      'clonestory_commercial_outbox_cron_secret',
--      'CloneStory — secret Bearer attendu par /api/cron/clonestory-commercial-outbox'
--    );
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 2) (Ré)installation IDEMPOTENTE du job — un SEUL job actif sous ce nom.
-- -----------------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'clonestory-commercial-outbox-every-5-minutes') then
    perform cron.unschedule('clonestory-commercial-outbox-every-5-minutes');
  end if;
end
$do$;

select cron.schedule(
  'clonestory-commercial-outbox-every-5-minutes',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets
                  where name = 'clonestory_commercial_outbox_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'clonestory_commercial_outbox_cron_secret')
      ),
      body     := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);

-- =============================================================================
-- REQUÊTES OPÉRATEUR (contrôle, lecture seule) :
-- select jobid, jobname, schedule, active from cron.job
--   where jobname = 'clonestory-commercial-outbox-every-5-minutes';
-- select runid, status, return_message, start_time, end_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'clonestory-commercial-outbox-every-5-minutes')
--   order by start_time desc limit 20;
-- Désinstallation : select cron.unschedule('clonestory-commercial-outbox-every-5-minutes');
-- =============================================================================
