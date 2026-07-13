# E1 — Local Completion Plan

**Scope:** tasks Claude can complete **safely inside the repository** with no external accounts and no live effects. Everything here is either **already done** (verified through P16C) or **completed in E1**. Nothing here enables production, payment, or a live provider.

## A. Already complete before E1 (verified through P16C — frozen, not reopened)

| Area | Local artifact | State |
|---|---|---|
| HR runtime | Pierre V1 + Ultimate (P16A), 215 capabilities from one registry | VERIFIED |
| Technologies | T1 (15 contracts) + T2 (14 product techs) fail‑closed | VERIFIED |
| Integration | P16C 10 adapters, governance strictest‑floor, `externallyExecutable:false` | VERIFIED |
| CloneChat | `/assistant` reveals the real workspace; anon API → 401; kill switch `CLONECHAT_ENABLED=false` | VERIFIED |
| Pricing canon | FR/BE/LU 449 EUR, CH 499 CHF; no cross‑currency; CH can't buy EUR | VERIFIED |
| Checkout + reconciliation | server‑authoritative, country/currency metadata, reconciliation wired into all 4 activation paths (P15) | VERIFIED |
| Payment mode | `resolvePaymentMode` never `live` while P10 floor false (P15.1) | VERIFIED |
| Legal page shells | 5 pages with required sections + forbidden‑claim guard (DRAFT) | PRESENT |
| Observability | structured errors, request IDs, redaction, dead‑letter, health lib, runbook | PRESENT |
| Migrations | 57 ordered/deterministic SQL migrations + embedded‑PG test gate | VERIFIED |
| RLS | policy registry + coverage verification; cross‑tenant tests green | VERIFIED |
| AI cost shield | enforce‑by‑default, per‑scope caps, emergency shutdown | VERIFIED |

## B. Completed in E1 (this phase — additive, local‑safe only)

| # | Task | File(s) | Result |
|---|---|---|---|
| 1 | Canonical external dependency ledger (29 deps, per‑concept fail‑closed) | `e1-external-dependency-ledger.ts` | done |
| 2 | Typed environment/secret contract (28 vars, categories, server/public split, secret boundary) | `e1-environment-contract.ts` | done |
| 3 | Supabase LOCAL readiness audit (migration ordering + RLS registry evidence) | `e1-supabase-readiness.ts` | done |
| 4 | E1 go‑live command center (every §14 flag COMPUTED, fail‑closed) | `e1-command-center.ts` | done |
| 5 | Focused E1 test suite (families A–I, 42) + gated proof generator (1) | `__tests__/**` | 43/43 green |
| 6 | Honest local/external proofs | `.e1-proofs/external-enablement/**` (34 files) | done |
| 7 | Dependency ledger + 3 worklists + 8 domain reports + final report | `E1_*.md` | done |

## C. Local‑safe tasks intentionally NOT done in E1 (and why)

- **A production `/api/health` HTTP route** — deliberately NOT added. The health/readiness **logic** exists (`src/lib/observability/health.ts`) and the E1 deployment runbook ships the exact route body to paste, but E1 does not touch the frozen app surface (P16C froze routes). Wiring the endpoint is a one‑file additive step for the operator at deploy time. Recorded as `productionHealthVerified=false` until deployed.
- **Resolving legal placeholders** — cannot be done locally without the owner's real legal identity; would be fabrication. Left as `LEGAL_ACTION_REQUIRED`.
- **Any secret value, DNS record, provider account, deployment** — out of scope by doctrine.

## D. Verification of local completion

- `tsc --noEmit` → 0 errors.
- E1 targeted suite → 43/43.
- Perimeter (production/p16c/p16a/t1/t2/c1‑1/assistant) → 478 passed / 1 skipped.
- Full scoped non‑regression → 7594 passed / 1 skipped / 0 failed.
- `npm run build` → exit 0, CloneChat surface compiled.
- Command center → `readyForExternalConfiguration=true`, `readyForProductionActivation=false`, `productionAuthorized=false`, `paymentMode≠live`.
