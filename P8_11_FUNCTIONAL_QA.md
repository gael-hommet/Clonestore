# P8.11 — Functional QA & Verification

How the Total HR Mission Packs + case operations + proactive layer are verified, and the terminal results.

## Machine checks (fail-closed gates)

`npx tsx scripts/p811-verify-total-hr-runtime.mjs` → `.p811-proofs/<run_id>/` (12 JSON: targeted-gaps, mission-pack-summary, capability-runtime-map, domain-coverage, functional-scenarios, proactive-signals, governance-summary, recovery-summary, external-handoffs, remaining-p812-gaps, non-regression, final-report). Verdict RED unless all 8 gates pass:

| Gate | Result |
|---|---|
| `packs_valid` (schema, no dupes, no dangling capabilities) | ✅ |
| `all_packs_compile_on_real_runtime` (real `compileMissionPlan`, 0 blockers) | ✅ |
| `full_p811_coverage` (0 uncovered) | ✅ |
| `coverage_matches_canon_dynamically` (targeted == canon `P811_GAPS.length`, not hardcoded) | ✅ |
| `human_only_not_automated` | ✅ |
| `functional_scenarios_ok` | ✅ |
| `proactive_ok` (registry non-empty, every signal → real pack) | ✅ |
| `canon_not_regressed` (215 capabilities still valid) | ✅ |

**VERDICT: GREEN.** 43 packs · 102/102 gaps · all compile on the real runtime.

## Unit tests (24 across 3 suites)

- **hr-mission-packs/__tests__/mission-packs.test.ts** — registry valid; 100% dynamic P8.11 coverage; every pack compiles clean on the real runtime; never invents an action (all `runtime_action` ∈ closed registry); HUMAN_ONLY not directly automated; external-blocked packs declare integration + external step (no simulated success); human-decision packs route to a human; a broken pack (`database.query`) is rejected.
- **hr-operations/__tests__/case-operations.test.ts** — state machine allows legal transitions and refuses illegal jumps (fail-closed); terminal states accept no events; case opens + advances governed by the pack; cannot complete until completion criteria met; checklist + approvals resolve for a human-decision pack; reconciliation idempotent + ambiguous-return never treated as success.
- **hr-proactive/__tests__/proactive.test.ts** — derived signal registry, each signal → a real pack; detector fires only for registered signals; dedup by (key, subject) in-batch + against existing; signal → governed mission request; batch creation fail-closed on unknown signals.

## Functional scenarios

`npx tsx scripts/p811-functional-scenarios.mjs` — for a representative pack per domain (21 domains), drives a synthetic case through the pure operations layer (open → resolve → next step → checklist), asserts the pack compiles, and that an empty case cannot complete. **21/21 GREEN.** No DB, no provider, no PII.

## Terminal validation

- `node --check` on all 3 P8.11 scripts — OK.
- `npx vitest run` P8.11 suites (24) + P8.10 canon (22) + P8.9 primitives + p87/p88 — pass.
- `npx tsc --noEmit` — clean.
- `npm run build` — clean.

## Honest limitations (disclosed)

1. **Pure orchestration layer.** P8.11 builds the compilation + governance + case/proactive LOGIC over the verified runtime. It proves plans compile on the real compiler and cases advance through the real FSM; it does not itself execute DB mutations (that is the already-verified runtime's job, invoked by the governed services the packs bind to).
2. **Default step scaffolds.** Where a pack step's fine-grained input isn't material to governance, the compiler injects neutral placeholder inputs (nil-uuid, neutral strings) purely to prove the plan compiles; the runtime binds real values at execution.
3. **External + human + country work is orchestrated, not finished.** 9 packs are EXTERNAL_BLOCKED, 13 HUMAN_DECISION_REQUIRED, 4 COUNTRY_RULES_REQUIRED — deliberately, per scope. P8.12 finishes them.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
