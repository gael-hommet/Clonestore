# P8.8 — Production Launch Runbook

The exact, owner-gated sequence to unblock Pierre in Production **after** P8.7.4 = 24/24. **Nothing here is executed in P8.8.** Preconditions are hard gates; if any fails, STOP.

## Absolute preconditions (all must hold)
- P8.7.4 final-report `ok:true` + checker 24/24 (re-read from disk).
- `P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP` = CLOSED.
- `scripts/p88-readiness-decision.mjs` → `READY_FOR_OWNER_UNBLOCK_DECISION`.
- Zero synthetic residue; rollback + emergency runbooks ready; observability verified.
- Owner approval granted.

## T-24 h — verification (read-only)
Providers (Stripe TEST→live decision separate; Resend real; Yousign) · secrets present · domains/TLS · DB roles/migrations · no permanent worker · webhook routes fail-closed · zero residue · external blockers register (only Yousign, and it must be CLOSED) · `node scripts/p87-preflight.mjs` GREEN.

## T-1 h — final checks
Final read-only preflight GREEN · read-only smoke (root 200, webhook bad-sig 4xx) · observability live · rollback prepared (previous good deployment identified) · operators on call · `p88-readiness-decision` output captured.

## T-10 min — go/no-go
Explicit **owner approval** · second Yousign org member confirmed · P8.7.4 24/24 confirmed · zero open blocker · deployment READY. Set `P8_8_GATES_STATUS.json.ownerApproval.granted=true` (records the human decision) and re-run the decision engine → must be `READY_FOR_OWNER_UNBLOCK_DECISION`.

## T0 — the single controlled change
- One change only: `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE = 0` in Vercel Production + **one** redeploy of `clonestore-xcwi`.
- No other flag or code change simultaneously.
- Immediately verify `clonestore.pro` serves the new deployment (200) and Pierre surfaces are reachable as intended.

## T+5 min — smoke
Read-only: root/health 200 · webhook routes still fail-closed on bad sig · queue draining · error rate baseline · provider latency normal · entitlements consistent. Any red → **ROLLBACK runbook** (re-assert deploy-block first).

## T+30 min — review
Full observability review; decide **continue** or **rollback**. Record outcome. Update the blockers register and gates status.

## Post-launch
Granular `PIERRE_*_BLOCK` relaxations (if planned) are separate, deliberate, reversible steps — never bundled with T0. Live-provider switches require their own live-verification gate.

## Forbidden at all times
Bundling multiple changes at T0; skipping the owner approval; unblocking before 24/24; faking any provider proof; touching P9 / public pages / DA.
