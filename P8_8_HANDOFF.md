# P8.8 — Handoff

## 1. Canonical repo state
Working tree carries multiple uncommitted lanes (P8 backend, P9 guided-tour, others). P8.8 added only governance docs + a read-only decision engine (+ tests) + gate-status JSON. **No P9 file, public page, DA, migration, or flag was changed. No deploy.**

## 2. P8 features already proven (real)
Governed onboarding/employee/mission/human-validation/document-engine/private-storage; Stripe TEST 449€ → signed webhook → entitlement active; exactly-one real Resend email → signed webhook; retry→dead-letter terminal (external_calls=0); A/B isolation; automatic zero-residue cleanup; preflight 17/17; tests/tsc/build green. (P8.7.4 requirements 1–15, 19–22.)

## 3. Deploy-block
`NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE=1` — **must remain active**. The only flag that flips for the unblock, one owner-gated change at T0 (LAUNCH runbook), after P8.7.4 24/24.

## 4. The single isolated blocker
`P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP` (OPEN, external). Yousign Sandbox: 1 org member; `POST /users`=403 in sandbox; non-member 2nd signer quota-limited → req 16–18 unprovable. CloneStore code is READY (payload byte-identical to a passing test; request created; cleanup automatic). See `P8_EXTERNAL_BLOCKERS_REGISTER.md` + `P8_7_4_EXTERNAL_PROVIDER_EXCEPTION.md`.

## 5. P8.7.4 files — do NOT modify (frozen)
`scripts/p87-step4-controlled-journey.mjs`, `scripts/p87-preflight.mjs`, `src/lib/pierre/v1/controlled-live-journey-check.mjs`, `src/lib/pierre/v1/signature-providers/yousign.ts`, `src/lib/pierre/v1/signatures.ts`, `src/lib/pierre/v1/p87-run-guards.mjs`, and the P8.7.4 tests. Change these only when the Yousign blocker is CLOSED and a new controlled run is authorized.

## 6. Non-regression rules
No P9 changes; no DA/public-page changes; deploy-block stays 1; no Yousign workaround (fake webhook / single signer / SQL fabrication); no direct UPDATE of delivery/signature state; idempotency preserved; audits/triggers never disabled; no mass client-data operations; single controlled deploy only when authorized.

## 7. Recommended P8.8+ scope (Yousign-independent)
Anything not depending on Yousign two-signer activation: hardening observability dashboards; expanding rollback drills; live-provider verification gate design (Stripe live, Resend prod, Yousign live) as a *separate* gate; legal/RGPD sign-offs; performance/load; docs. Must NOT reopen P8.7.4 or bypass the blocker.

## 8. Starting tests / commands
- `node scripts/p88-readiness-decision.mjs` → BLOCKED (expected).
- `node scripts/p87-preflight.mjs` → GREEN 17/17.
- `npx vitest run src/lib/pierre/v1/__tests__/p88-readiness-decision.test.ts src/lib/pierre/v1/__tests__/p87-run-guards.test.ts src/lib/pierre/v1/__tests__/p87-signature-external-id.test.ts`.
- `npx tsc --noEmit`; `rm -rf .next && npm run build`.

## 9. Open external dependencies
Yousign Sandbox 2nd org member (or restriction lift) — owner/Yousign. (Any future live-mode provider verification is a separate gate, not opened here.)

## 10. Future close condition for the blocker
2nd distinct controlled Yousign Sandbox org member verified (dashboard) OR restriction lifted → re-run P8.7.4 → real-pipeline micro-preflight GREEN → single final journey → 24/24 → set blocker CLOSED + `P8_8_GATES_STATUS.json` accordingly → `p88-readiness-decision` becomes READY (pending owner approval) → LAUNCH runbook.
