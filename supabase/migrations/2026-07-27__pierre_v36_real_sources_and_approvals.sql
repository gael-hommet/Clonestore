-- P22 Reprise 11 — real source objects, persisted source verification, canonical approvals.
-- Additive only (never touches v33/v34/v35). Gives training source validation REAL tenant objects to
-- resolve against (a bare source_ref is no longer a source), and persists a durable verification record.

-- 1. Company policies — a real, versioned, tenant-scoped policy object (the company_policy source).
create table if not exists pierre_rt_company_policies (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  policy_key  text not null,
  title       text not null,
  category    text not null default 'hr',
  status      text not null default 'active' check (status in ('draft','active','archived')),
  version     integer not null default 1,
  created_by  uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (company_id, policy_key)
);
create index if not exists idx_rt_company_policies_company on pierre_rt_company_policies(company_id);

-- 2. Training providers — a real, configured, tenant-scoped provider (the provider source).
create table if not exists pierre_rt_training_providers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  provider_key text not null,
  name        text not null,
  status      text not null default 'active' check (status in ('draft','active','suspended')),
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  unique (company_id, provider_key)
);
create index if not exists idx_rt_training_providers_company on pierre_rt_training_providers(company_id);

-- 3. Source verifications — durable proof that a requirement's source was really resolved to an object.
create table if not exists pierre_rt_training_source_verifications (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  requirement_id uuid not null references pierre_rt_training_requirements(id) on delete cascade,
  source_type    text not null,
  source_id      text,           -- the resolved object id (or the ref that failed to resolve)
  source_version text,
  status         text not null check (status in ('verified','unverified','not_found')),
  reason         text not null default '',
  evidence_ref   text,
  verified_by    uuid, verified_at timestamptz not null default now(),
  unique (company_id, requirement_id)
);
create index if not exists idx_rt_train_src_verif_req on pierre_rt_training_source_verifications(requirement_id);

do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_company_policies','pierre_rt_training_providers','pierre_rt_training_source_verifications'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end $$;
