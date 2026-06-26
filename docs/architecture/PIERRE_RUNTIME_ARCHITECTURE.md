# Pierre Runtime Architecture (P8.1)

## Pipeline

```
intake → tenant resolution → auth → authz → input validation → mission analysis →
risk classification → mission persistence → task planning → dependency resolution →
human validation gate (if needed) → durable queueing → worker claim →
governed execution (CloneGuard) → result persistence → CloneTrace → retry/escalation →
mission aggregation → notification event → next-action scheduling
```

Every step is real (persisted), none is simulated. Long work runs in the worker,
never in the HTTP request.

## Layers (`src/lib/pierre/v1/`)

| File | Responsibility |
|---|---|
| `sql.ts` | `SqlExecutor` abstraction (one runtime; PGlite in tests, `pg`/Supabase in prod), tenant GUC binding, ids, idempotency keys |
| `db.ts` | production executor (lazy `pg` Pool over `DATABASE_URL`) |
| `errors.ts` | typed, classified, redacted runtime errors |
| `tenant-context.ts` | canonical `TenantContext`, role→permission, server-side membership resolution |
| `state-machine.ts` | the single mission/task state machine (allowed transitions, terminal states) |
| `channels.ts` | `MessageEnvelope` + channel identities for all current/future sources |
| `autonomy.ts` | 4 autonomy modes + validation policy engine (AUTO_EXECUTE … BLOCK_AND_ESCALATE) |
| `cloneguard.ts` | in-path guard (green/orange/red/black), sensitive HR hard-blocks |
| `analysis.ts` | deterministic request analysis (no AI in P8.1) → strict contract |
| `repositories.ts` | typed Postgres repos, cursor pagination, version-checked updates |
| `queue.ts` | durable queue: SKIP LOCKED claim, leases, backoff, dead-letter, recovery, caps |
| `executors.ts` | governed executor lifecycle; low-risk real executors; awaiting_integration |
| `mission-service.ts` | orchestration: idempotent create, governed transitions, validations, aggregation |
| `worker.ts` | claim→execute→persist→trace→retry/next; crash-safe |
| `api.ts` | framework-agnostic v1 handlers (used by routes + tests) |

`src/app/api/pierre/v1/**` are thin route wrappers (`_runtime.ts` resolves auth +
TenantContext and maps errors).

## Multi-tenancy

`company_id = user_id` is NOT the model. A user has memberships
(`pierre_rt_members`) with a role; `resolveTenantContext` verifies membership
server-side. Workers never trust a client `company_id`. RLS is forced as
defense-in-depth (the service role bypasses it; restricted roles are isolated).

## Channels & autonomy

All sources (cockpit, email, voice, phone, sms, whatsapp, linkedin, slack, teams,
form, file, system, calendar, webhook, employee/manager message, proactive signal)
are modeled via `MessageEnvelope`; only cockpit/text/system/webhook are "live" in
P8.1, the rest are `awaiting_integration`. Autonomy modes (draft / normal /
high_autonomy / enterprise_autonomous) actually change the execution decision; the
validation policy engine classifies each action and sensitive/approval-required
actions are never auto-executed.

## Scale posture (built-for, not proven)

Horizontal workers (stateless, claim via SKIP LOCKED), per-tenant concurrency caps
(fairness), cursor pagination (no unbounded reads), indexed access paths, dead-letter
isolation, outbox for external effects. Partitioning/sharding/quotas/load-shedding
are future, but the schema and claim model do not require a rewrite to get there.
**100k is not proven without load tests.**
