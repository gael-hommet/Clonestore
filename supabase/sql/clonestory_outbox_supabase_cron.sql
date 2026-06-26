-- =============================================================================
-- CloneStory — Déclencheur du worker d'outbox email via Supabase Cron (pg_cron + pg_net)
-- =============================================================================
-- SCRIPT OPÉRATEUR — NON appliqué automatiquement (hors supabase/migrations/, donc
-- jamais pris par `npm run db:migrate:pg`). À exécuter MANUELLEMENT par l'opérateur
-- dans le SQL Editor Supabase (projet Pro) au moment de l'activation production.
--
-- POURQUOI : Vercel Hobby n'autorise pas les crons « plusieurs fois par jour ». On
-- déclenche donc le worker depuis Supabase Pro (pg_cron) toutes les 5 minutes, qui
-- appelle (pg_net) la route protégée INCHANGÉE :
--     POST https://clonestore.pro/api/cron/clonestory-outbox
--     Authorization: Bearer <secret>   (CLONESTORY_OUTBOX_CRON_SECRET ou CRON_SECRET)
--
-- SÉCURITÉ : ni l'URL ni le secret ne sont écrits en clair dans ce dépôt. Ils sont
-- lus à l'EXÉCUTION depuis Supabase Vault. La définition du job (cron.job.command)
-- ne contient donc QUE des expressions de lecture Vault — jamais la valeur du secret.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0) Extensions (idempotent). Sur Supabase, l'activation via Dashboard
--    « Database → Extensions » est la voie officiellement recommandée ; ces
--    instructions sont le repli SQL équivalent.
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;


-- -----------------------------------------------------------------------------
-- 1) Secrets dans Vault — À CRÉER UNE FOIS par l'opérateur (placeholders explicites).
--    Remplacer les <<…>> par les vraies valeurs DANS LE SQL EDITOR (jamais commitées).
--    Si les secrets existent déjà, ne PAS rejouer ce bloc (laisser commenté).
--
--    -- URL de production de la route protégée :
--    select vault.create_secret(
--      '<<https://clonestore.pro/api/cron/clonestory-outbox>>',
--      'clonestory_outbox_url',
--      'CloneStory — URL de la route worker outbox (déclenchée par pg_cron)'
--    );
--
--    -- Secret du cron (= CLONESTORY_OUTBOX_CRON_SECRET côté Vercel, ou CRON_SECRET) :
--    select vault.create_secret(
--      '<<REMPLACER_PAR_LE_SECRET_DU_CRON>>',
--      'clonestory_outbox_cron_secret',
--      'CloneStory — secret Bearer attendu par /api/cron/clonestory-outbox'
--    );
--
--    Pour FAIRE TOURNER un secret existant (ex. après rotation) :
--    select vault.update_secret(
--      (select id from vault.secrets where name = 'clonestory_outbox_cron_secret'),
--      '<<NOUVEAU_SECRET>>'
--    );
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- 2) (Ré)installation IDEMPOTENTE du job — un SEUL job actif sous ce nom.
--    On dé-planifie d'abord l'éventuel job existant (par nom), puis on (re)crée.
--    Le `command` lit l'URL ET le secret depuis Vault À CHAQUE EXÉCUTION : aucune
--    valeur sensible n'est figée dans la définition du job.
-- -----------------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'clonestory-outbox-every-5-minutes') then
    perform cron.unschedule('clonestory-outbox-every-5-minutes');
  end if;
end
$do$;

select cron.schedule(
  'clonestory-outbox-every-5-minutes',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets
                  where name = 'clonestory_outbox_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'clonestory_outbox_cron_secret')
      ),
      body     := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);


-- =============================================================================
-- REQUÊTES OPÉRATEUR (contrôle) — à exécuter à la demande, ne modifient rien.
-- =============================================================================

-- 3a) Présence et état du job (un seul attendu) :
-- select jobid, jobname, schedule, active
-- from cron.job
-- where jobname = 'clonestory-outbox-every-5-minutes';

-- 3b) Dernières exécutions (les plus récentes d'abord) :
-- select runid, status, return_message, start_time, end_time
-- from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'clonestory-outbox-every-5-minutes')
-- order by start_time desc
-- limit 20;

-- 3c) Échecs récents uniquement :
-- select runid, status, return_message, start_time
-- from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'clonestory-outbox-every-5-minutes')
--   and status <> 'succeeded'
-- order by start_time desc
-- limit 20;

-- 3d) Réponses HTTP renvoyées par la route (codes de statut, SANS le secret) :
-- select id, status_code, created
-- from net._http_response
-- order by created desc
-- limit 20;

-- 3e) URL appelée — affichée SANS jamais révéler le secret du cron
--     (on ne déchiffre que 'clonestory_outbox_url' ; le secret n'est pas lu) :
-- select
--   (select decrypted_secret from vault.decrypted_secrets where name = 'clonestory_outbox_url') as url_appelee,
--   exists (select 1 from vault.secrets where name = 'clonestory_outbox_cron_secret')            as secret_present;

-- 3f) Vérifier que la définition du job NE contient PAS de secret en clair
--     (doit montrer des expressions « decrypted_secret », pas la valeur) :
-- select jobname, command
-- from cron.job
-- where jobname = 'clonestory-outbox-every-5-minutes';

-- -----------------------------------------------------------------------------
-- Désinstallation (si besoin) :
-- select cron.unschedule('clonestory-outbox-every-5-minutes');
-- =============================================================================
