-- P22 depth — full recruitment workflow objects (applications, interviews, feedback, offers).
-- Builds on pierre_v29 (requisitions, candidates). Idempotent, PGlite + Postgres 16, RLS tenant-iso.
-- Pierre analyses/prepares/tracks; it never auto-decides hiring, ranks on a protected characteristic,
-- invents experience, or auto-sends an offer (offers stay draft → human validation).

create table if not exists pierre_rt_recruitment_applications (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  candidate_id   uuid not null references pierre_rt_recruitment_candidates(id) on delete cascade,
  requisition_id uuid references pierre_rt_recruitment_requisitions(id) on delete set null,
  mission_id     uuid references pierre_rt_missions(id) on delete set null,
  source         text,
  cv_file_id     uuid references pierre_rt_files(id) on delete set null,
  consent        boolean not null default false,
  status         text not null default 'received' check (status in ('received','under_review','shortlisted','rejected','withdrawn')),
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        integer not null default 1
);
create index if not exists idx_rt_applications_company on pierre_rt_recruitment_applications(company_id);
create index if not exists idx_rt_applications_candidate on pierre_rt_recruitment_applications(candidate_id);

create table if not exists pierre_rt_recruitment_interviews (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  candidate_id   uuid not null references pierre_rt_recruitment_candidates(id) on delete cascade,
  requisition_id uuid references pierre_rt_recruitment_requisitions(id) on delete set null,
  mission_id     uuid references pierre_rt_missions(id) on delete set null,
  interview_type text not null default 'phone' check (interview_type in ('phone','technical','manager','hr','panel','final')),
  scheduled_at   timestamptz,
  participants   jsonb not null default '[]'::jsonb,
  guide_ref      text,
  status         text not null default 'prepared' check (status in ('prepared','scheduled','completed','cancelled','no_show')),
  report         text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        integer not null default 1
);
create index if not exists idx_rt_interviews_company on pierre_rt_recruitment_interviews(company_id);
create index if not exists idx_rt_interviews_candidate on pierre_rt_recruitment_interviews(candidate_id);

create table if not exists pierre_rt_recruitment_feedback (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references pierre_rt_companies(id) on delete cascade,
  interview_id    uuid not null references pierre_rt_recruitment_interviews(id) on delete cascade,
  candidate_id    uuid not null references pierre_rt_recruitment_candidates(id) on delete cascade,
  author_user_id  uuid,
  recommendation  text not null default 'no_decision' check (recommendation in ('no_decision','advance','hold','decline')),
  criteria        jsonb not null default '{}'::jsonb,
  reservations    text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  version         integer not null default 1
);
create index if not exists idx_rt_feedback_company on pierre_rt_recruitment_feedback(company_id);
create index if not exists idx_rt_feedback_interview on pierre_rt_recruitment_feedback(interview_id);

create table if not exists pierre_rt_recruitment_offers (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  candidate_id     uuid not null references pierre_rt_recruitment_candidates(id) on delete cascade,
  requisition_id   uuid references pierre_rt_recruitment_requisitions(id) on delete set null,
  mission_id       uuid references pierre_rt_missions(id) on delete set null,
  role_title       text not null,
  proposed_comp    jsonb not null default '{}'::jsonb,
  contract_type    text,
  document_id      uuid references pierre_rt_documents(id) on delete set null,
  validation_id    uuid references pierre_rt_validations(id) on delete set null,
  -- Offers are NEVER auto-sent: they start 'draft' and require human validation before 'sent'.
  status           text not null default 'draft' check (status in ('draft','awaiting_validation','approved','sent','accepted','declined','withdrawn')),
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1
);
create index if not exists idx_rt_offers_company on pierre_rt_recruitment_offers(company_id);
create index if not exists idx_rt_offers_candidate on pierre_rt_recruitment_offers(candidate_id);

do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_recruitment_applications','pierre_rt_recruitment_interviews',
    'pierre_rt_recruitment_feedback','pierre_rt_recruitment_offers'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end $$;
