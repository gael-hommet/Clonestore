-- B38A — AI Cost Shield / Anti-ruine
-- Schema Supabase pour B38B+ (ledger in-memory en B38A)
-- Ces tables ne sont pas créées en B38A — elles seront activées en B38B lors de la validation Real AI.
-- RLS activé sur toutes les tables.

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. ai_usage_log
-- Enregistre chaque appel IA estimé ou réel.
-- Les appels bloqués (status=blocked) ou mock (status=mock) ne comptent pas dans le budget.
-- ────────────────────────────────────────────────────────────────────────────────

create table if not exists ai_usage_log (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid references companies(id) on delete set null,
  user_id            uuid references auth.users(id) on delete set null,
  agent_slug         text not null,                           -- "pierre", "cloneos", etc.
  employee_slug      text,
  mission_id         uuid,
  task_id            uuid,
  provider           text not null,                           -- "openai" | "anthropic" | "mock"
  model              text not null,                           -- "gpt-4.1", "gpt-4.1-mini", etc.
  use_case           text not null,                           -- "pierre.mission.interpret", etc.
  estimated_cost_cents  integer not null default 0,
  actual_cost_cents     integer,                              -- null until confirmed
  input_tokens       integer,
  output_tokens      integer,
  status             text not null default 'estimated'
                     check (status in ('estimated', 'confirmed', 'blocked', 'mock', 'error')),
  decision_status    text not null,                           -- AiCostShieldDecisionStatus
  is_client_visible  boolean not null default false,
  is_demo            boolean not null default false,
  is_public          boolean not null default false,
  shield_mode        text not null default 'enforce',
  access_level       text not null,                           -- AiCommercialAccessLevel
  created_at         timestamptz not null default now(),
  metadata           jsonb
);

-- Indexes for budget aggregation queries
create index if not exists ai_usage_log_company_date
  on ai_usage_log (company_id, created_at::date)
  where status not in ('blocked', 'mock');

create index if not exists ai_usage_log_user_date
  on ai_usage_log (user_id, created_at::date)
  where status not in ('blocked', 'mock');

create index if not exists ai_usage_log_global_date
  on ai_usage_log (created_at::date)
  where status not in ('blocked', 'mock');

create index if not exists ai_usage_log_mission
  on ai_usage_log (mission_id)
  where mission_id is not null and status not in ('blocked', 'mock');

-- RLS
alter table ai_usage_log enable row level security;

-- Internal admin: full read
create policy "ai_usage_log_internal_admin_read"
  on ai_usage_log for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'internal_admin'
    )
  );

-- Company members: read own company only
create policy "ai_usage_log_company_read"
  on ai_usage_log for select
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid()
    )
  );

-- Service role: full access (B38B server-side writes)
-- No policy needed — service role bypasses RLS

-- ────────────────────────────────────────────────────────────────────────────────
-- 2. ai_budget_snapshots
-- Agrégats pré-calculés par scope et période.
-- Mis à jour par un job ou trigger après chaque ai_usage_log insert confirmé.
-- ────────────────────────────────────────────────────────────────────────────────

create table if not exists ai_budget_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  scope              text not null,           -- "global_daily" | "company_daily" | "user_daily" | etc.
  scope_key          text not null,           -- "global:2026-05-25" | "company:co_abc:2026-05-25" | etc.
  period_start       date not null,
  period_end         date not null,
  used_cents         integer not null default 0,
  max_cents          integer not null,
  remaining_cents    integer generated always as (max_cents - used_cents) stored,
  exceeded           boolean generated always as (used_cents >= max_cents) stored,
  company_id         uuid references companies(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete cascade,
  last_updated_at    timestamptz not null default now(),
  unique (scope, scope_key, period_start)
);

create index if not exists ai_budget_snapshots_scope_key
  on ai_budget_snapshots (scope, scope_key, period_start);

alter table ai_budget_snapshots enable row level security;

create policy "ai_budget_snapshots_internal_admin_read"
  on ai_budget_snapshots for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'internal_admin'
    )
  );

create policy "ai_budget_snapshots_company_read"
  on ai_budget_snapshots for select
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────────
-- 3. ai_shield_events
-- Log des événements de blocage du cost shield.
-- Conservé pour audit et analyse. Jamais de PII ni de contenu de prompt.
-- ────────────────────────────────────────────────────────────────────────────────

create table if not exists ai_shield_events (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid references companies(id) on delete set null,
  user_id            uuid references auth.users(id) on delete set null,
  agent_slug         text not null,
  use_case           text not null,
  provider           text not null,
  model              text not null,
  access_level       text not null,
  decision_status    text not null,           -- AiCostShieldDecisionStatus
  shield_mode        text not null,
  reason             text not null,           -- Log interne, pas de PII
  estimated_cost_cents  integer not null default 0,
  is_demo            boolean not null default false,
  is_public          boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists ai_shield_events_company_date
  on ai_shield_events (company_id, created_at::date);

create index if not exists ai_shield_events_decision_status
  on ai_shield_events (decision_status, created_at::date);

alter table ai_shield_events enable row level security;

create policy "ai_shield_events_internal_admin_read"
  on ai_shield_events for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'internal_admin'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────────
-- 4. Helper views
-- ────────────────────────────────────────────────────────────────────────────────

-- Daily cost by company (today)
create or replace view ai_cost_today_by_company as
select
  company_id,
  sum(estimated_cost_cents) as estimated_cents,
  sum(coalesce(actual_cost_cents, estimated_cost_cents)) as total_cents,
  count(*) as call_count,
  current_date as date
from ai_usage_log
where
  created_at::date = current_date
  and status not in ('blocked', 'mock')
group by company_id;

-- Global daily cost (today)
create or replace view ai_cost_today_global as
select
  sum(estimated_cost_cents) as estimated_cents,
  sum(coalesce(actual_cost_cents, estimated_cost_cents)) as total_cents,
  count(*) as call_count,
  current_date as date
from ai_usage_log
where
  created_at::date = current_date
  and status not in ('blocked', 'mock');

-- Block rate by access level (last 7 days)
create or replace view ai_shield_block_rate_7d as
select
  access_level,
  decision_status,
  count(*) as event_count,
  date_trunc('day', created_at) as day
from ai_shield_events
where created_at >= now() - interval '7 days'
group by access_level, decision_status, day
order by day desc, event_count desc;

-- ────────────────────────────────────────────────────────────────────────────────
-- 5. Migration notes
-- ────────────────────────────────────────────────────────────────────────────────

-- B38A: Tables NOT created. Ledger is in-memory only. No DB writes.
-- B38B: Run this migration to enable Supabase persistence.
--       Update budget-ledger.ts to use Supabase client instead of in-memory map.
--       Update decision.ts to read budget_snapshots from DB via context.
--       Set AI_LEDGER_MODE=supabase in environment.

-- B38C: Add alerting triggers (when used_cents > 80% of max_cents → notify internal_admin).
-- B38C: Add dashboard API routes reading from ai_budget_snapshots + ai_cost_today_* views.
