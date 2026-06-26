-- =============================================================================
-- Founder Access — Déclencheur du cron email via Supabase Cron (pg_cron + pg_net)
-- =============================================================================
-- SCRIPT OPÉRATEUR — NON appliqué automatiquement (hors supabase/migrations/, donc
-- jamais pris par `npm run db:migrate:pg`). À exécuter MANUELLEMENT par l'opérateur
-- dans le SQL Editor Supabase (projet Pro) au moment de l'activation production.
--
-- POURQUOI : Vercel Hobby n'autorise pas les crons « plusieurs fois par jour ».
-- L'entrée `/api/cron/founder-email */10 * * * *` a donc été RETIRÉE de vercel.json.
-- On déclenche depuis Supabase Pro (pg_cron) toutes les 10 minutes, qui appelle
-- (pg_net) la route publique EXISTANTE et INCHANGÉE :
--     GET https://clonestore.pro/api/cron/founder-email
--     Authorization: Bearer <secret>          (= CRON_SECRET attendu par cette route)
-- Cette route relaie ensuite en interne vers /api/internal/founder-access/email-tick
-- avec son propre secret (CLONESTORE_FOUNDER_EMAIL_CRON_SECRET) — logique inchangée,
-- envois métier idempotents (worker email Founder Access).
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
--    -- URL publique de la route cron founder-email :
--    select vault.create_secret(
--      '<<https://clonestore.pro/api/cron/founder-email>>',
--      'founder_email_cron_url',
--      'Founder Access — URL de la route cron email (déclenchée par pg_cron)'
--    );
--
--    -- Secret Bearer attendu par /api/cron/founder-email (= valeur de CRON_SECRET côté Vercel) :
--    select vault.create_secret(
--      '<<REMPLACER_PAR_LA_VALEUR_DE_CRON_SECRET>>',
--      'founder_email_cron_secret',
--      'Founder Access — secret Bearer attendu par /api/cron/founder-email (= CRON_SECRET)'
--    );
--
--    Pour FAIRE TOURNER un secret existant (ex. après rotation) :
--    select vault.update_secret(
--      (select id from vault.secrets where name = 'founder_email_cron_secret'),
--      '<<NOUVELLE_VALEUR_DE_CRON_SECRET>>'
--    );
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- 2) (Ré)installation IDEMPOTENTE du job — un SEUL job actif sous ce nom.
--    On dé-planifie d'abord l'éventuel job existant (par nom), puis on (re)crée.
--    Le `command` lit l'URL ET le secret depuis Vault À CHAQUE EXÉCUTION : aucune
--    valeur sensible n'est figée dans la définition du job. Pas de duplication des
--    envois métier : un seul job → un seul tick toutes les 10 minutes.
-- -----------------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from cron.job where jobname = 'founder-email-every-10-minutes') then
    perform cron.unschedule('founder-email-every-10-minutes');
  end if;
end
$do$;

select cron.schedule(
  'founder-email-every-10-minutes',
  '*/10 * * * *',
  $job$
    select net.http_get(
      url     := (select decrypted_secret from vault.decrypted_secrets
                  where name = 'founder_email_cron_url'),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'founder_email_cron_secret')
      ),
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
-- where jobname = 'founder-email-every-10-minutes';

-- 3b) Dernières exécutions (les plus récentes d'abord) :
-- select runid, status, return_message, start_time, end_time
-- from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'founder-email-every-10-minutes')
-- order by start_time desc
-- limit 20;

-- 3c) Échecs récents uniquement :
-- select runid, status, return_message, start_time
-- from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'founder-email-every-10-minutes')
--   and status <> 'succeeded'
-- order by start_time desc
-- limit 20;

-- 3d) Réponses HTTP renvoyées par la route (codes de statut, SANS le secret) :
-- select id, status_code, created
-- from net._http_response
-- order by created desc
-- limit 20;

-- 3e) Présence des secrets Vault SANS afficher leur contenu
--     (on liste les noms ; on ne déchiffre rien) :
-- select name, description, created_at
-- from vault.secrets
-- where name in ('founder_email_cron_url', 'founder_email_cron_secret');

-- 3f) Vérifier que la définition du job NE contient PAS de secret en clair
--     (doit montrer des expressions « decrypted_secret », pas la valeur) :
-- select jobname, command
-- from cron.job
-- where jobname = 'founder-email-every-10-minutes';

-- -----------------------------------------------------------------------------
-- Désinstallation (si besoin) :
-- select cron.unschedule('founder-email-every-10-minutes');
-- =============================================================================
