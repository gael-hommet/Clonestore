# P8.13 — Certification Architecture

The final certification of the Pierre HR backend, built as **two strictly-separated dimensions**:

- **Dimension A — Functional completeness**: does every HR capability have a real, governed, certified path?
- **Dimension B — Country production authorization**: does a country have VERIFIED rules + live providers + owner sign-off?

A capability can be **functionally certified while its automatic country execution stays blocked**. The two are never mixed.

Code: [final-certification/](src/lib/pierre/v1/final-certification/) · Scripts: `scripts/p813-*.mjs` · Proofs: `.p813-proofs/<run_id>/`.

## The 8 certification states (exact, no vague states)

| State | Meaning | Dimension |
|---|---|---|
| `CERTIFIED_AUTOMATED` | verified autonomous execution | A |
| `CERTIFIED_AFTER_APPROVAL` | executes after a required human validation | A |
| `CERTIFIED_HUMAN_DECISION` | legally-reserved human decision (Pierre assists/records) | A |
| `CERTIFIED_MANUAL_GOVERNED_PATH` | a governed manual handoff completes it (provider not integrated) | A |
| `CERTIFIED_FAIL_CLOSED` | correctly blocks pending a precondition (a certified behaviour) | A |
| `BLOCKED_EXTERNAL` | no governed path without a real provider | B |
| `BLOCKED_LEGAL_REVIEW` | no governed path without a VERIFIED country rule | B |
| `NOT_CERTIFIED` | no path at all — a real gap | A |

The task's own list of the modes Pierre uses — *verified automation, after-validation, human decision, governed manual path, explicit legal blocking* — maps 1:1 to the `CERTIFIED_*` states. "Fail-closed" and "manual-governed" are **legitimate certified functional modes**, not euphemisms: each carries evidence (a mission pack that compiles on the real runtime, the fail-closed country gate, or a provider manual-handoff path). The `automationBlocker` field separately records *why* automatic execution isn't available (legal_review / external_provider / human_reserved) — that is dimension B, not a functional gap.

## Modules

| Module | Role |
|---|---|
| [functional-coverage.ts](src/lib/pierre/v1/final-certification/functional-coverage.ts) | classify every capability → one of the 8 states (dimension A) |
| [scenario-registry.ts](src/lib/pierre/v1/final-certification/scenario-registry.ts) / [scenario-runner.ts](src/lib/pierre/v1/final-certification/scenario-runner.ts) | derive + run scenarios on the REAL compiler/gate/providers |
| [evidence-validator.ts](src/lib/pierre/v1/final-certification/evidence-validator.ts) / [outcome-validator.ts](src/lib/pierre/v1/final-certification/outcome-validator.ts) | no CERTIFIED_* without evidence; no forbidden effect |
| [country-readiness.ts](src/lib/pierre/v1/final-certification/country-readiness.ts) / [provider-readiness.ts](src/lib/pierre/v1/final-certification/provider-readiness.ts) | dimension B (authorization) |
| [customer-acceptance.ts](src/lib/pierre/v1/final-certification/customer-acceptance.ts) | can a customer operate without technical intervention? |
| [blocker-registry.ts](src/lib/pierre/v1/final-certification/blocker-registry.ts) / [launch-decision.ts](src/lib/pierre/v1/final-certification/launch-decision.ts) | consolidated blockers + the 5 owner answers |

## Headline result

**Dimension A: 215/215 capabilities functionally certified** (70 automated · 48 after-approval · 40 human-decision · 36 fail-closed · 21 manual-governed; 0 NOT_CERTIFIED). **207/207 scenarios pass on the real runtime** (each mission pack in its native mode + a fail-closed variant per launch country, plus a standalone-capability scenario for every pack-less country/external capability, exercised through the real capability gate / provider layer). **Dimension B: 0/4 countries launch-grade.** **Production unblock: NOT_AUTHORIZED.**

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
