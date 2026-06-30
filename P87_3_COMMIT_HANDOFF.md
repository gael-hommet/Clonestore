# P8.7.3 — COMMIT HANDOFF (git execution is sandbox-blocked)

`git.exe` is **Access-denied for every binary** in this environment (`cmd/`, `bin/`, `mingw64/bin/`, `mingw64/libexec/git-core/` all refused) — the blocker is the **sandbox**, not the repo (the `.git` index is intact). So the P8.7.x code must be committed by you. No secret/artifact is included below.

## Files to ADD / COMMIT (code, tests, scripts, docs — no secrets)
**Critical app fix (deploy to fix the live 500 → 503):**
- `src/app/api/webhooks/pierre/signature/route.ts`

**P8.7.3 engine + CLI + tests:**
- `src/lib/pierre/v1/live-external-providers-check.mjs`
- `src/lib/pierre/v1/live-external-providers-check.d.mts`
- `scripts/check-p87-external-providers-live.mjs`
- `scripts/p87-capability-gate.mjs`
- `scripts/p87-storage-proof.mjs`
- `scripts/p87-provider-diagnostic.mjs`
- `scripts/run-p87-step3-validation.ps1`
- `src/lib/pierre/v1/__integration__/p87-step3.itest.ts`
- `src/app/api/webhooks/pierre/__tests__/signature-route-failclosed.test.ts`

**P8.7.1 / P8.7.2 (if not already committed):**
- `src/lib/pierre/v1/live-infrastructure-contract.mjs`, `live-infrastructure-preflight.mjs(.d.mts)`,
  `live-runtime-billing-check.mjs(.d.mts)`, `p87-credentials.mjs(.d.mts)`
- `scripts/check-p87-live-infrastructure-preflight.mjs`, `check-p87-runtime-billing-live.mjs`,
  `p87-activate-remote.mjs`, `p87-runtime-billing-proof.mjs`, `p87-backup-remote.mjs`,
  `run-p87-step2-validation.ps1`
- `src/lib/pierre/v1/__integration__/p87-step2.itest.ts`

**Config / docs:**
- `package.json` (new `report:/check:p87-external-providers-live`, `proof:p87-storage`, etc. + `npm test` now includes `src/app/api/webhooks/pierre/__tests__/`)
- `.gitignore` (P8.7 artifact patterns)
- `P87_2_HUMAN_ACTIONS.md`, `P87_3_EXTERNAL_INPUTS.md`, `P87_3_COMMIT_HANDOFF.md`

## Files to NEVER COMMIT (already gitignored — verify before pushing)
- `.env.local`, `.env.*.local`, `.env.p87-runtime.local`, `.vercel-prod-pull.env`
- `.p87-proofs/`, `.validation-logs/`, `p87-*-results.txt`, `.p87-*.log`, `tmp-clonestory-*.mjs`
- `.vercel/` (CLI link dir)

## Recommended commit + push (run locally, where git is not sandbox-blocked)
```bash
git add src/app/api/webhooks/pierre/ src/lib/pierre/v1/ scripts/ package.json .gitignore P87_2_HUMAN_ACTIONS.md P87_3_EXTERNAL_INPUTS.md P87_3_COMMIT_HANDOFF.md
git status            # confirm NO .env*/.p87-proofs/.validation-logs/.vercel are staged
git commit -m "P8.7.3: external-providers check + storage live proof + signature webhook fail-closed (503) + handoffs"
git push
```
Pushing to the branch wired to Vercel project **`clonestore-xcwi`** redeploys production and turns the live
`POST /api/webhooks/pierre/signature` from **500 → 503** (application becomes READY_LIVE).
