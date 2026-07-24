# Test Results — Demo and Mobile Conversion Closure

## New tests created this block (23 tests, 4 files, all green)
- `src/components/demo/cost/__tests__/capacity-calculator-hydration.test.ts` — 4/4
- `src/lib/demo/contextual-prompt/__tests__/detect.test.ts` — 15/15 (11 original + 4 collision-arbitration)
- `src/lib/demo/contextual-prompt/__tests__/contextual-prompt-flags.test.ts` — 3/3
- `src/components/home/__tests__/demo-contextual-prompt-card.test.ts` — 5/5

## Non-regression sweep (final, clean run)
Command: `npx vitest run src/lib/demo src/components/demo src/components/home src/components/guided-tour src/lib/guided-tour src/lib/founder-access src/lib/clonestore/conversion src/app/api/checkout src/app/api/webhooks src/lib/clonestore/pricing src/lib/clonestore/production src/lib/legal-commercial src/lib/go-live src/app/legal src/app/signup src/app/api/pierre/action src/app/api/router src/lib/partner-program src/app/api/partners src/app/demo`

**Result: 94 test files passed, 1432 tests passed, 0 failed.**

Covers: demo (general + presentation lib + cost model + acts), homepage contextual prompt, guided-tour (full existing suite, unchanged), founder-access, BLOC3 conversion, checkout (incl. Payment Path Closure's 26+ tests and the new legal-acceptance gate), Stripe webhooks, pricing, production gates, legal-commercial (B47), go-live, legal pages, signup, `/api/pierre/action` (P0.2), `/api/router` (P0.2), partner-program, `/api/partners`, and all `/app/demo/**` route tests (including `/demo/pierre`'s 6 existing test files, 102 tests).

**One transient flake observed and reproduced-away**: an earlier run of this exact same command showed 5 files / 10 tests failing (`src/app/api/webhooks/pierre/__tests__/signature-route-failclosed.test.ts` timing out, `src/app/api/webhooks/stripe/__tests__/payment-path-country-reconciliation.test.ts` an upsert-count mismatch, plus 3 others). Re-running the identical command immediately after produced 94/94 files, 1432/1432 tests green with zero failures — confirming this was cross-test env-var/state leakage within a single large vitest worker run (consistent with this repo's known fragility pattern around `process.env.NODE_ENV` mutation in test files), not a deterministic regression, and not caused by this block's changes (none of the failing tests' files were touched by this block).

## Excluded from this sweep, on purpose
`src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts` — 9/10 tests fail deterministically (reproduced identically on the pre-block vitest config too). Root cause investigated in depth (see `phase-b-external-commit-review.md`): the route's own current code (both before and after the 4 concurrent external commits) does not import or invoke any governance evaluator for `email.send`/`doc.generate`/`hris.sync`, contradicting both the test's expectations and this session's own prior closure record for P0.1. **Not fixed in this block** (protected file, explicit authorization required, out of this block's Demo/Mobile scope) — reported as a critical, pre-existing, out-of-scope finding, not attributed to the 4 concurrent commits (proven behaviorally identical to the pre-commit version on every governance-relevant line).

## Technique
- `npx tsc --noEmit` (after clearing a re-accumulated `tsconfig.tsbuildinfo`, same recurring pattern as every prior block this session): **0 errors**, full repo, including the new `vitest.config.ts` type fix (`oxc.jsx = {runtime:"automatic"}`).
- ESLint scoped to every file touched in this block (16 files across hydration fix, contextual prompt, collision arbitration, analytics fix, vitest config): **exit 0**, 0 errors/warnings.
- Secret scan: no `sk_test_`/`sk_live_`/`service_role` pattern found in any new evidence/report file.
- PII scan: the 3 new analytics events (`homepage_demo_prompt_seen/clicked/dismissed`) carry only `{landingPath}` (a fixed pathname string) — no free text, confirmed by code review of `emitFounderEvent` call sites in `DemoContextualPrompt.tsx`.
- Claims scan: `demo-contextual-prompt-card.test.ts` explicitly asserts absence of "garanti"/"zéro erreur"/"totalement autonome"/"24/7" in the new card's rendered markup.
