# P22 — Pierre Elite Proof & Production Closure

**Date:** 2026-07-25
**Depends on:** P21 (`docs/reports/P21_PIERRE_VISION_PARITY_AND_AUTONOMOUS_OPERATIONS.md`, commit `a88a3492`)
**Benchmark artifacts:** `docs/reports/P22_BENCHMARK_RESULTS.json` (V0 pure path) +
`docs/reports/P22_REAL_TECHNOLOGY_EXECUTION_RESULTS.json` (authoritative runtime path, continuation)

> This report states measured facts and refuses the words "terminé / clos / final / prêt /
> ultra-élite" wherever proof is absent. Where a target is missed, the miss is stated plainly.

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
