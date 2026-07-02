# P8.8 — Production Flags Matrix

Source of truth for every flag that can enable/disable Pierre. Names verified in `src/`. **Invariant for all of P8.8: `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE=1` — never disable in this phase.**

Values: `before` = required now / during P8.8; `after` = intended after an owner-approved unblock (post P8.7.4 24/24). "after" values are **planning only** — not to be applied in P8.8.

| Flag | Current / before | After unblock | Effect | Dependencies | Rollback | Risk if wrong |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE` | `1` | `0` (owner-gated) | master public block of Pierre | none | set back to `1` + redeploy | premature public exposure |
| `CLONESTORE_SIGNATURE_PROVIDER` | `yousign` | `yousign` | signature provider | API_URL/KEY/WEBHOOK_SECRET | revert env | wrong provider |
| `CLONESTORE_SIGNATURE_API_URL` | sandbox | Sandbox until Yousign live-verified | sandbox vs live | key parity | revert env | live signature prematurely |
| `CLONESTORE_SIGNATURE_AES_ENABLED` | unset (false) | policy-driven | AES capability | signer phones | unset | AES infeasible flow |
| `CLONESTORE_SIGNATURE_QES_ENABLED` | unset (false) | policy-driven | QES capability | — | unset | QES infeasible flow |
| `CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED` | unset/false | controlled | enables live signature smoke | live account | unset | unintended live calls |
| `CLONESTORE_COMMUNICATION_PROVIDER` | `resend` | `resend` | email provider | RESEND_API_KEY, FROM | revert env | no email / wrong sender |
| `CLONESTORE_COMMUNICATION_LIVE_SMOKE_ENABLED` | unset/false | controlled | live email smoke | verified domain | unset | unintended emails |
| `CLONESTORE_AI_ENABLED` / `PIERRE_AI_ENABLED` | per current config | per launch plan | AI features | model keys | unset | cost/behavior |
| `PIERRE_BLOCK` | active (blocking) | relax per plan | coarse Pierre block | deploy-block | re-set | exposure |
| `PIERRE_EMAIL_BLOCK` | active | relax per plan | blocks Pierre email path | comms flags | re-set | unintended email |
| `PIERRE_TASK_BLOCK` | active | relax per plan | blocks task execution | runtime | re-set | unintended execution |
| `PIERRE_PAYROLL_BLOCK` | active | keep until legal sign-off | blocks payroll actions | legal | re-set | financial risk |
| `PIERRE_ACTIVATION_VIEW_BLOCK` / `PIERRE_GATE_VIEW_BLOCK` / `PIERRE_SELLABLE_AUDIT_VIEW_BLOCK` | active | relax per plan | UI/view gating | — | re-set | premature UI |
| `PIERRE_RGPD_PURGE_BLOCK` / `PIERRE_RGPD_PURGE_EXECUTE_ENABLED` | purge blocked / execute off | governed enable | RGPD purge safety | RGPD runbook | re-set | data loss |
| `PIERRE_DEAD_LETTER_ENABLED` | enabled | enabled | dead-letter handling | comms worker | keep | lost retries |
| `PIERRE_OBSERVABILITY_ENABLED` | enabled | enabled | observability signals | — | keep | blind ops |
| `PIERRE_CLONE_GUARD_ENABLED` / `PIERRE_LEGAL_GUARDRAILS_ENABLED` / `PIERRE_OUTPUT_VALIDATION_ENABLED` | enabled | enabled | safety guards | — | keep | unsafe output |
| `PIERRE_WORKFLOW_PACK_SENSITIVE_BLOCK` | active | policy | blocks sensitive packs | legal | re-set | risky workflow |
| `CLONESTORE_LAUNCH_READINESS_ENABLED` | per config | enabled | launch-readiness surface | — | unset | reporting only |

## Rules
- P8.8 changes **no** flag. The only flag that ever flips for the unblock is `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE`, one change at T0, owner-approved, after 24/24.
- Any granular `PIERRE_*_BLOCK` relaxation is a separate, deliberate, reversible step in the launch runbook — never bundled with the deploy-block flip.
- Live-mode provider switches (`*_LIVE_SMOKE_ENABLED`, live signature URL) are out of scope until a separate live-verification gate passes.
