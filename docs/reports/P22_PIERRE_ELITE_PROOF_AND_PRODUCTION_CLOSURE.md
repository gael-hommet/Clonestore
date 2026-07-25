# P22 — Pierre Elite Proof & Production Closure

**Date:** 2026-07-25
**Depends on:** P21 (`docs/reports/P21_PIERRE_VISION_PARITY_AND_AUTONOMOUS_OPERATIONS.md`, commit `a88a3492`)
**Benchmark artifacts:** `docs/reports/P22_BENCHMARK_RESULTS.json` (V0 pure path) +
`docs/reports/P22_REAL_TECHNOLOGY_EXECUTION_RESULTS.json` (authoritative runtime path, continuation)

> This report states measured facts and refuses the words "terminé / clos / final / prêt /
> ultra-élite" wherever proof is absent. Where a target is missed, the miss is stated plainly.

---

## REPRISE 4 (P22 — close semantic gaps with real domain business effects — 2026-07-25, appended)

Acting on Reprise 3's honest matrix (16 semantic gaps, 72.9% business-effect). **Two reusable domain
actions added, both PROVEN on real SQL (PGlite + real migrations), reusing existing governed services:**
- **`employee.timeline.append`** → real `pierre_rt_employee_events` row (Employee-360 business object),
  FK-scoped, `employee.write`-gated, fail-closed on a missing employee. Reuses a new governed
  `appendEmployeeTimelineEvent` service (thin wrapper over the existing repo).
- **`hr.reconcile.apply`** → applies an external provider return as a real reconciliation event, or
  **AWAITS** it (`status: waiting`) when absent — never fakes a reconciliation.

**12 of the 16 gaps closed** (matrix recomputed, `P22_ACTION_SEMANTIC_GAP_MATRIX.json`):
- **7 reconcile-external** steps (offer/contract/onboarding-access/absence-payroll/payroll/
  compensation/communications) → `hr.reconcile.apply` — correctly classified GOVERNED_EXTERNAL_INTENT
  (they genuinely depend on a provider return; forcing a fabricated business object would be dishonest).
- **5 employee-scoped record steps** (GDPR objection, performance objectives, performance calibration,
  career wishes, disciplinary appeal) → `employee.timeline.append` — real Employee-360 records.

**Honest recomputed metrics (272 steps):** BUSINESS_EFFECT 43→48, TRACE_ONLY 111→99,
GOVERNED_EXTERNAL_INTENT 15→22, **semantic_gaps 16→4**,
**`business_effect_completion_rate` 72.9% → 92.3%** (48 / 52 business-kind steps).

**Real-SQL proof (8/8 integration tests green on PGlite):** `absence.record.create` (3),
`employee.timeline.append` (3: real row + tenant isolation + governed refusal),
`hr.reconcile.apply` (2: apply + await). Three domains now real-SQL-proven: absence, Employee-360
timeline, reconciliation.

**Honest limits — verdict stays WITHHELD (the §13 first gate is NOT fully met):**
- **4 semantic gaps remain** — `org.workforce_planning:record`, `recruitment.pipeline_management:track`,
  `relations.hr_requests:route`, `pierre_admin.country_config:bind_pack` — each needs a **new dedicated
  `pierre_rt_*` table + service** (no existing table fits); creating those migrations was out of honest
  reach this session (`NEW_TABLE_REQUIRED` in the matrix).
- The 92.3% is a **persistence-level** rate. The 5 employee-scoped steps persist real Employee-360
  timeline entries — a **lighter** representation than the dedicated tables the spec envisions
  (`performance.objective.record`, `training.enrollment.create`, a ticket table, …), which do not exist.
- Only **3** of the 7 requested domain families are real-SQL-proven (absence, employee-360,
  reconciliation) — recruitment/onboarding/payroll/performance/training/offboarding/helpdesk still lack
  dedicated business-object tables/actions.
- Still not done: usable rich document content (≥95%), 18-mission × 3-mode real-DB E2E, browser proof,
  11h35→12min human-time, live providers, `PRODUCTION_AUTHORIZED`.

**Reprise 4 verdict: P22 — OPERATIONAL CLOSURE STILL WITHHELD.** Real progress —
`business_effect_completion_rate` 72.9%→92.3%, 12/16 gaps closed, 3 domains real-SQL-proven — but the
elite gate (0 gaps, 7 domain families, usable docs, 18 missions, browser, human-time) is not met.

Verification: `tsc` exit 0, scoped ESLint 0, 326 v1-unit/pack/canon tests + 8 real-SQL integration
tests green. 0 OpenAI calls.

---

## REPRISE 3 (P22 — SEMANTIC correction: trace ≠ business effect — 2026-07-25, appended, prior evidence preserved)

**Correction of the previous verdict (mandatory, accepted):** Reprise 2 reported
`operational_completion_rate: 100%`. That was **misleading and is REJECTED.** Eliminating literal
`mission.noop` and making every step *bind to a real action* is real, but binding many different
business steps to `hr.record.append` (which persists a `pierre_rt_events` row) is a **TRACE**, not a
**BUSINESS EFFECT** — it does not prove Pierre created/modified the actual HR record (absence,
candidate, requisition, checklist, payroll variable, …). The benchmark JSON field is renamed
`action_binding_completion_rate` with an explicit `CORRECTION` note; prior evidence is preserved.

**TRACE_PERSISTED vs BUSINESS_EFFECT_COMPLETED — honest semantic matrix**
(`docs/reports/P22_ACTION_SEMANTIC_GAP_MATRIX.json`, 272 runtime-action steps):

| Classification | Count | Counts as business completion? |
|---|---|---|
| BUSINESS_EFFECT (document.generate, absence.record.create, analytics.compute, follow_up.schedule) | 43 | yes (persistence-level) |
| TRACE_ONLY (hr.record.append) | 111 | **no** |
| GENERIC_COLLECTION_ONLY (hr.data.collect) | 51 | **no** |
| GOVERNED_EXTERNAL_INTENT (communication/signature/wait) | 15 | governed intent |
| HUMAN_DECISION_BOUNDARY (approval.request) | 9 | legitimate human wait |
| STRUCTURAL (mission.complete + reads) | 43 | n/a |

- **`business_effect_completion_rate = 72.9%`** (43 real business-effect steps / 59 steps whose
  *kind* implies a business object) — **below the ≥90% target**, and this is the *persistence-level*
  rate; **usable-deliverable** rate is far lower (see limits below).
- **16 semantic gaps remain**: `mutate_record`/`reconcile` domain steps still bound to
  `hr.record.append` (trace-only) that should persist a real domain object.

**Real business effect delivered + PROVEN ON A REAL SQL DB (the concrete new work):**
- New authoritative action **`absence.record.create`** — calls the governed P8.3 absence service
  (`createAbsence` → real `pierre_rt_employee_absences` row + employee event), FK-linked, tenant-scoped,
  `absence.write`-gated. It **fails closed** (governed blocker) on an invalid type (DB CHECK
  `conges_payes|rtt|maladie|sans_solde|autre`) or a missing employee — never a fake success.
- The absence pack's create step was rebound from a **non-executed `svc` governed_service** (a
  capability with no runtime handler, so it never ran) to this **runtime_action** — so it now
  actually executes in the compiled runtime plan.
- **Proven on real Postgres 16 (PGlite + real migrations)**, not in-memory:
  `p22-absence-business-effect.itest.ts` (3/3 green) — creates a real employee, runs the action,
  asserts a real absence row with correct FK + fields, asserts **tenant isolation** (tenant B sees
  0), and asserts a **governed blocker** for a non-existent employee.

**Honest limits (NOT claimed) — verdict stays WITHHELD:**
- Only **1 of ~10 domains** has a real, real-SQL-proven business action (absence). The other 16
  semantic-gap steps + 111 trace + 51 collection steps are **not** business completion.
- `document.generate` persists a governed draft row + content hash — **not rich usable content**
  (usable-deliverable rate unproven).
- **No 18-mission × 3-mode E2E** through the real DB, **no browser pass**, **no 11h35→12min**
  human-time measurement, **no live-provider sends**, `PRODUCTION_AUTHORIZED` still `false`.

**Reprise 3 verdict: P22 — OPERATIONAL CLOSURE STILL WITHHELD.** Correction applied (trace ≠
business effect); one real domain business action proven end-to-end on real SQL; honest
`business_effect_completion_rate = 72.9%` (< 90%). Still missing for ELITE OPERATIONAL PROOF:
real domain actions for the remaining 16 semantic gaps + other domains (recruitment/onboarding/
payroll/performance/training/offboarding/helpdesk), rich usable document content, 18-mission ×
3-mode real-DB E2E, browser proof, human-time proof.

Verification: `tsc` exit 0, scoped ESLint 0, 287 v1-unit/pack tests + the 3-test real-SQL
integration suite green. 0 OpenAI calls.

---

## REPRISE 2 (P22 — eliminate ALL noops, generic HR primitives — 2026-07-25, appended, prior evidence preserved)

**Bigger truth than "23 noops":** a full inventory across the whole pack registry found **172
`mission.noop` runtime steps across 43 packs** — most were the shared skeleton (`intake` / `collect`
/ `validate` from `intakeSkeleton()`, present in every pack).

**What changed (real, tested, committed):**
- **Two GENERIC reusable authoritative actions** (registry + handlers, both persist to
  `pierre_rt_events`, tenant-scoped + traced, never invent data):
  - `hr.record.append` — persists one structured typed HR record/observation (classification,
    tracking, detection, reconciliation) as a canonical event. Success ⇒ a real row.
  - `hr.data.collect` — collects declared-required fields, returns a governed **`NEEDS_INFORMATION`**
    blocker (with the exact missing list) when one is absent — never a fake success.
- **Skeleton rebound** (`intakeSkeleton()`): `intake→hr.record.append`, `collect→hr.data.collect`,
  `validate→hr.record.append` — this single change made **129** noops real across **all 43 packs**.
- **By-kind sweep** of the remaining 43 domain noops: `prepare_document→document.generate` (10),
  `collect→hr.data.collect` (8), `mutate_record/reconcile/validate/decide→hr.record.append` (25).
- **Non-regression guard** (`hr-mission-packs-no-noop.test.ts`): asserts **0** `mission.noop`
  remain and every bound action is registered **and** handled.

**Measured (all 43 packs, `P22_REAL_TECHNOLOGY_EXECUTION_RESULTS.json`):** 271 runtime-action steps,
**`mission.noop` remaining = 0** (was 172), **193 persisting actions executed → 193 effect rows
(artifact/record persistence 100%, 0 false-success)**, 25 governed auto-exec (communication /
follow-up), 10 legitimate wait/human/external pauses, 43 terminal. Action-layer
`operational_completion_rate = 100%` (every auto-executable step now binds to and executes a real
persisting/governed action). `SUCCESS_WITHOUT_EFFECT = FAIL` is asserted per persisting action.

**P16C unification decision (§6, option B chosen, honestly):** the authoritative runtime consumes
the **governed service as the single primitive directly** (`document.generate` → P8.3
`DocumentService`; `hr.record.append`/`hr.data.collect` → canonical `pierre_rt_events`). P16C's
adapters wrap those same governed services, and the HR runtime never invoked P16C — so **no double
execution / double artifact / double trace exists to remove**; the benchmark's
`SUCCESS_WITHOUT_EFFECT=FAIL` enforces exactly-one-effect per action. Routing the runtime through
the P16C *bus object* (vs. the shared service it wraps) was **not** done and is not required for
single-source-of-truth; it stays an optional refactor, not a correctness gap.

**Honest limits of this reprise (NOT claimed):** the benchmark executes the persisting handlers'
real logic against an **in-memory `SqlExecutor`**, not embedded Postgres with migrations; it proves
the action layer produces exactly-one-effect with 0 noops, **not** full E2E missions, **not** rich
usable document *content* (`document.generate` persists a governed draft + content hash, not a
rendered PDF), **not** the 18-mission × 3-mode E2E against a real DB, **not** a browser pass, **not**
real-provider sends. Those remain in the External-Activation Gate (§4).

**Verification:** `tsc` exit 0 (full repo), scoped ESLint 0 on all changed files (registry, handlers,
runtime-map, schema, 20 domain packs, 3 tests), **429** v1-unit/pack/canon/cognitive-runtime tests
green. **0 OpenAI calls** in this reprise.

**Reprise verdict: P22 — OPERATIONAL CLOSURE STILL WITHHELD.** The authoritative runtime now has
**zero `mission.noop`** and every HR mission step executes a real, governed, persisting action
(0→193 effect rows, 0 false-success) — a decisive advance on the operational spine. It still does
not reach a full E2E / usable-content / browser / real-DB / human-time proof, so no elite/closed
claim is made. Remaining to reach ELITE OPERATIONAL PROOF: embedded-PG E2E of ≥18 missions × 3
modes with real persisted differential effects; rich document content rendering (usable-deliverable
≥95%); browser desktop/mobile; live providers; production authorization (`PRODUCTION_AUTHORIZED`).

---

## CONTINUATION (P22 real technology execution — 2026-07-25, appended, prior evidence preserved)

**Root-cause found by mapping the authoritative path, not re-auditing:** P16C (the 10 tech
adapters) is imported **only** by `src/app/api/assistant/chat/route.ts` (the CloneChat sales
assistant) — the authoritative HR runtime (`src/lib/pierre/v1/*`: mission-service → worker →
`runtime-action-handlers.ts`) **never referenced P16C or any technology adapter.** And the closed
runtime action registry (`runtime-action-registry.ts`) had `document.read` but **no
`document.generate`** — so every document-producing mission-pack step could only bind to
`mission.noop`. That is the concrete reason the first P22 benchmark rendered **0 artifacts**.

**What was actually changed (real, tested, committed):**
- **New authoritative action `document.generate`** (registry def + handler). The handler reuses the
  governed P8.3 `DocumentService` (`createDocument` + `createVersion`) to persist a real, versioned,
  tenant-scoped **draft** document linked to the mission (+ employee), pinned by a content hash. It
  is `risk:controlled` / `automatic_after_policy` — producing a draft is autonomous-eligible;
  **sending (`communication.create_intent`) and signing (`signature.prepare`) remain separately
  gated.** An unknown type / missing permission returns a governed blocker — never a fake success.
- **Four critical document `mission.noop` steps rebound to `document.generate`:**
  recruitment `build_requisition` (fiche de poste) and `summarize` (factual screening summary),
  offboarding `handover` (passation) and `exit_interview` (compte-rendu de départ — the audit's
  highest-value offboarding fix).
- **Non-divergence guard:** the benchmark asserts every bound action is registered and that **no
  `prepare_document` step remains `mission.noop`** in the covered packs.

**Measured (authoritative runtime layer, `P22_REAL_TECHNOLOGY_EXECUTION_RESULTS.json`):**
6 packs, 40 runtime-action steps. **4/4 artifact-producing steps persisted a real artifact —
artifact-persistence rate 100% for that action**, **0 false successes**, 13 other governed-real
actions (approval/communication/signature/follow-up/wait). **BUT 23 of 40 steps (57.5%) remain
`mission.noop`** (classification, tracking, collection, detection steps in these packs) — so this
is a **genuine but partial** advance: document steps are now real; most non-document steps are not.

**Honest scope of this continuation (what it does NOT prove):** it measures the authoritative
*action layer* against an in-memory `SqlExecutor`, not full E2E missions through embedded Postgres,
not the three-mode layer end-to-end, not a browser pass, not real-provider sends. P16C is now
demonstrably *the right place* the technologies belong, but routing the whole runtime through the
P16C IntegrationBus (vs. calling the governed services directly, as `document.generate` does) was
**not** done — the handler reuses the same governed DocumentService P16C's document adapter wraps,
so the technology is genuinely consumed by the authoritative runtime, but via the service, not via
the bus. Rebinding the remaining ~23 non-document noops (classify/track/collect/detect across
recruitment/onboarding/pipeline) is the clear next tranche.

**Continuation verdict:** the authoritative runtime now genuinely produces and persists document
artifacts (was 0), with a registered, governed, tested action and a non-divergence guard — a real
step toward operational closure. It does **not** reach ≥90% step completion or a full-mission
artifact proof. **Production closure remains WITHHELD** (see §5 + External-Activation Gate §4,
still valid). No "terminé/clos/final/prêt/ultra-élite" claim is made.

Verification: `tsc` exit 0 (full repo), scoped ESLint 0 on all changed files, 318 v1 unit +
mission-pack + hr-canon tests green, plus the 2 new tests
(`runtime-document-generate.test.ts`, `p22-authoritative-technology-benchmark.test.ts`).
0 OpenAI calls spent in this continuation.

---

## 1. What was actually measured (and what was not)

P22 asked for a benchmark of **complete missions** (not merely created), across sizes/sectors,
in all three modes, with human-time reduction toward ~12 min of active work. Honest scoping of
what is provable in this environment:

| Dimension | Provable here? | How |
|---|---|---|
| Mission **completion** (execute every planned task, record terminal state) | **YES — done** | real `buildPierreHrWorkflowPlan` + real `executePierreTask` + P21 canonical statuses |
| Three-mode behavioral distinction | **YES — done** | real `deriveMissionTurn` (drives the real `decideValidation`) |
| Sensitive-case safety floor | **YES — done** | invariant asserted across all 3 modes |
| No simulated send / false success | **YES — done** | integration-availability probe returns `INTEGRATION_UNAVAILABLE` |
| Real document **content** generation | **NO** | needs the submit route + templates (+ optional GPT); not exercised in the pure executor path |
| Human active-time 11h35 → ~12 min | **NO** | requires real users with a stopwatch; cannot be honestly measured by code |
| Browser E2E (desktop/mobile, refresh, reconnect, upload, voice) | **NO** | no browser session run this pass |
| Real-provider sends (email/signature/HRIS) | **NO** | no live provider credentials configured |
| Production deploy + smoke on clonestore.pro | **NO** | repo hard-floor `PRODUCTION_AUTHORIZED = false as const` (P10); not overridden |

The benchmark is therefore an **honest deterministic-engine proof**, not a product-elite or
production proof. Everything in the "NO" rows is consolidated into the External-Activation Gate
(§4).

---

## 2. Measured results (deterministic benchmark)

**Set:** 12 missions × 3 modes = **36 mode-runs**; **53 tasks** actually executed to a terminal
state. Sectors covered: restauration, retail, BTP, services, PME, grande entreprise,
groupe multi-site. Families covered: recruitment, hiring/contract, onboarding, absence, pré-paie,
entretien, formation, offboarding, reporting, and 2 sensitive cases (harcèlement, licenciement).

| Metric | Value | Target | Verdict |
|---|---|---|---|
| Tasks executed to terminal state | 53 | — | measured |
| **Completed** (`COMPLETED`) | 29 (**54.7%**) | ≥90% operational coverage | **BELOW TARGET** |
| Routed to human validation (`NEEDS_HUMAN_VALIDATION`) | 13 | — | correct routing |
| Hard-blocked (`BLOCKED`) | 11 | — | correct routing |
| Needs information (`NEEDS_INFORMATION`) | 0 | — | (info gaps surfaced at plan level: `missing_info`) |
| **False successes** | **0** | 0 | **MET** |
| Real document artifacts rendered | **0** | — | **content not produced in this path** (see §3) |
| Send-with-no-provider probe | `INTEGRATION_UNAVAILABLE` | never a fake "done" | **MET** |

**Three-mode distinction (real `deriveMissionTurn`):** for the same scenario the modes produce
genuinely different turns — e.g. a benign operational mission yields
`brouillon → draft_deliverable`, `copilote → next_step_proposal` (or `clarifying_questions` when a
field is missing), `autonomie → execution_step`. `executesSilently` is **false in 100%** of
mode-runs (36/36): no mode ever acts silently.

**Sensitive-case floor (2 missions × 3 modes = 6 runs):** every run resolved to `escalation` with
`requiresHumanApproval = true`, and **0 tasks completed** on either sensitive mission — a
licenciement/harcèlement request is never auto-executed in any mode. This is the single most
important safety property and it held in 6/6.

---

## 3. Honest interpretation of the 54.7% and the 0 artifacts

- **54.7% completion is real and below the ≥90% elite target.** The 45% that did not complete
  did not fail silently — 13 correctly required human validation (contracts, pré-paie transmission,
  reporting sign-off) and 11 were hard-blocked. That is *correct governance behaviour*, but it is
  **not** the ≥90% "operational coverage on authorizable tasks" the spec demands. Part of the gap
  is that each benign mission contained one task the pure executor could not complete (an
  unsupported/edge task type surfaced as `BLOCKED` rather than silently dropped) — a real,
  addressable engine gap, not a rounding artifact.
- **0 rendered artifacts is the more important honesty flag.** In the pure executor path a
  "completed" document task means the task ran and registered a draft-plan, but the **actual
  document text is produced downstream** (submit route → `premium-document-system.ts` templates,
  optionally GPT), which this budget-free benchmark deliberately does not invoke. So P22 proves
  *task-execution completion and routing*, **not** that a usable contract/attestation/email body
  was written. Claiming "livrables exploitables ≥95%" would be false on this evidence, so it is
  **not claimed**.

**Net:** the deterministic engine proves elite *safety and mode* behaviour and honest failure
surfacing, but **does not** meet the elite *coverage* and *usable-deliverable* targets on this
evidence. No "ultra-élite" claim is made.

---

## 4. External-Activation Gate (the permitted "third phase" — activation, not a new build)

Per the master prompt, a further phase is authorized only for genuinely external dependencies.
These are exactly that — each is an activation/verification, not new product construction:

1. **Live provider credentials** — Resend (`RESEND_API_KEY`+`EMAIL_PROVIDER=resend`), Yousign
   (signature), an HRIS endpoint. Until set, send/sync tasks correctly report
   `INTEGRATION_UNAVAILABLE` (proven). Nothing to build; credentials to provision.
2. **Continuity activation** — set `PIERRE_CONTINUITY_CRON_ENABLED=true` + `CRON_SECRET` in the
   `clonestore-xcwi` prod env; the fail-closed cron (P21 FIX D, `/api/cron/pierre-runtime`,
   `*/15 * * * *`) then drives the durable scheduler. Currently a no-op by design.
3. **Production authorization** — the repo hard-floor `PRODUCTION_AUTHORIZED = false as const`
   (P10) must be flipped by the owner after the legal/go-live gates (P11/P13/P15) pass. This code
   change was **not** made here.
4. **Real content + human-time proof** — a browser E2E pass (desktop + mobile: mode switch,
   refresh, reconnect, file upload, voice, validation accept/refuse, provider-outage, resume) on a
   test tenant, plus a real timed 11h35→? mission with an actual operator. Only a real run can
   substantiate the human-time reduction claim; it remains **unproven**.

---

## 5. Production-closure verdict

**WITHHELD.** P22 delivers a reproducible, zero-cost, honest engine benchmark proving Pierre's
safety and three-mode invariants, and P21 landed four real, tested, committed shared-spine fixes.
But operational coverage (54.7% vs ≥90%), usable-deliverable rendering (0 artifacts in-path), and
every production/browser/human-time/provider proof are **not** met on current evidence. Production
is not closed; it is gated on §4. Consistent with the repo's own `PRODUCTION_AUTHORIZED=false`
floor and the P11/P13/P15 go-live gates, no "prêt/clos/final" claim is made.

---

## 6. Provenance

- Benchmark: `src/lib/pierre/__tests__/p22-elite-benchmark.test.ts` — drives only real engine code,
  asserts every invariant above, and writes `P22_BENCHMARK_RESULTS.json` on each run. Re-run:
  `node ./node_modules/vitest/vitest.mjs run src/lib/pierre/__tests__/p22-elite-benchmark.test.ts`.
- No OpenAI calls were made in P21 or P22 (budget spent: **0 of 30 allowed real calls, $0**) —
  every proof is deterministic. The AI-call budget remains fully available for the real-content /
  browser / human-time proofs in §4 when an owner authorizes them.
- Full type-check green (`tsc` exit 0), scoped eslint clean, and the broad Pierre suite (3889
  tests + the new P21/P22 tests) green. `next build` not run (documented RAM wall) — tsc + tests
  stand in as compile evidence (P21 Reserve R6).
