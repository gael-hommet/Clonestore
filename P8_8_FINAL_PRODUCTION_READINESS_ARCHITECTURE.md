# P8.8 — Final Production Readiness Architecture

## Objective
Complete **all** Production-unblock preparation that is **independent of the Yousign external blocker**, so that when P8.7.4 finally reaches 24/24 the owner can decide the unblock immediately, with no new major technical phase.

## Hard separation
- **Production PREPARATION** (this phase, P8.8): matrices, runbooks, read-only preflight/decision tooling, observability/rollback/emergency verification, tests. Deploy-safe. No flag change, no deploy, no journey.
- **Production UNBLOCK** (future, owner-gated): the explicit act of flipping `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE` and redeploying. **Out of scope for P8.8** and forbidden until P8.7.4 = 24/24 + owner approval.

## In scope (deliverables)
Gates matrix (`P8_8_PRODUCTION_GATES_MATRIX.md`); flags matrix (`P8_8_PRODUCTION_FLAGS_MATRIX.md`); observability runbook; emergency-stop runbook; rollback runbook; launch runbook; READY/BLOCKED decision engine (`src/lib/pierre/v1/p88-readiness-decision.mjs` + CLI `scripts/p88-readiness-decision.mjs` + tests); external blockers register; Yousign exception; this architecture; handoff.

## Out of scope (exclusions)
Reopening P8.7.4; any P8.7.4 journey; any Yousign workaround (fake webhook, single signer, SQL fabrication); disabling the deploy-block; modifying P9 files, public pages, or the DA; live-mode provider switches; mass client-data operations.

## Dependencies
- **P8.7.4 = 24/24** — external, OPEN (`P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP`).
- Existing infra reused (not re-created): `scripts/p87-preflight.mjs`, `src/lib/pierre/v1/controlled-live-journey-check.mjs`, `src/lib/observability/*`, `src/lib/go-live/*`, `docs/B43_PIERRE_PRODUCTION_RUNBOOK.md`, `docs/B48_GO_LIVE_RUNBOOK.md`, `docs/PHASE_8_4_DELIVERY_INCIDENT_RUNBOOK.md`.

## Gates (see matrix for detail)
Engineering (tests/build/preflight) · Providers (Stripe TEST / Resend / Yousign Sandbox) · **P8.7.4 24/24** · External blockers · Deploy-block active · Zero residue · Rollback ready · Observability ready · Owner approval.

## Exit criteria for P8.8
1. All P8.8 deliverables present and internally consistent.
2. Decision engine implemented + tested; current output **BLOCKED** (invariant: BLOCKED until P8.7.4 24/24).
3. `node --check`, `tsc --noEmit`, targeted tests, clean `build` all exit 0.
4. Deploy-block still `1`; zero residue; no P9/DA/public change; no deploy.
5. Proven that the **only** remaining blocker is Yousign.

## Risks
- Owner interprets "P8.8 verified" as "Production unblocked" — mitigated by the explicit separation + the decision engine staying BLOCKED.
- Yousign blocker never resolves — mitigated: P8.8 is independent; P8.8+ work can continue; the register tracks it.
- Drift between docs and reality — mitigated: matrices cite concrete files/commands as source of truth.

## Responsibilities
- **Engineering:** keep gates green, run the decision engine, maintain runbooks.
- **Yousign account owner / support:** resolve the external blocker.
- **Owner:** the final unblock approval + the T0 decision (launch runbook).
