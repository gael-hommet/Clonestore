# Pierre State Machines (P8.1)

Single source: `src/lib/pierre/v1/state-machine.ts`. No route/component changes a
status with a bare UPDATE — all transitions go through `mission-service` which
asserts the transition, enforces optimistic concurrency (`version`), and emits a
CloneTrace event.

## Mission states

`draft → analyzing → {awaiting_info | planned | awaiting_validation} → {ready |
queued} → in_progress → {partially_completed | done}` with side-paths to `blocked`,
`failed`, `retry_scheduled`, `cancelled`, `escalated`, `archived`.

Terminal: `done`, `cancelled`, `archived`.

## Task states

`draft → planned → {awaiting_info | awaiting_validation | ready} → queued → leased →
in_progress → {succeeded | failed}` with side-paths to `retry_scheduled`, `blocked`,
`cancelled`, `escalated`, `archived`.

Terminal: `succeeded`, `cancelled`, `archived`.

## Rules enforced (and tested)

- **Illegal transitions are rejected** (`RuntimeError code=illegal_transition`).
  e.g. `mission queued → archived` is refused; aggregation walks the legal path
  `queued → in_progress → done`.
- **Optimistic concurrency**: a stale `version` update raises `version_conflict`.
  Two concurrent transitions cannot both win.
- **Worker path**: a claimed task advances `queued → leased → in_progress` before
  execution; never jumps straight to `in_progress`.
- **Aggregation**: after each task the mission status is recomputed from its tasks
  (all succeeded → done; any running → in_progress; mixed failure → partially_completed).
- Every transition writes an event row with `prev_state`, `new_state`, `actor_type`,
  `reason`.

## Why centralized

A second state machine (e.g. the legacy localStorage controlled-mission model) is
explicitly deprecated. There is exactly one canonical machine to avoid divergence,
duplicated rules, and the "free update" anti-pattern.
