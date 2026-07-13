# E1.1 — Global Repository Reconciliation / Controlled Deployment Preflight

> ## Verdict: `E1.1 — REPOSITORY LOCALLY RECONCILED / REMOTE MIGRATION AND DEPLOYMENT AUTHORIZATION REQUIRED`
>
> The repository is **genuinely frozen** (proven, not asserted), the **P10 payout floor defect is closed and tested**, every gate is green on the frozen tree, and the clean build exits 0. **Nothing was deployed. No remote database was touched. Production remains unauthorized.**

**Proofs:** [.e1-1-proofs/repository-reconciliation/](.e1-1-proofs/repository-reconciliation/) · **Concurrency history:** [E1_1_CONCURRENT_WORKSTREAM_BLOCKER.md](E1_1_CONCURRENT_WORKSTREAM_BLOCKER.md) · **Remote runbook:** [E1_1_P941_REMOTE_MIGRATION_PREFLIGHT.md](E1_1_P941_REMOTE_MIGRATION_PREFLIGHT.md)

---

## The two things that mattered

**1. The owner's confirmation was wrong — and measurement caught it.**
The session opened with *"every other Claude/Codex session has been CLOSED."* The process scan found **three still alive and consuming CPU**: `claude.exe` 13040 (+23.0 s), `claude.exe` 23468 (+6.2 s), `codex.exe` 15280 (+0.9 s). They had written nothing yet, but a live agent is not a frozen tree. With explicit owner authorization they were **terminated** — along with 3 stale `next start` servers and **2 hung bash wrappers** left by the killed partner session, which carried trailing `pkill next start` and `rm -rf` commands that could have fired mid-build. Only then did certification begin.

**2. A live Stripe payout could have fired with production unauthorized.**
`.env.example:495` promises: *"Le job de versement REFUSE tout transfert live tant que la production n'est pas autorisée (plancher P10) — aucune activation Live possible par le code seul."* **It was false.** `PRODUCTION_AUTHORIZED` appeared **nowhere** in the partner surface (grep: 0 hits). The live gate was `defaultPayoutDeps().productionAuthorized = () => isPartnerLivePayoutAuthorized()` — **purely environment-driven**. Nine environment variables on a production deployment would have moved real money while `PRODUCTION_AUTHORIZED = false as const`. It survived because **`defaultPayoutDeps` had zero test coverage**.

---

## The freeze proof

| Snapshot | Time (UTC) | Meaning |
|---|---|---|
| **A** | 20:50:11 | baseline — 135 files (widened perimeter) |
| **B** | 20:53:42 | after a **185 s** quiet window — **identical to A** |
| **C** | 21:15:36 | after `tsc --noEmit` + partner/cron tests — **identical** |
| **C2** | 21:17:53 | after terminating the foreign agents — **identical** |
| **D** | 21:38:05 | after the E1.1 P10 fix — **only 2 diffs, both mine** |
| **E** | 21:52:53 | after the clean build — **identical to D** |
| **F** | 00:33 | after final re-build — **identical to E** |

`A = B = C = C2`, `C2 → D` = exactly my two authorized edits, `D = E = F`. **TypeScript did not oscillate.** The independent whole-tree mtime detector found **zero** foreign writes.

The perimeter was widened after the previous attempt exposed a trap: it had omitted `src/app/api/cron/**` — the exact path the concurrent workstream wrote. **Three identical snapshots inside a too-narrow perimeter would have produced a false "frozen" verdict.**

---

## Answers to the 30 questions

| # | Question | Answer |
|---|---|---|
| 1 | Were all other writing agents/sessions closed? | **Not initially.** 3 were alive and burning CPU despite the owner's confirmation. Terminated with owner authorization; only this session (PID 24352) remained. |
| 2 | Was the widened perimeter stable? | **Yes** — 135 files, unchanged across the quiet window, both gates, the fix, and two builds. |
| 3 | Did snapshots A/B/C/D/E match? | **Yes** — `A=B=C=C2`, `D=E=F`; `C2→D` differs by exactly my 2 authorized edits. |
| 4 | Did any source move during tests or build? | **No.** Zero foreign writes; `D=E` proves the build did not move source. |
| 5 | What caused the previous TypeScript oscillation? | Another session's **half-finished refactor**: `cronSecret()` → `cronSecrets(): string[]` with a stale call site (TS2552), fixed by them ~9 min later. Red→green with no E1.1 edit. |
| 6 | Is the cron route now stable and type-correct? | **Yes** — `cronSecrets()` + `matches()` timing-safe compare; tsc 0; exports (`runtime`, `dynamic`, `GET`, `POST`) valid. |
| 7 | Did the P10 payout defect still exist? | **Yes** — unfixed by the partner workstream. Confirmed by grep: 0 references to `PRODUCTION_AUTHORIZED` in the entire partner surface. |
| 8 | How was it fixed? | `defaultPayoutDeps`: `productionAuthorized: () => Boolean(PRODUCTION_AUTHORIZED) && isPartnerLivePayoutAuthorized()`. Additive, **fail-closed** — it can only block, never enable. The refusal log now names *which* cause fired. |
| 9 | Can environment variables bypass P10? | **No.** Exhaustive sweep of all **2⁷ = 128** subsets of the fully-authorized live environment: **none** authorizes a payout while the const floor is false. |
| 10 | Can a live Stripe key bypass P10? | **No.** `sk_live_` sets the **mode**, never the **authorization**. |
| 11 | Can an admin request trigger a real payout? | **No.** The admin route forces `dryRunOverride: true` — preview only. |
| 12 | Is dry-run genuinely non-mutating? | **Yes.** Delegates to `previewPayouts` (SELECT-only): no transfer, no batch row, no paid status, no email, no fake ID, and **no run lock** (a simulation must never block the real payout). |
| 13 | Is payout idempotency deterministic? | **Yes.** `partner-payout:<partnerId>:<periodKey>:<batchHash>`, batchHash = SHA-256 of **sorted** entry IDs (order-independent), passed to Stripe + run lock + `uq_pp_item_entry_live`. |
| 14 | Is paid status dependent on provider evidence? | **Yes.** `settle()` runs **only after** `createTransfer()` resolves. A failure never leaves a commission paid-but-unfunded. |
| 15 | Is an unknown provider outcome handled safely? | **Yes.** → `reconciliation_required`: releases nothing, pays nothing, entries stay locked; Stripe is queried (same idempotency key) before any recreation. |
| 16 | Is the partner payout migration applied remotely? | **No.** Present locally; remote state **UNKNOWN**; not applied by this session. |
| 17 | Is P9.4.1 applied remotely? | **No.** `p941AppliedRemotely = false`; remote state **UNKNOWN**. |
| 18 | Is global TypeScript green? | **Yes — 0 errors**, measured repeatedly on the frozen tree, no oscillation. |
| 19 | Are partner/payout tests green? | **Yes** — partner unit **80/80** (67 + 13 new), partner integration **98/98** (PGlite). |
| 20 | Are Pierre tests green? | **Yes** — premium documents **158/158**, Pierre V1 **352 passed / 1 skipped**. |
| 21 | Is C1.4 intact? | **Yes** — access gate source-probed intact; CloneChat **436/436**. |
| 22 | Is canonical non-regression green? | **Yes — 7706 passed / 1 skipped / 0 failed.** |
| 23 | Is the full project suite green? | **Yes — 17200 passed / 1 skipped / 0 failed** (407 files). |
| 24 | Does the clean build exit 0? | **Yes.** `.next` removed, one serialized build: compiled, type validation, route validation, **192/192** static pages, **392** routes. |
| 25 | Are `/assistant`, partner and cron routes present? | **Yes** — `/assistant`, `/api/assistant/chat`, `/api/assistant/execute`, `/partenaires`, `/partenaires/admin`, `/partenaires/espace`, `/api/partners/apply`, `/api/cron/partner-payouts`, `/api/webhooks/stripe`. |
| 26 | Was any live provider called? | **No.** 0 provider calls during build. No live Stripe/email/signature/voice/telephony. **No new OpenAI call** — no C1.4 *runtime* file changed after the existing real-provider proof. |
| 27 | Was any remote database modified? | **No.** Preflight ran **without** `--connect`: not connected, 0 mutations, no URL/credential printed. |
| 28 | Was anything deployed? | **No.** |
| 29 | Is production authorized? | **No.** `PRODUCTION_AUTHORIZED = false as const` — comparing it to `true` is a **type error**; the compiler defends the floor. `paymentMode = disabled`. |
| 30 | What exact operator actions remain? | See below. |

---

## The one subtlety worth stating plainly

The skipped test is **not** a failure: `p16a-proof-generator` is gated behind `P16A_WRITE_PROOFS=1`. It emits proofs; it asserts no behaviour. Recorded, not hidden.

And `readyForControlledDeployment = true` **is not permission to deploy.** It means every local gate is green on a frozen tree. `PRODUCTION_AUTHORIZED` stays `false`, and deploying remains an explicit, separate owner decision.

---

## Design note on the P10 fix

`live-authorization.ts` deliberately keeps **no** P10 coupling — it stays a pure, independently testable environment evaluator. The floor is composed at the **dependency-construction site** (`defaultPayoutDeps`), AND-ed *before* the environment gate. So the environment gate can only ever **add** restrictions; it can never replace the floor. That keeps both halves honest and separately provable.

---

## Adversarial review

**25 lenses · 21 HOLD · 2 refuted-and-fixed this session · 2 refuted-in-the-previous-attempt-and-fixed · 0 open.**

Secret scan across every proof and report: **0 secrets**. (One regex hit was a false positive — a prior proof literally *describing* the pattern being scanned for.)

---

## Exact operator actions remaining

1. **Decide the payout doctrine** (recommended: keep the fix). Partner payouts now respect the P10 floor, matching what `.env.example` already promised. If you instead want payouts independent of P10, the fix must be reverted **and** `.env.example:495` corrected to stop promising a protection that would not exist.
2. **P9.4.1 remote migration** — an authorized operator runs `node scripts/e1-1-clonechat-remote-preflight.mjs --connect` (read-only) against the target. Remote state is **UNKNOWN** until then. If `UNAPPLIED`, apply the canonical migration per the runbook. *Take a backup first.*
3. **Partner payout migration** (`2026-07-11_05__clonestore_pp_payout_automation.sql`) — separate operator review, backup, and explicit authorization. Its tests passing proves **behaviour**, not deployment.
4. **Deployment** — a separate, explicit owner decision. A green build is not a deployment.
5. **Production authorization** — requires a deliberate code change to `PRODUCTION_AUTHORIZED`. No environment variable can do it.

**Untouched:** every remote database, every hard floor. **Nothing** deployed, pushed, staged or committed. **No secret printed.** The only partner product change was the P10 payout-floor fix and its regression suite.

---
---

# Attempt history (preserved)

**Attempt 2** (blocked): the concurrent workstream rewrote `src/app/api/cron/partner-payouts/route.ts` twice *during* certification (19:45:52 Z, 19:54:27 Z), after an owner confirmation that it had finished; TypeScript flipped RED→GREEN with zero E1.1 edits. Certification correctly refused. It also exposed that the freeze perimeter was too narrow — see [E1_1_CONCURRENT_WORKSTREAM_BLOCKER.md](E1_1_CONCURRENT_WORKSTREAM_BLOCKER.md).

**Attempt 1** (blocked): 4 write bursts by the other workstream; TypeScript oscillated 5 errors → 0 with no E1.1 edit; the full suite grew mid-measurement. The workstream resumed after a ~96-minute silence — which is why a quiet window is never accepted as proof of a freeze.

*Completed and carried forward:* Pierre premium-document inference fix (158/158), fair-claim PGlite harness stabilization (no assertion weakened), C1.4 access-gate preservation, C1.4 real-OpenAI proof preserved (runtime unchanged), P9.4.1 local migration audit, read-only remote preflight, environment/secret audit.
