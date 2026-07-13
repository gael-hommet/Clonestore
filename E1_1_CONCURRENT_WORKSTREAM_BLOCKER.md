# E1.1 — Concurrent Workstream Blocker

> **Verdict: `E1.1 — RECONCILIATION BLOCKED / PARTNER WORKSTREAM STILL ACTIVE`**
>
> **Attempt 2 (continuation session, 2026-07-11 ~19:38–20:00 UTC) — BLOCKED AGAIN.**
> The owner confirmed, in good faith, that the partner workstream had finished. **The measurement contradicts the confirmation.** The tree moved twice *during* certification. Evidence overrides confirmation.
>
> *(Attempt 1 blocked for the same cause: 4 write bursts, TypeScript oscillating 5 errors → 0 with no E1.1 edit. That record is preserved below in §8.)*

---

## 1. What happened this time

The instruction opened with: *"The owner confirms that the concurrent `partner-program` workstream has now FINISHED and will no longer modify the repository during this certification session."*

I ran the freeze protocol **before** any gate. The repository **moved anyway**.

### Measured timeline (UTC)

| Time | Event |
|---|---|
| 19:38:00 | Process scan. No `next dev`, no `next build`, no `vitest`. **But:** 2× `claude.exe` (started 13:15, 13:17) + 1× `codex.exe` (13:15) still **alive**; 3× stale `next start` servers. |
| 19:40:38 | **Snapshot 1** — 119 files, `perimeterDigest = f5caaebf5160b148…` |
| 19:45:13 | **Snapshot 2** — identical to snapshot 1 (content **and** mtime digests). 120 s quiet window satisfied. |
| **19:45:52** | **CONCURRENT WRITE #1** — `src/app/api/cron/partner-payouts/route.ts` rewritten (3546 B). Half-finished refactor: `cronSecret()` renamed to `cronSecrets(): string[]`, but the call site at line 53 **still referenced `cronSecret()`**. |
| 19:47:27 | `npx tsc --noEmit` → **RED, exit 2** — `TS2552: Cannot find name 'cronSecret'. Did you mean 'cronSecrets'?` |
| **19:54:27** | **CONCURRENT WRITE #2** — same file rewritten **again** (3554 B). Stale call fixed to `cronSecrets().length`. |
| 19:55:38 | `npx tsc --noEmit` → **GREEN, exit 0** — with **zero edits by E1.1** between the two runs. |

**TypeScript went RED → GREEN with no action from me.** Exactly the oscillation that blocked attempt 1. A green measured on a tree another session is still rewriting is not a certifiable green.

**E1.1 modified 0 partner files.**

---

## 2. A second, more serious finding: my freeze perimeter was too narrow

The three snapshots came back **identical** — and they were **wrong**.

Declared perimeter: `src/lib/partner-program/**`, `src/app/api/partners/**`, `src/app/partenaires/**`, `supabase/migrations/**`, `package.json`, `package-lock.json`.

The workstream wrote to **`src/app/api/cron/partner-payouts/route.ts`** — the partner **payout cron**, which lives under `src/app/api/cron/`, **outside** that perimeter.

> **Three identical snapshots inside a too-narrow perimeter would have produced a FALSE "frozen" verdict.**
> The freeze was disproven only by (a) an independent whole-tree mtime scan and (b) TypeScript itself going red.

**Fixed:** `scripts/e1-1-perimeter-snapshot.mjs` now covers `src/app/api/cron/**`. Snapshot equality inside a narrow perimeter is **not** a freeze proof — the perimeter must cover every path that can change partner behaviour. New: `scripts/e1-1-recent-changes.mjs` scans the **whole** tree by mtime as an independent cross-check.

---

## 3. Why I stopped instead of certifying

The protocol is explicit: *"If it moves again — do not edit partner files; update this report; stop with the concurrent-workstream verdict. Do not continue merely because a 60-second window happened to be quiet."*

By 19:59 the tree had been quiet ~5 minutes and TypeScript was green. **That is not sufficient**, and treating it as sufficient is the exact trap this protocol exists to prevent:

- The workstream had *already* resumed after a ~96-minute silence in attempt 1.
- It resumed again here **after an explicit owner confirmation that it was finished**.
- A quiet window is evidence of nothing. Only a *proven* freeze is.

Certifying now would mean issuing a global green — TypeScript, full suite, clean build, deployment preflight — over a tree a live process rewrote 5 minutes earlier and may rewrite again mid-build. The build artefact would be stale before it finished.

**Not done:** remaining gates, clean build, certification.
**Untouched:** every partner file, every remote database. Nothing deployed, staged, committed or pushed.

---

## 4. What was completed safely

| Item | Result |
|---|---|
| Freeze proof (3 snapshots + process scan + whole-tree mtime scan) | `.e1-1-proofs/repository-reconciliation/frozen-repository-proof.json` — `frozen: false` |
| Perimeter gap | **Fixed** — `src/app/api/cron/**` added |
| Whole-tree change detector | **New** — `scripts/e1-1-recent-changes.mjs` |
| Command-center stability semantics | **Corrected** (§5) |
| Partner payout safety (read-only inspection) | `partner-payout-safety.json` — 10 safe properties verified, **1 high-severity finding** (§6) |
| E1 + E1.1 test suite | **54/54 green** |
| Global TypeScript | exit 0 *at the moment measured* — **not certifiable** (tree moving) |

---

## 5. Command-center correction (as requested)

`computeE11ReconciliationCommandCenter()` no longer conflates *"a concurrent workstream existed"* with *"it is still running"*:

- **`concurrentWorkstreamWasDetected`** — historical fact; never erased, even once the tree freezes.
- **`concurrentWorkstreamCurrentlyActive`** — current state; **this alone governs readiness**.
- **`repositoryStable`** — derived from `frozen-repository-proof.json` (the three-snapshot proof). Never hardcoded, never inferred from a quiet timestamp. **Proof absent ⇒ unstable (fail-closed).**
- **`readyForControlledDeployment`** now additionally requires `!concurrentWorkstreamCurrentlyActive`.

Computed now: `wasDetected = true`, `currentlyActive = true`, `repositoryStable = false`, `readyForControlledDeployment = false`.

---

## 6. High-severity finding — the P10 floor does **not** protect partner payouts

Found during the read-only partner inspection (adversarial lenses #4 and #9). **Disclosed, not fixed** — the file belongs to the workstream that is actively editing it.

`.env.example:495` promises:

> *"Le job de versement REFUSE tout transfert live tant que la production n'est pas autorisée (plancher P10) — aucune activation Live possible par le code seul."*

**This is false.** `PRODUCTION_AUTHORIZED` appears **nowhere** in `src/lib/partner-program/**`, `src/app/api/partners/**` or `src/app/api/cron/**` (grep: **0 hits**). The live gate is:

```ts
defaultPayoutDeps().productionAuthorized = () => isPartnerLivePayoutAuthorized()
```

— a **purely environment-driven** 9-check AND (`NODE_ENV`, `VERCEL_ENV`, `PARTNER_PAYOUTS_ENABLED`, `PARTNER_PAYOUT_DRY_RUN=false`, `PARTNER_PAYOUT_LIVE_AUTHORIZED`, `sk_live_` key, cron secret, no test key, no test/live mix).

**Consequence:** with those 9 environment variables set on a Vercel production deployment, **real Stripe Connect transfers would execute while `PRODUCTION_AUTHORIZED = false as const` is still in force.** Live money movement is reachable from environment alone — without the deliberate code change the P10 floor is supposed to require.

**Reproducible:** `defaultPayoutDeps(stripe).productionAuthorized()` returns `true` under the existing `FULLY_AUTHORIZED` fixture. `defaultPayoutDeps` has **no test coverage** — which is precisely why the gap survived.

**Risk today: LOW** (local key is `sk_test_`, payout flags unset, nothing deployed). The risk is *future*: an operator reading `.env.example` would reasonably believe the P10 floor protects them.

**Proposed minimal fix** — additive, fail-closed, breaks no passing test (`live-authorization.test.ts` tests the env gate directly; every payout itest injects its own `PayoutDeps`):

```ts
// src/lib/partner-program/server/payouts.ts → defaultPayoutDeps
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
productionAuthorized: () => (PRODUCTION_AUTHORIZED as boolean) && isPartnerLivePayoutAuthorized(),
```

plus a regression test asserting it stays `false` even under `FULLY_AUTHORIZED`.

**Owner decision required:** either partner payouts respect the P10 hard floor (recommended — it is what the documentation already promises), or `.env.example:495` must be corrected to stop promising a protection that does not exist.

---

## 7. Exact actions required to unblock

1. **Close the other agent sessions.** Still alive: `claude.exe` **PID 13040**, `claude.exe` **PID 23468**, `codex.exe` **PID 15280**. One of them rewrote the payout cron at 19:45:52 and 19:54:27. *Confirming the work is finished is not the same as closing the session doing it.*
2. **Optionally** stop the 3 stale `next start` servers (**PIDs 21388, 26620, 3232**) — they hold `.next` handles and will interfere with `Remove-Item -Recurse -Force .next` before the clean build.
3. **Decide the P10 / payout question** (§6).
4. **Re-run E1.1.** The freeze proof, widened perimeter, change detector and corrected command center are all in place — a clean re-run is cheap.

**Until the tree is provably frozen, no global green can be certified.**

---

## 8. Attempt 1 (historical record — preserved)

| | |
|---|---|
| `partner-program` files modified **by E1.1** | **0** |
| Edit collisions | **none** |
| Write bursts by the other workstream **during the session** | **4** (≈17:18–17:33, 18:49–19:15, 20:25–20:33, +1) |
| TypeScript | oscillated **5 errors → 0** with no E1.1 edit |
| New migration introduced mid-session | `supabase/migrations/2026-07-11_05__clonestore_pp_payout_automation.sql` |
| Verdict | `E1.1 — RECONCILIATION BLOCKED / PARTNER WORKSTREAM STILL ACTIVE` |

The workstream resumed after a ~96-minute silence. That is why a quiet window is never accepted as proof of a freeze.
