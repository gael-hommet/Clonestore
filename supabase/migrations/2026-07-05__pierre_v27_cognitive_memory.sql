-- 2026-07-05__pierre_v27_cognitive_memory.sql
-- PHASE 8.14 (D2) — durable operational cognitive memory for the Pierre cognitive runtime. Additive:
-- one new tenant table on the existing pierre_rt_* runtime DB (no second runtime, no change to prior
-- tables). Persists THE WORK (request, interpretation, resolved entities, plan versions, blockers, next
-- expected event, terminal state) — NEVER chain-of-thought, raw prompts, or secrets (enforced in-app by
-- assertNoHiddenReasoning; the schema has no column for them). RLS-isolated to app.current_company like
-- every other pierre_rt_ table. Restart-safe via optimistic version + updated_at.

create table if not exists pierre_rt_cognitive_operations (
  operation_id            uuid primary key default gen_random_uuid(),
  company_id              uuid not null,
  actor_id               uuid not null,
  original_request        text not null,
  normalized_objective    text not null default '',
  interpretation          jsonb not null default '{}'::jsonb,
  resolved_entities       jsonb not null default '{}'::jsonb,   -- label -> resolved id (ids/labels only)
  confirmed_facts         jsonb not null default '[]'::jsonb,
  rejected_assumptions    jsonb not null default '[]'::jsonb,
  ambiguities             jsonb not null default '[]'::jsonb,
  clarifications          jsonb not null default '[]'::jsonb,   -- questions + answers
  plan_versions           jsonb not null default '[]'::jsonb,   -- fingerprints + step summaries per version
  active_plan_fingerprint text,
  mission_id              uuid,
  mission_run_id          uuid,
  completed_steps         jsonb not null default '[]'::jsonb,
  pending_steps           jsonb not null default '[]'::jsonb,
  approvals               jsonb not null default '[]'::jsonb,
  human_decisions         jsonb not null default '[]'::jsonb,
  blockers                jsonb not null default '[]'::jsonb,   -- legal/provider/permission blockers
  evidence_refs           jsonb not null default '[]'::jsonb,
  next_expected_event     text,
  retry_state             jsonb not null default '{}'::jsonb,
  terminal_state          text not null default 'AWAITING_INFORMATION',
  version                 integer not null default 1,           -- optimistic concurrency
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_rt_cog_ops_company on pierre_rt_cognitive_operations (company_id);
create index if not exists idx_rt_cog_ops_mission on pierre_rt_cognitive_operations (company_id, mission_id);

-- RLS: same tenant-isolation contract as the rest of pierre_rt_ (bound to app.current_company GUC).
alter table pierre_rt_cognitive_operations enable row level security;
alter table pierre_rt_cognitive_operations force row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    execute 'grant select, insert, update, delete on pierre_rt_cognitive_operations to pierre_rt_app';
  end if;
end$$;
drop policy if exists rt_iso_pierre_rt_cognitive_operations on pierre_rt_cognitive_operations;
create policy rt_iso_pierre_rt_cognitive_operations on pierre_rt_cognitive_operations
  using (company_id::text = current_setting('app.current_company', true))
  with check (company_id::text = current_setting('app.current_company', true));

-- ── D5: durable proactive signals (dedup across scheduler ticks) ────────────────────────────────────
create table if not exists pierre_rt_proactive_signals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  signal_key    text not null,          -- e.g. contract.expiring
  subject_ref   text not null,          -- opaque id, never raw PII
  dedup_key     text not null,          -- `${signal_key}:${subject_ref}` — one live signal per (key,subject)
  severity      text not null default 'warning',
  status        text not null default 'open',  -- open | handled | closed
  mission_id    uuid,                   -- the governed mission opened for it, if any
  detected_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, dedup_key)        -- idempotent detection: a duplicate tick is a no-op
);
create index if not exists idx_rt_signals_company_status on pierre_rt_proactive_signals (company_id, status);

-- ── D8: durable company-scoped learning from corrections (never cross-tenant, never legal) ───────────
create table if not exists pierre_rt_cognitive_learning (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  actor_id     uuid not null,
  scope         text not null,          -- temporary_instruction | company_preference | company_policy
  text          text not null,          -- neutralized (no tenant identifiers)
  approved      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_rt_learning_company_scope on pierre_rt_cognitive_learning (company_id, scope, approved);

-- ── P8.14 §4/§5: durable analytics/computation artifacts (real domain-computation output, persisted) ──
create table if not exists pierre_rt_analytics_artifacts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  mission_id    uuid,
  metric        text not null,          -- e.g. headcount, turnover, absenteeism, payroll_anomalies, pay_equity_gap
  scope         text not null default 'company',
  result        jsonb not null,         -- the computed values (facts, never fabricated)
  computed_at   timestamptz not null default now()
);
create index if not exists idx_rt_analytics_company_metric on pierre_rt_analytics_artifacts (company_id, metric, computed_at desc);

do $$
declare t text;
begin
  foreach t in array array['pierre_rt_proactive_signals','pierre_rt_cognitive_learning','pierre_rt_analytics_artifacts']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    if exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
      execute format('grant select, insert, update, delete on %I to pierre_rt_app', t);
    end if;
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end$$;
