# P21 — Pierre Vision Parity & Autonomous Operations

**Date:** 2026-07-25
**HEAD at start:** `64e12d4b` · **HEAD after P21 fixes:** `a88a3492`
**Branch:** `main` · **Canonical Vercel project:** `clonestore-xcwi`
**Verification:** `tsc --noEmit` exit 0 (full repo) · 3889 Pierre unit tests green · scoped ESLint 0 on all changed files
**Not run:** full `next build` (documented RAM wall on this repo — see Reserves) · browser E2E of the new paths (see Reserves)

> Honesty doctrine for this report: every capability is tagged with one of
> `COMPLETE_EXECUTABLE` / `COMPLETE_EXTERNAL_PROVIDER_REQUIRED` / `PARTIAL` / `SIMULATED` /
> `ABSENT` / `BROKEN`, sourced from a fresh 6-dimension code audit of the *real* tree (not
> from prior memory, which is known to go stale/lost here). The words "terminé", "prêt",
> "final", "ultra-élite" are used **only** where matched by proof, and are avoided otherwise.

---

## 0. What P21 is, and what it is not

The prior "Pierre is done" verdicts (P16/P17/P19/P20) were true about *architecture, engines,
gates and test suites* but too narrow about *operational parity*. P21 re-audited the whole
product contract against real code, produced an exhaustive capability matrix, and then closed a
**bounded, high-leverage set of shared-infrastructure gaps** with real, tested, committed code.

P21 does **not** claim that every one of the ~13 HR operational families is now fully
executable end-to-end. That is materially false and the matrix below says so plainly. What P21
does claim, with proof: the *shared spine* that every family depends on — governance
consistency across execution paths, truthful failure/So-provider statuses, real trust scoring,
and an actually-triggerable continuity loop — was measurably advanced and is regression-tested.

---

## 1. Capability matrix (fresh audit, file:line evidence)

### Mission engine & task runtime

| Capability | Verdict | Evidence |
|---|---|---|
| Mission → tasks decomposition | PARTIAL | `mission/build-tasks.ts:383-605` real; **no dependency graph** (no `depends_on`), no engine-set priority; `mission/schedule.ts detectMissionSchedule` is dead code |
| Concurrency-safe claim / retry / backoff | COMPLETE_EXECUTABLE | `tasks/claim.ts:105-201` optimistic lock + stale reclaim; `tasks/retry.ts:80-127` 5→180min backoff |
| Durable multi-day pause/resume | COMPLETE_EXECUTABLE (parallel system) | `v1/cognitive-runtime` + `v1/runtime-service.ts:71,102-149` (`pierre_rt_mission_runs`, fencing lease, heartbeat) — **not integrated with `mission/`+`tasks/`** |
| 9 canonical failure statuses | **ABSENT → now REACHABLE (P21 FIX B)** | pre-P21 the literal names did not exist; `MISSING_PAYLOAD` was a dead literal. Now `tasks/canonical-status.ts` defines & maps all 9 |
| Governance on **every** execute path | **PARTIAL → BYPASS CLOSED (P21 FIX A)** | `tasks/execute-task.ts:339-466` always gated; `/execute`+`/action` gated; **`queue/process-task.ts` bypassed it** → fixed |
| CloneTrust reflects real history | **PARTIAL/static → now REAL (P21 FIX C)** | formula real (`hr/clonetrust.ts:275-436`) but execute path fed no history → always 50/supervised; now fed real aggregates |
| Retry + dead-letter (v1 worker) | COMPLETE_EXECUTABLE | `v1/worker.ts:145-154` `retry_scheduled`/`dead_lettered`; `/tick` route dead-letters after 6 attempts |
| Idempotency (double-send guard) | PARTIAL | real on `/execute`+`/action` (`request_id` replay); **`queue/process-task.ts` retry path still lacks an idempotency key** (Reserve R3) |

### Three user modes / continuity / voice

| Capability | Verdict | Evidence |
|---|---|---|
| Brouillon / Copilote / Autonomie selector | COMPLETE_EXECUTABLE | `v1/user-modes.ts:24-83` + `assertModesAreDistinct()` build-check; UI `PierreUserModeSwitch.tsx` |
| Server-authoritative mode persistence | COMPLETE_EXECUTABLE | `pierre_rt_companies.default_autonomy_mode`; optimistic PATCH in `v1-loopback.ts:157-172` |
| Mode changes execution behavior | COMPLETE_EXECUTABLE | `v1/mission-service.ts:143-206` mode is a hard planning ceiling; `decideValidation` sets initial task status |
| Continuity loop actually triggered | **PARTIAL → WIRED fail-closed (P21 FIX D)** | durable scheduler `v1/runtime-scheduler.ts` existed but nothing fired it; now `/api/cron/pierre-runtime` + `vercel.json` cron, gated off by default |
| Mode surfaced in CloneTrace | PARTIAL | mode persisted per mission but not emitted into the trace timeline UI (Reserve R4) |
| CloneVoice → mission | PARTIAL **by explicit design** | `api/assistant/transcribe/route.ts` real Whisper; transcript intentionally does **not** auto-create a mission (documented anti-auto-send boundary) |

### Employee 360 / CloneADN / CloneTrace / CloneBrief

| Capability | Verdict | Evidence |
|---|---|---|
| Employee 360 (living, queryable) | PARTIAL | real relational model `v1/employees.ts getEmployee360` UI-wired; a legacy JSON-blob route (`use/employee/[id]/file`) is an orphaned parallel path |
| CloneADN read for tone/autonomy | COMPLETE_EXECUTABLE | `use/submit/route.ts:315-329,746,1084` |
| CloneADN **blocking** gate in real flow | PARTIAL | `evaluatePierreActionWithCloneADN` exists+tested but **not called** in `submit/route.ts` (Reserve R1 — the one-call-site fix) |
| CloneTrace (persisted per-mission trace) | COMPLETE_EXECUTABLE | `v1/trace/canonical-event.ts` + real `insert into pierre_rt_events` |
| CloneBrief (done/pending/deadline/alert) | PARTIAL | engine+service+route complete & tested (`clonebrief/canonical/brief.ts`, `v1/brief-service.ts`) but **not rendered** in the cockpit (Reserve R2 — pure UI wiring) |

### HR operational families (the honest part)

Across families the audit found the **same structural truth**: three parallel engines —
(1) a live keyword→template→DB "V0" flow (`hr/workflows.ts` → `use/submit/route.ts` →
`documents/premium-document-system.ts`), (2) a real DB-backed V1 engine
(`v1/mission-service.ts` / `runtime-action-handlers.ts`), and (3) a large, well-typed but
**UI-orphaned V1 mission-pack canon** (`v1/hr-mission-packs/*`) whose many steps are bound to
`mission.noop`. The codebase's own `v1/hr-canon/capability-registry.ts` self-tags these
`MISSING`/`CONTRACT_ONLY`/`VERIFIED_EXISTING` — a rare and valuable ground-truth artifact.

| Family | Verdict | One-line truth |
|---|---|---|
| A Recruitment | PARTIAL | V0 opens a hiring dossier for real; CV parsing / shortlist / interview scheduling ABSENT; V1 `recruitment.ts` steps = `mission.noop` |
| B Hiring & contracts | **strongest** — COMPLETE_EXECUTABLE (core) + EXTERNAL (signature) | `v1/contracts.ts generateContract` real hashes/versions; amendments `VERIFIED_EXISTING`; DPAE ABSENT (text-line only); e-sign blocked on Yousign |
| D Preboarding/onboarding | PARTIAL (most mature) | `onboarding.run_plan` real, 10-step stateful, 3 integration tests; access-provisioning EXTERNAL (IdP not integrated); no dedicated UI |
| L Offboarding | PARTIAL (weakest) | `employee360.archive` real; `handover`/`exit_interview` = `mission.noop`; final-pay impact ABSENT |
| F Absences/planning | PARTIAL | `addAbsence` real + V0 relance tasks; recurrence detection is a **substring match** (SIMULATED); no cron fires the 48h relance |
| G Pré-paie | PARTIAL/SIMULATED | `analyticsCompute` real headcount/absentee/pending; "payroll anomalies" reuses the generic SLA query (no salary-delta logic); export = EXTERNAL (correct) |
| H Helpdesk | PARTIAL | no real inbound-message → classified → mission pipeline; `relations.hr_requests` routing = `mission.noop` |
| I Entretiens/formation | SIMULATED | `set_objectives`/`collect_feedback`/`scan_expiry` = `mission.noop`; completion not tracked over time |
| J Compensation | SIMULATED (orchestration) — **safety property holds** | every salary/equity path routes to `human(...)`; **no autonomous salary-decision branch exists** (verified) |
| K Sensitive cases | PARTIAL — **critical guard REAL** | `v1/cloneguard.ts:31-85` hard-blocks sanction/termination/harassment/discrimination/medical, enforced **twice** in `v1/worker.ts:80-99`; evidence chain-of-custody = `mission.noop` |
| M Reporting/multi-site | PARTIAL | real per-site metric compute; no scheduled report cron; no per-site validation circuits |

### Scalability (100k tenants)

Core V1 runtime audited: **no cross-tenant leak or in-memory-only mission/task source-of-truth
found**. Tenant isolation real (`v1/tenant-context.ts:70-142` + `tenant-tx.ts` per-tx
`app.current_company` + RLS), hot-path indexes present (450 `CREATE INDEX`), pagination on list
endpoints, SKIP-LOCKED queue/worker, dead-letter, observability. **PARTIAL/unverified:** AI
budget guard (a prior silent `catch{}` caused a real prod outage — see project memory), safe
caching, quotas, attachment-at-scale. **Coverage caveat (honest):** the tenant-filter sweep was
sampled on the core runtime, **not** exhaustively across every `db.query` call site — the
recommended next step is an automated CI grep-gate, not another manual pass.

---

## 2. What P21 actually changed (real, tested, committed — commit `a88a3492`)

All four are **shared-spine** fixes: each lifts every HR family at once, rather than wiring one
family's happy path. Each is additive, regression-tested, and does not weaken any safety floor.

### FIX A — Governance re-evaluation on the queue worker path
`src/lib/pierre/queue/process-task.ts` previously called `executePierreTask` directly, trusting
only governance flags baked into `payload_json` at *creation* time. A task created by a path that
never classified it (or whose flags were stripped) could therefore auto-execute a black-level
action on the queue path. **Now** CloneGuard + governance are re-run on the live task content
before execution, and any `refuse`/`block` decision hard-blocks the task (status `blocked`,
`GOVERNANCE_BLOCKED`, a visible `task_governance_blocked` alert) — it is **never** transitioned to
`running`. Scoped to hard-blocks so benign drafts are **not** over-blocked (proven by test).
*Proof:* `__tests__/queue-process-task-governance.test.ts` — a harcèlement task is blocked and
never runs; a benign attestation still completes.

### FIX B — Canonical failure statuses + integration availability (never simulate a send)
New pure module `src/lib/pierre/tasks/canonical-status.ts` makes the **nine mandated statuses**
(`BLOCKED`, `NEEDS_INFORMATION`, `NEEDS_HUMAN_VALIDATION`, `PERMISSION_DENIED`, `UNSUPPORTED`,
`PROVIDER_UNAVAILABLE`, `INTEGRATION_UNAVAILABLE`, `FAILED`, `RETRY_SCHEDULED`) real and
reachable, with a total, deterministic mapper from the internal outcomes. It also resolves
**integration availability** per task: a send/sync task whose provider is not configured surfaces
`INTEGRATION_UNAVAILABLE` (with the missing env keys) instead of a false "completed". This is
**wired into the real execution result** in `execute-task.ts` (`canonical_status` +
`integration_status` on both `result_json` and the returned object) so it is not a dead module.
No execution behavior was flipped (respecting the existing `email.send`→`email.draft` invariant).
*Proof:* `__tests__/canonical-status.test.ts` — all 9 statuses produced; unconfigured email send →
`INTEGRATION_UNAVAILABLE`; configured provider → clean.

### FIX C — CloneTrust fed real history
`execute-task.ts` now computes real trust aggregates (`historical_success_rate`,
`historical_task_count`) from the tenant's own `pierre_tasks` history and passes them to
`evaluateGovernance`, so a proven tenant earns higher autonomy instead of everyone defaulting to
50/"supervised". Fully defensive: any query failure or a fresh tenant → nulls → **identical to
prior safe behavior** (no regression, and it can only *raise* trust for a real track record;
CloneGuard/ClonePolicy hard-blocks are unaffected).

### FIX D — Continuity actually triggerable (fail-closed)
Pierre's durable scheduler (`v1/runtime-scheduler.ts`: lease recovery, DB-native wait/wake,
idempotent outbox, bounded relances — never a business action) existed but nothing ever fired it.
New `/api/cron/pierre-runtime` route runs it in-process, plus a `vercel.json` cron
(`*/15 * * * *`). It is **fail-closed on two independent axes** (pure gate
`continuity/cron-gate.ts`): it is a no-op unless `PIERRE_CONTINUITY_CRON_ENABLED="true"` **and** a
valid `CRON_SECRET`/runtime secret is presented (constant-time). Deploying the code does **not**
start autonomous operation — that stays an explicit, reversible owner decision.
*Proof:* `__tests__/continuity-cron-gate.test.ts` — disabled by default; refuses fail-open;
rejects wrong secret; runs only when enabled + correct secret.

---

## 3. P21 success criteria — honest scorecard

| Spec criterion | Status | Note |
|---|---|---|
| Three modes really distinct | **MET** (pre-existing) | build-time `assertModesAreDistinct()` |
| Every action has execute/validate/refuse path | **MET on the audited execution paths** | FIX A closed the last known bypass (queue) |
| Every failure produces a visible alert | **ADVANCED** | canonical statuses + `task_governance_blocked` log; not audited across *all* UI surfaces |
| Missions can wait & resume | **MET at engine level** | durable runtime real; auto-trigger now wired (FIX D, off by default) |
| No output claims a fictional external effect | **ADVANCED** | `INTEGRATION_UNAVAILABLE` surfaced; dispatch layer already honest |
| All HR families wired to the real engine | **NOT MET** | large canon still `mission.noop`; documented per-family above |
| Main journeys work in a real browser | **NOT VERIFIED THIS PASS** | Reserve R5 |
| 100k scalable architecture | **LIKELY (core verified), not exhaustively swept** | Reserve R6 |

**Verdict:** P21 delivered a real, tested, committed advance on the shared operational spine and
an exhaustive honest matrix. It did **not** achieve full vision parity across all HR families —
that remains a multi-block effort, scoped below. No "done/prêt/ultra-élite" claim is made.

---

## 4. Reserves (open, prioritized — each is a scoped, named next step)

- **R1 — CloneADN blocking gate not wired into the live submit flow.** Add one call to
  `evaluatePierreActionWithCloneADN` in `use/submit/route.ts` (~L1084) and gate task creation on
  its `blocked`/`requires_validation`. Logic exists and is tested; only a production call site is
  missing. *(Deliberately not done this pass: the 944-line central route needs a browser pass I
  couldn't complete within budget — doing it half-verified would be lower-integrity.)*
- **R2 — CloneBrief not rendered.** Replace the static "CloneBrief — Synthèses" chip in
  `PierreCockpitShell.tsx:333-353` with a real `fetch('/api/pierre/v1/brief?kind=morning')`.
  Backend complete & tested.
- **R3 — Queue idempotency + dead-letter.** `queue/process-task.ts` retry path lacks an
  idempotency key and a dedicated dead-letter store (both exist on `/tick`). Mirror them.
- **R4 — Mode in CloneTrace.** Emit `autonomy_mode`/`userModeId` into the canonical trace event.
- **R5 — Browser E2E.** Desktop + mobile pass of the queue-block path, `INTEGRATION_UNAVAILABLE`
  surfacing, and (if enabled in a test env) the continuity tick. Not run this pass.
- **R6 — `next build` + tenant-filter CI gate.** Full build was not run (documented RAM wall);
  tsc + 3889 tests + scoped eslint stand in as compile evidence. Add an automated grep-gate that
  every `db.query` call carries a tenant filter.
- **R7 — HR family wiring backlog** (largest): rebind the `mission.noop` steps in
  `recruitment.ts`, `offboarding.ts` (`exit_interview`), `performance.ts`, `training.ts`,
  `employee-relations.ts` (evidence chain-of-custody) to real actions using the pattern already
  proven by `contract-changes.ts`. Add a real `overdueJustificatifsDetector` to
  `runProactiveDetectionTick` and let FIX D's cron fire it. Add DPAE dossier doc type.

---

## 5. Provenance & method

- Six parallel read-only audit agents mapped: mission engine/governance/taxonomy · Employee
  360/CloneADN/CloneTrace/CloneBrief · modes/continuity/voice · recruitment/hiring/onboarding/
  offboarding · absences/pré-paie/compensation/entretiens · helpdesk/sensitive/reporting/
  scalability. All findings carry file:line citations against the live tree.
- Every P21 code change was type-checked (`tsc` exit 0, full repo), lint-clean (scoped eslint 0),
  and covered by a new regression test; the broad Pierre suite (3889 tests) stayed green.
- Committed via `isomorphic-git` (git.exe is OS-blocked here) with an explicit 9-path allowlist,
  forbidden-pattern guard, and blob-vs-disk verification. Commit `a88a3492` (parent `64e12d4b`).
  No `.env`/secrets/`.next-*`/`node_modules` staged.
