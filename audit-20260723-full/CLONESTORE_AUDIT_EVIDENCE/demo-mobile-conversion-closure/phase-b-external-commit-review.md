# Phase B — External commit review (read-only, no modification)

## Files actually changed by the 4 external commits (old HEAD `7e37d715f` → new HEAD `0b3d79e61`)
`src/lib/geo/{capabilities,country-profiles,document-availability,formatting,geo-invariants,geo-resolver,index,pricing-region,types}.ts` + 4 geo test files, plus `src/app/api/pierre/brain/route.ts`, `src/app/api/pierre/execute/route.ts`, `src/app/api/pierre/run/route.ts`.

## What changed in `execute/route.ts` and `run/route.ts`
Confirmed by direct byte-for-byte reading of both versions (extracted via `isomorphic-git readBlob`, not native git — blocked in this environment): the change is a **lazy-initialization refactor only**. Old version called `assertEnv()` and `createClient(...)` eagerly at module top-level (lines 22-36) — the classic pattern that breaks Next.js static build analysis when env vars aren't present at build time (consistent with several OOM/build-hang episodes across this whole multi-day session). New version wraps the same checks in a cached `getRuntime()` function, called lazily per-request, throwing a new `RuntimeConfigError` caught at the top level and mapped to a `503`. **The action-dispatch logic, schemas, auth (`assertRouterAuth`), and `callMake()` bodies are otherwise byte-identical between old and new** — confirmed via direct comparison of the `email.send`/`doc.generate`/`hris.sync` handler blocks.

## Why the 9 P0.1 tests fail — NOT a stale-fixture issue as first assumed
Corrected finding, superseding my earlier (incomplete) diagnosis: the immediate 503 IS caused by the test's `beforeAll` only setting 3 of the now-6 (already 6 before these commits too — re-checked) required env vars (missing the 3 `MAKE_*_WEBHOOK_URL` values `.env.local` itself has, but the test's stub doesn't). **However, fixing that alone would not make the test suite reflect reality**, because of a second, far more serious finding:

## Critical finding — `/api/pierre/execute/route.ts` does not import or invoke any governance evaluator, in EITHER the old or the new HEAD
Direct code reading (both versions, full file) shows:
- `email.send`, `doc.generate`, `hris.sync` each call `callMake(...)` directly and unconditionally after only an HMAC-auth check (`assertRouterAuth`) and a Pierre-access check (`assertPierreAccess`, confirms `agent_configs` row exists — not a governance decision).
- **Zero occurrences** of `evaluatePierreCloneGuard`, `evaluateGovernance`, `CloneGuard`, or any import of `src/lib/pierre/legacy-execute-governance.ts` anywhere in this file, in either HEAD.
- `src/lib/pierre/legacy-execute-governance.ts` (the P0.1 module) does exist in the repo (confirmed, 3157 bytes, last modified 2026-07-23) and **is imported by `src/app/api/pierre/action/route.ts`** (P0.2's target) — but **not by `src/app/api/pierre/execute/route.ts`**, the original P0.1 target.

This means: this session's own prior memory/summary ("P0.1 Governance Closure... `/api/pierre/execute`... fermé 2026-07-23, adaptateur fin fail-closed, appels Make.com retirés du code") does not match what the code at either HEAD actually contains. The 4 external commits reviewed here did **not** cause this — they are provably behaviorally identical to the old HEAD in every governance-relevant line. This is a pre-existing condition, discovered incidentally during this concurrent-commit review, not introduced by this Demo/Mobile Conversion Closure block and not introduced by the 4 external commits.

## Attribution (per the master prompt's own framework)
- **Not** `EXTERNAL_CONCURRENT_REGRESSION_BLOCKER` — that marker implies the 4 commits changed governance behavior; they did not (proven byte-identical on this axis).
- **Is** a critical, pre-existing gap between this route's actual code and both (a) the P0.1 invariants this block was asked to verify, and (b) this session's own prior closure claims. Logged as `P0_1_EXECUTE_ROUTE_GOVERNANCE_GAP_PREEXISTING` in `DEMO_REMAINING_RISKS.md` and the main report, with an explicit recommendation that a dedicated, authorized follow-up block re-open and re-verify `/api/pierre/execute/route.ts` specifically (mirroring exactly what P0.2 already did correctly for its sibling `/api/pierre/action/route.ts`) — not attempted here, out of scope and explicitly protected.

## What was and was not done in response
- **Not modified**: `execute/route.ts`, `run/route.ts`, `legacy-execute-governance.ts`, or the P0.1 test file — all left exactly as found, per the explicit protection in this block's scope.
- **Not reverted**: none of the 4 external commits.
- **Test suite status**: left red (9 failures), honestly reported as red in `07-test-results.md` and the final verdict — not worked around, not silenced, not adapted to force a green result, since the master prompt's own gate for a test-only adaptation ("les décisions de gouvernance restent identiques... la nouvelle assertion vérifie la même sécurité") cannot be satisfied when the actual governance decision the test checks for does not exist in the code at all.
