-- supabase/migrations/2026-06-24_03__clonestory_fp_email_outbox.sql
-- CLONESTORY — PATCH D'ATOMICITÉ : outbox email. L'inscription crée le partenaire,
-- le hash du token de vérification ET une commande email `pending` dans UNE SEULE
-- transaction → aucun compte orphelin si l'envoi échoue. La reprise (worker) RÉÉMET
-- un token frais à l'envoi : AUCUN token brut n'est jamais stocké ici.
-- Idempotent. Filtre migrator : clonestory_fp.

create table if not exists clonestory_fp_email_outbox (
  id              bigint generated always as identity primary key,
  partner_id      uuid not null references clonestory_fp_partners(id) on delete cascade,
  kind            text not null check (kind in ('verification','access')),
  idempotency_key text not null unique,         -- une seule commande LOGIQUE par partenaire/kind
  status          text not null default 'pending'
                    check (status in ('pending','sent','failed_retryable','dead')),
  attempts        integer not null default 0,
  max_attempts    integer not null default 6,
  resend_count    integer not null default 0,   -- réarmements (réinscription) — borné
  to_email        text not null,                -- destinataire (PII fonctionnelle, pas un secret)
  last_error      text,
  next_attempt_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_csy_outbox_due on clonestory_fp_email_outbox(status, next_attempt_at);
create index if not exists idx_csy_outbox_partner on clonestory_fp_email_outbox(partner_id);

-- RLS forcée + accès SERVICE uniquement (jamais lisible/modifiable par un membre).
alter table clonestory_fp_email_outbox enable row level security;
alter table clonestory_fp_email_outbox force row level security;
grant select, insert, update on clonestory_fp_email_outbox to pierre_rt_app;

drop policy if exists csy_outbox_access on clonestory_fp_email_outbox;
create policy csy_outbox_access on clonestory_fp_email_outbox for all
  using (nullif(current_setting('app.clonestory_service', true), '') = 'on')
  with check (nullif(current_setting('app.clonestory_service', true), '') = 'on');
