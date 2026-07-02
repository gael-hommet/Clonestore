# P8.13 — Adversarial QA (found, fixed, re-verified)

Certification is only worth what survives an attempt to break it. P8.13 was audited twice: a
programmatic refutation suite (`p813-run-adversarial-certification.mjs`) and an **independent
multi-agent re-audit** (6 auditors, each told to *refute* one soundness claim, then a lead judge).

This document records what the adversary found, how it was fixed **honestly** (wired, not hidden),
and the final verdict.

---

## 1. The finding that mattered — dimension A was over-certified

The first multi-agent pass returned **CERTIFICATION NOT SOUND**. The real defect:

> **28 country-dependent capabilities had no mission pack, no scenario, and only a *pointer string*
> as "evidence" for a fail-closed gate (`evaluateExecutionGate`) that is only ever invoked for
> mission packs — never for these standalone capabilities.** So they were *labelled*
> `CERTIFIED_FAIL_CLOSED` without any real invocable path proving they fail closed.

Secondary findings:
- **2 of the 4 declared FORBIDDEN effects** (`unapproved_mutation`, `human_decision_auto_taken`)
  were never actually checked in the scenario runner.
- The `invented_law` check existed but was unreachable for the standalone capabilities.

Dimensions B / production were **correctly** withheld even in the failing version — the adversary
confirmed no false country/production green.

### The honest fix (wire it, don't downgrade it)

The tempting shortcut was to relabel the 28 as `NOT_CERTIFIED` and move on, or to keep the label and
hide the gap. Both were rejected. Instead the gap was **closed for real**:

1. **New real runtime path** — [`hr-country-execution/capability-gate.ts`](src/lib/pierre/v1/hr-country-execution/capability-gate.ts):
   `evaluateCapabilityGate(capabilityId, jurisdiction, nowIso)` resolves the capability's
   `countryRuleDependencies` against `COUNTRY_REGISTRY`, freezes a rule snapshot, evaluates the
   rules, and **can only return `allowed: true` when every required rule is VERIFIED + fresh**
   (`snapshot.allVerified`). With 0 VERIFIED rules today it *always* fails closed — provably, by
   invocation.
2. **The classifier now invokes it** — [`functional-coverage.ts`](src/lib/pierre/v1/final-certification/functional-coverage.ts)
   step 4 calls `evaluateCapabilityGate(cap.id, "FR", …)` and only assigns `CERTIFIED_FAIL_CLOSED`
   if the gate actually blocks with ≥1 required rule family; otherwise `NOT_CERTIFIED`. The evidence
   string is now the real invocation result, not a pointer.
3. **Real scenarios exercise them** — [`scenario-registry.ts`](src/lib/pierre/v1/final-certification/scenario-registry.ts)
   emits a standalone-capability scenario (`missionPackIds: []`) per pack-less country/external
   capability; [`scenario-runner.ts`](src/lib/pierre/v1/final-certification/scenario-runner.ts) runs
   them through the capability gate (country → expect `BLOCKED`) or the provider layer
   (external → governed manual, no fabricated reference).
4. **All 4 forbidden effects are now checked** in the runner and any occurrence forces `ok = false`:
   `fabricated_provider_success` (provider `submit` returns a non-null reference),
   `invented_law` (a gate returns `allowed` with no VERIFIED rules),
   `unapproved_mutation` (an AUTOMATED pack carries an irreversible mutation with no approval / a
   gated capability with no required family), and
   `human_decision_auto_taken` (an AUTOMATED pack contains a human-decision step).

**Result after fix:** 215/215 certified with the fail-closed capabilities now genuinely wired;
scenario count rose from 91 → **207** (the standalone capabilities are now actually executed);
all 207 pass on the real runtime.

---

## 2. Programmatic refutation suite — 6/6 claims survive

`p813-run-adversarial-certification.mjs` (proof `.p813-proofs/p813adv-*/`) — `anyRefuted=false`:

| # | Claim attacked | Result |
|---|---|---|
| 1 | functional completeness (uncertified must be 0) | holds |
| 2 | no country auto-authorized without VERIFIED rules (launchGrade=0) | holds |
| 3 | no provider usable / fabricated (liveGrade=0) | holds |
| 4 | human-only capabilities never automated | holds |
| 5 | manual path not counted as an API integration (manual=6, live=0) | holds |
| 6 | no scenario fabricates a result / invents law (failed=0) | holds |

---

## 3. Independent multi-agent re-audit — CERTIFICATION SOUND

Workflow `p813-adversarial-recheck` (7 agents, 235 tool calls, ~357k tokens). Six independent
auditors (each an `Explore` agent told to *refute* one soundness claim), then an Opus lead judge that
re-read every load-bearing file itself and ran the test suite before ruling. **All six returned
`refuted: false` at high confidence; `refutedClaims: []`.**

| Claim attacked | Auditor verdict | Key grounding |
|---|---|---|
| Pack-less capabilities genuinely wired to a real invocable path | **not refuted** (high) | `evaluateCapabilityGate` resolves real `countryRuleDependencies`, freezes a snapshot, `allowed` needs all 4 conditions (capability-gate.ts:43); invoked in classifier + runner |
| All 4 forbidden effects checked & can fail a scenario | **not refuted** (high) | live push sites at scenario-runner.ts:25/43/44/48/61/62; `ok` requires `forbidden.length === 0` (line 72) |
| Dimension A "215/215, 0 NOT_CERTIFIED" is honest, not inflated | **not refuted** (high) | 6 exhaustive classification paths, each needs real evidence; evidence-validator enforces `evidenceRefs.length > 0` |
| Dimension B correctly withheld, nothing auto-authorizes | **not refuted** (high) | `ownerSignOff` false unconditionally; `launchGrade` needs all-VERIFIED+live+signoff (unreachable); `productionUnblock` hardcoded `NOT_AUTHORIZED` |
| No fabricated success / invented law / manual-as-integration | **not refuted** (high) | `submit` returns `reference: null` for unusable providers; `liveGrade` counts only usable integrations, manual paths excluded + tested separately |
| No regression / no P9 / deploy-block untouched | **not refuted** (high) | P8.12 files unchanged; one new file + one export; `src/app` has zero gate imports; deploy-block + Yousign OPEN intact |

**Lead judge (Opus, independent) final ruling — verbatim essence:**

> *"VERDICT: The P8.13 HR certification is SOUND. I did not take the six auditors at their word — I
> read every load-bearing file myself and ran the suite (12/12 pass). (a) No auditor refuted any
> soundness-breaking claim. (b) Dimension A completeness is genuinely backed by real code — the
> fail-closed capability gate is a real invocable path, and the fail-closed guarantee is real because
> the data cannot satisfy it (0 VERIFIED rules → `allowed=false` always). (c) Dimension B / production
> are correctly withheld, hardcoded, and independent of A. Scope is clean. Surviving real problems
> that break soundness: NONE."*

The judge added one **cosmetic-only** nit (not a soundness issue): the `hr-country-execution/index.ts`
header comment still read "PHASE 8.12" though it now exports the P8.13 gate — **fixed** (header now
notes the P8.13 addition).

The judge also confirmed the essential honesty of the certification: *"this certification asserts
functional completeness of governed paths, NOT legal correctness or launch readiness. There is
deliberately no positive legal verdict … That withholding is exactly what makes the certification
sound rather than overclaimed."*

---

## 4. Terminal build validation — clean serialized production build

The final repository gate is a **clean serialized production build**, run separately from the
functional certification and *without* disabling TLS. Procedure: confirm no `next build`/`next dev`
process is running (two concurrent builds were found sharing `.next` and terminated — the true cause
of the earlier `ENOENT .next/export/500.html`), delete `.next`, run exactly one `npm run build` with
full untruncated output, capture the real shell exit code, and verify artifacts.

Result — **exit 0**: `Compiled successfully`, TypeScript validation completed, all **185/185** static
pages generated; **0** `Build error occurred`, **0** `ENOENT`, **0** `Failed to compile`; TLS
verification **not** disabled; `concurrent_next_processes = 0`; `.next/build-manifest.json` and
`.next/server/pages/500.html` both present (the previously-failing file is now produced cleanly once
the build race is removed). Proof:
[`.p813-proofs/p813clean-8ae6dbc1a9/clean-build-proof.json`](.p813-proofs/p813clean-8ae6dbc1a9/clean-build-proof.json)
(`ok: true`); full log: [`p813-final-clean-build.log`](p813-final-clean-build.log). No source file was
modified and no production flag was changed to obtain this build.

---

## What the adversary could NOT break (and must never)

- **Dimension separation** — functional completeness never flips a country or production flag.
- **0/4 countries launch-grade**, **0 providers live**, **production `NOT_AUTHORIZED`** (hardcoded,
  never auto-derived).
- **No VERIFIED rule exists**, so no legally-sensitive automatic execution is authorised anywhere.
- **P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED.**
