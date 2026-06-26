-- supabase/migrations/2026-06-20__clonestore_founder_email_queue.sql
-- PHASE E.3 — File d'envoi email robuste. Idempotent. S'applique après les
-- migrations Founder Access (tri par date : 2026-06-20 > 2026-06-19).
--
-- Ajoute le verrouillage (claim atomique), le retry exponentiel, le dead-letter
-- et la traçabilité fournisseur à clonestore_founder_email_jobs.

alter table clonestore_founder_email_jobs add column if not exists locked_at           timestamptz;
alter table clonestore_founder_email_jobs add column if not exists locked_by           text;
alter table clonestore_founder_email_jobs add column if not exists next_attempt_at     timestamptz;
alter table clonestore_founder_email_jobs add column if not exists provider_message_id text;
alter table clonestore_founder_email_jobs add column if not exists skipped_at          timestamptz;
alter table clonestore_founder_email_jobs add column if not exists skip_reason         text;

-- Autoriser l'état transitoire 'sending' (claim) + 'dead' (échec définitif).
alter table clonestore_founder_email_jobs drop constraint if exists clonestore_founder_email_jobs_status_check;
alter table clonestore_founder_email_jobs
  add constraint clonestore_founder_email_jobs_status_check
  check (status in ('pending','sending','sent','failed','skipped','dead'));

-- Index de claim : récupérer rapidement les jobs dus (pending + échéance passée).
create index if not exists idx_founder_email_jobs_claim
  on clonestore_founder_email_jobs(status, send_at)
  where status = 'pending';
