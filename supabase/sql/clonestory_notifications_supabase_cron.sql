-- =============================================================================
-- CloneStory — Cron de l'outbox de NOTIFICATIONS GÉNÉRALES via Supabase Cron
-- (pg_cron + pg_net). CS-FINAL 4 — emails transactionnels (confirmation/refus
-- d'introduction, bienvenue, suspension, retrait, révocation de lien).
-- =============================================================================
-- SCRIPT OPÉRATEUR — NON appliqué automatiquement (hors supabase/migrations/, donc
-- jamais pris par `npm run db:migrate:pg`). À exécuter MANUELLEMENT par l'opérateur
-- dans le SQL Editor Supabase (projet Pro) au moment de l'activation production.
--
-- POURQUOI : Vercel Hobby n'autorise pas les crons « plusieurs fois par jour ». On
-- déclenche donc le worker depuis Supabase Pro (pg_cron) toutes les 5 minutes, qui
-- appelle (pg_net) la route protégée INCHANGÉE :
--     POST https://clonestore.pro/api/cron/clonestory-notifications
--     Authorization: Bearer <secret>   (CLONESTORY_OUTBOX_CRON_SECRET, repli CRON_SECRET)
--
-- SÉCURITÉ : ni l'URL ni le secret ne sont écrits en clair dans ce dépôt. Ils sont
-- lus à l'EXÉCUTION depuis Supabase Vault. La définition du job ne contient donc QUE
-- des expressions de lecture Vault — jamais la valeur du secret.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- 1) Secrets dans Vault — À CRÉER UNE FOIS par l'opérateur (placeholders explicites).
--    Le secret DOIT correspondre à celui accepté par la route, c.-à-d. la même valeur
--    que `clonestory_outbox_cron_secret` (la route notifications lit
--    CLONESTORY_OUTBOX_CRON_SECRET ?? CRON_SECRET).
--
--    select vault.create_secret(
--      '<<https://clonestore.pro/api/cron/clonestory-notifications>>',
--      'clonestory_notifications_url',
--      'CloneStory — URL de la route worker notifications (pg_cron)'
--    );
--    select vault.create_secret(
--      '<<MÊME_SECRET_QUE_clonestory_outbox_cron_secret>>',
--      'clonestory_notifications_cron_secret',
--      'CloneStory — secret Bearer attendu par /api/cron/clonestory-notifications'
--    );
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 2) (Ré)installation IDEMPOTENTE du job — un SEUL job actif sous ce nom.
-- -----------------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'clonestory-notifications-every-5-minutes') then
    perform cron.unschedule('clonestory-notifications-every-5-minutes');
  end if;
end
$do$;

select cron.schedule(
  'clonestory-notifications-every-5-minutes',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets
                  where name = 'clonestory_notifications_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'clonestory_notifications_cron_secret')
      ),
      body     := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);

-- =============================================================================
-- REQUÊTES OPÉRATEUR (contrôle, lecture seule) :
-- select jobid, jobname, schedule, active from cron.job
--   where jobname = 'clonestory-notifications-every-5-minutes';
-- select runid, status, return_message, start_time, end_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'clonestory-notifications-every-5-minutes')
--   order by start_time desc limit 20;
-- select id, status_code, created from net._http_response order by created desc limit 20;
-- Désinstallation : select cron.unschedule('clonestory-notifications-every-5-minutes');
-- =============================================================================
