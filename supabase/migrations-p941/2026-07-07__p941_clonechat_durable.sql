-- supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql
-- PHASE 9.4.1 — Durable CloneChat storage (conversations, messages, support/bug
-- memory, atomic budget ledger). ADDITIVE ONLY. Owned exclusively by P9.4.1.
--
-- CONSTRAINTS (enforced by placement + naming):
--   * This file lives in supabase/migrations-p941/ and its name does NOT contain
--     "pierre_v", so the P8 runtime harnesses (which filter on "pierre_v") NEVER
--     apply it. It touches NO P8 table and NO P8 function.
--   * Tenant-scoped tables use the SAME RLS pattern as the P8 runtime:
--     company_id::text = current_setting('app.current_company', true).
--   * Global neutralized tables (bug cases, budget counters) hold NO tenant PII —
--     bug content is redacted; budget rows are opaque scope keys + token counts.
--   * Applied to a real durable Postgres for proofs (embedded-postgres) and, for
--     production, to Supabase by a deliberate operator step (nothing deployed here).
--
-- Idempotent: safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).

-- ── App role assumed per request (mirrors P8's pierre_rt_app pattern) ─────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'clonechat_app') then
    create role clonechat_app nologin;
  end if;
end $$;

-- ── Conversations (tenant-scoped, durable, multi-device) ─────────────────────
create table if not exists clonechat_conversations (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null,
  user_id          uuid not null,
  title            text not null default 'Conversation',
  rolling_summary  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  archived_at      timestamptz
);
create index if not exists cc_conv_company_user_idx on clonechat_conversations (company_id, user_id, last_activity_at desc);

create table if not exists clonechat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references clonechat_conversations(id) on delete cascade,
  company_id      uuid not null,
  user_id         uuid not null,
  seq             bigint not null,
  role            text not null check (role in ('user','assistant','system')),
  -- content = rich blocks (text/cards/boundary). NEVER raw base64, NEVER secrets.
  content         jsonb not null default '[]'::jsonb,
  source_ids      text[] not null default '{}',
  action_proposal jsonb,
  action_result   jsonb,
  usage           jsonb,          -- token counts only
  image_meta      jsonb,          -- {mime,bytes,sanitizedHash} only — never the image
  created_at      timestamptz not null default now()
);
create unique index if not exists cc_msg_conv_seq_idx on clonechat_messages (conversation_id, seq);
create index if not exists cc_msg_company_idx on clonechat_messages (company_id, created_at desc);

-- ── Tenant-local support/bug occurrences (redacted) ──────────────────────────
create table if not exists clonechat_bug_occurrences (
  id               uuid primary key default gen_random_uuid(),
  fingerprint      text not null,
  company_id       uuid not null,
  user_id          uuid,
  route            text,
  release_channel  text,
  redacted_symptom text not null,
  evidence         jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists cc_bugocc_company_idx on clonechat_bug_occurrences (company_id, created_at desc);
create index if not exists cc_bugocc_fp_idx on clonechat_bug_occurrences (fingerprint);

-- ── Support cases (tenant-scoped) ────────────────────────────────────────────
create table if not exists clonechat_support_cases (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  user_id       uuid not null,
  fingerprint   text,
  title         text not null,
  status        text not null default 'reported'
                  check (status in ('reported','triaged','investigating','workaround_candidate',
                                    'workaround_verified','solution_candidate','solution_verified',
                                    'resolved','rejected','security_escalation')),
  severity      text not null default 'normal' check (severity in ('low','normal','high','security')),
  redacted_summary text not null,
  evidence      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cc_case_company_idx on clonechat_support_cases (company_id, created_at desc);

-- ── Global neutralized bug/solution knowledge (cross-tenant, redacted only) ───
-- Reusable ONLY when a workaround/solution has been VERIFIED. No tenant PII here.
create table if not exists clonechat_bug_cases (
  fingerprint   text primary key,
  title         text not null,
  symptoms      text[] not null default '{}',
  workaround    text,
  solution      text,
  status        text not null default 'reported'
                  check (status in ('reported','triaged','investigating','workaround_candidate',
                                    'workaround_verified','solution_candidate','solution_verified',
                                    'resolved','rejected','security_escalation')),
  reusable      boolean not null default false,   -- true ONLY after verification
  occurrences   integer not null default 0,
  evidence      jsonb not null default '[]'::jsonb,
  verified_by   text,
  verified_at   timestamptz,
  version       integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- ── Durable idempotence for effectful actions (P9.4.2, cross-session/instance) ─
-- Fingerprint = server-side hash(company_id, user_id, kind, key, day). A confirmed
-- effectful action claims its fingerprint atomically (INSERT ON CONFLICT DO NOTHING);
-- a reload/other-device re-confirm of the same logical action sees status='committed'
-- and is refused as a duplicate — durable, not just session-scoped.
create table if not exists clonechat_action_executions (
  fingerprint text primary key,
  company_id  uuid,
  user_id     uuid,
  kind        text not null,
  status      text not null default 'claimed' check (status in ('claimed','committed','failed')),
  result      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cc_exec_company_idx on clonechat_action_executions (company_id, created_at desc);

-- ── P9.4.2 r2 — Persisted proposals (server-authoritative) ───────────────────
-- Quand le modèle propose une action effective, le SERVEUR persiste la proposition
-- (payload canonique validé serveur). Le client confirme par proposal_id ; le serveur
-- RECHARGE la proposition et reconstruit l'action — jamais de payload de confiance client.
create table if not exists clonechat_proposals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  user_id       uuid not null,
  conversation_id uuid,
  action_kind   text not null,
  payload       jsonb not null default '{}'::jsonb,   -- payload canonique (serveur)
  created_at    timestamptz not null default now()
);
create index if not exists cc_prop_company_idx on clonechat_proposals (company_id, user_id, created_at desc);

-- ── P9.4.2 r2 — Durable command ledger (server-side, lease + crash recovery) ──
-- Identité canonique = SHA-256(company, actor, conversation, proposal, kind, payload).
-- Cycle : CONFIRMED → EXECUTING → SUCCEEDED | FAILED_RECOVERABLE | FAILED_TERMINAL | CANCELLED.
create table if not exists clonechat_commands (
  id             uuid primary key default gen_random_uuid(),
  fingerprint    text not null unique,                  -- SHA-256 canonical identity
  company_id     uuid not null,
  actor_id       uuid not null,
  conversation_id uuid,
  proposal_id    uuid,
  action_kind    text not null,
  payload_sha256 text not null,
  target_ref     text,                                  -- ex. mission_id / validation_id / case_id
  status         text not null default 'confirmed'
                   check (status in ('confirmed','executing','succeeded','failed_recoverable','failed_terminal','cancelled')),
  attempt_count  integer not null default 0,
  lease_owner    text,
  lease_expiry   timestamptz,
  result         jsonb,
  recovery       jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cc_cmd_company_idx on clonechat_commands (company_id, actor_id, created_at desc);
create index if not exists cc_cmd_lease_idx on clonechat_commands (status, lease_expiry);

-- ── Atomic budget ledger (global caps enforced across instances) ─────────────
-- Counters keyed by opaque scope (e.g. 'user:day:<uid>:2026-07-03'). committed =
-- real spent, reserved = worst-case in-flight. try_reserve locks rows FOR UPDATE
-- and re-checks caps -> two concurrent/instances cannot jointly exceed a cap.
create table if not exists clonechat_budget_counters (
  scope_key        text primary key,
  window_kind      text not null,
  committed_tokens bigint not null default 0,
  reserved_tokens  bigint not null default 0,
  updated_at       timestamptz not null default now()
);

create table if not exists clonechat_usage_events (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid,
  user_id       uuid,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  kind          text not null default 'chat',   -- chat | vision
  at            timestamptz not null default now()
);
create index if not exists cc_usage_at_idx on clonechat_usage_events (at desc);

-- Atomic multi-scope reserve. Returns true iff EVERY scope stays within its cap.
create or replace function clonechat_budget_try_reserve(
  p_scopes text[], p_kinds text[], p_caps bigint[], p_tokens bigint
) returns boolean language plpgsql as $$
declare i int; ok boolean := true; n int := coalesce(array_length(p_scopes,1),0);
begin
  if n = 0 then return true; end if;
  -- ensure rows exist, then lock them all (stable order = scope order) to avoid deadlock
  for i in 1..n loop
    insert into clonechat_budget_counters(scope_key, window_kind)
      values (p_scopes[i], p_kinds[i]) on conflict (scope_key) do nothing;
  end loop;
  for i in 1..n loop
    perform 1 from clonechat_budget_counters where scope_key = p_scopes[i] for update;
  end loop;
  -- re-check every cap under lock
  for i in 1..n loop
    if (select committed_tokens + reserved_tokens from clonechat_budget_counters where scope_key = p_scopes[i]) + p_tokens > p_caps[i] then
      ok := false;
    end if;
  end loop;
  if ok then
    for i in 1..n loop
      update clonechat_budget_counters
        set reserved_tokens = reserved_tokens + p_tokens, updated_at = now()
        where scope_key = p_scopes[i];
    end loop;
  end if;
  return ok;
end $$;

-- Commit actual usage: release the worst-case reserve, add the real committed amount.
create or replace function clonechat_budget_commit(
  p_scopes text[], p_reserved bigint, p_actual bigint
) returns void language plpgsql as $$
declare i int; n int := coalesce(array_length(p_scopes,1),0);
begin
  for i in 1..n loop
    update clonechat_budget_counters
      set reserved_tokens = greatest(0, reserved_tokens - p_reserved),
          committed_tokens = committed_tokens + p_actual,
          updated_at = now()
      where scope_key = p_scopes[i];
  end loop;
end $$;

-- Release a reservation that was never spent (openai failure / abort).
create or replace function clonechat_budget_release(
  p_scopes text[], p_reserved bigint
) returns void language plpgsql as $$
declare i int; n int := coalesce(array_length(p_scopes,1),0);
begin
  for i in 1..n loop
    update clonechat_budget_counters
      set reserved_tokens = greatest(0, reserved_tokens - p_reserved), updated_at = now()
      where scope_key = p_scopes[i];
  end loop;
end $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Tenant-scoped tables: isolated by company GUC (same pattern as P8 runtime).
do $$
declare t text;
begin
  foreach t in array array['clonechat_conversations','clonechat_messages','clonechat_bug_occurrences','clonechat_support_cases','clonechat_proposals','clonechat_commands']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists cc_iso_%1$s on %1$s', t);
    execute format('create policy cc_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
    execute format('grant select, insert, update, delete on %I to clonechat_app', t);
  end loop;
end $$;

-- Global neutralized tables: RLS enabled; clonechat_app may read reusable rows and
-- (with the internal GUC) write. No tenant isolation by design (global knowledge).
alter table clonechat_bug_cases enable row level security;
alter table clonechat_bug_cases force row level security;
drop policy if exists cc_bugcases_read on clonechat_bug_cases;
create policy cc_bugcases_read on clonechat_bug_cases for select using (
  reusable = true or current_setting('app.clonechat_internal', true) = 'true'
);
drop policy if exists cc_bugcases_write on clonechat_bug_cases;
create policy cc_bugcases_write on clonechat_bug_cases for all using (
  current_setting('app.clonechat_internal', true) = 'true'
) with check (
  current_setting('app.clonechat_internal', true) = 'true'
);
grant select, insert, update, delete on clonechat_bug_cases to clonechat_app;

alter table clonechat_budget_counters enable row level security;
alter table clonechat_budget_counters force row level security;
drop policy if exists cc_budget_all on clonechat_budget_counters;
create policy cc_budget_all on clonechat_budget_counters for all using (true) with check (true);
grant select, insert, update, delete on clonechat_budget_counters to clonechat_app;

alter table clonechat_usage_events enable row level security;
alter table clonechat_usage_events force row level security;
drop policy if exists cc_usage_all on clonechat_usage_events;
create policy cc_usage_all on clonechat_usage_events for all using (true) with check (true);
grant select, insert, update, delete on clonechat_usage_events to clonechat_app;

-- Idempotence : clé opaque (fingerprint) intégrant company+user ; contenu neutralisé.
alter table clonechat_action_executions enable row level security;
alter table clonechat_action_executions force row level security;
drop policy if exists cc_exec_all on clonechat_action_executions;
create policy cc_exec_all on clonechat_action_executions for all using (true) with check (true);
grant select, insert, update, delete on clonechat_action_executions to clonechat_app;

grant execute on function clonechat_budget_try_reserve(text[],text[],bigint[],bigint) to clonechat_app;
grant execute on function clonechat_budget_commit(text[],bigint,bigint) to clonechat_app;
grant execute on function clonechat_budget_release(text[],bigint) to clonechat_app;
