-- 2026-06-25 — Journal des exécutions planifiées (cron) Founder Access.
-- Preuve technique réelle qu'un ordonnanceur exécute bien le moteur email : chaque tick
-- enregistre son passage (statut, compteurs, durée). La carte « Cron email » du cockpit
-- en dérive son état (connecté/dégradé) — JAMAIS uniquement depuis l'existence d'un secret.
-- Métadonnées opérationnelles uniquement : aucune donnée personnelle, aucun contenu d'email.

create table if not exists clonestore_founder_cron_runs (
  id          bigint generated always as identity primary key,
  job_name    text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running', 'ok', 'error')),
  processed   integer not null default 0,
  sent        integer not null default 0,
  skipped     integer not null default 0,
  retried     integer not null default 0,
  dead        integer not null default 0,
  duration_ms integer,
  error_safe  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_founder_cron_runs_job_time
  on clonestore_founder_cron_runs (job_name, started_at desc);

-- Le rôle applicatif général lit/écrit ce journal opérationnel (pas de secret, pas de PII).
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    execute 'grant select, insert, update on clonestore_founder_cron_runs to pierre_rt_app';
  end if;
end $$;
