# P16D — Pierre Reliability, Adversarial Hardening & Failure Recovery

**Scope:** local-only hardening of the existing Pierre (functionally complete through P16A, integrated through P16C). No second Pierre, no second HR registry, no duplicated orchestration. Nothing remote, live, deployed, or committed was touched.

**Verdict:** `P16D — PIERRE RELIABILITY HARDENED / READY FOR FINAL CONTROLLED DEPLOYMENT`
(subject to the one out-of-scope repository blocker below, which is not a Pierre defect — see §7).

> "Ready for final controlled deployment" does not mean deployed, production-authorized, or live-provider-enabled. `PRODUCTION_AUTHORIZED` remains a `const` hard floor = `false`; live providers stay blocked.

---

## 1 — What P16D changed (11 confirmed defects fixed, each with a regression test)

Every fix is the **smallest compatible correction**. No canonical state was renamed; the existing state machine, command ledger, CloneGuard, and document guard were reused, not duplicated.

| # | Sev | Doctrine | Defect (before) | Fix | Test |
|---|-----|----------|-----------------|-----|------|
| D7 | **critical** | false success | `POST /api/pierre/email/send` persisted `status='sent'` + a **fabricated** `provider_message_id` + logged "Email envoyé" + returned `deliveryAccepted:true` — with **no provider call anywhere in the file**. Fabricated delivery evidence. | Fail-closed & truthful: `status='prepared'`, no fake ack, log "Email préparé (non envoyé)", response `sent:false`/`deliveryAccepted:false` + disclosure. | email-send-truthful |
| D8 | **critical** | missing-data invention | Client `field_values` overrode the **authoritative DB** value for any canonical path (employee name, company legal name, salary, dates) in the rendered→hashed→approved→signed contract; `required_provenance` enforced nowhere. | DB wins for canonical paths (override rejected + traced); provenance-restricted client values rejected fail-closed; authoritative dates spread last. | contract-field-injection (itest) |
| D9 | **critical** | human-only | `normalizeDecision("")` → **`approve`**: an omitted/garbled validation decision defaulted to approving a human-gated task. | Only explicit intents map; **negation blocks approve**; ambiguity → `null` → no proposal (re-ask). | decision-default-safety |
| D1 | high | human-only | CloneGuard prohibited patterns closed a truncated stem with a trailing `\b` (ASCII-only): matched "licencié" but **missed** "licencier"/"licenciement"/"licencie"; `\bsyndic\b` missed "syndicat"; `\bhandicap\b` missed unaccented "handicape". Protected characteristics have **no structural backstop**, so this leaky net was the sole layer. | Accent-folded stem matching; word-boundary kept only where a stem would over-match a benign word ("virement"). | human-only-lexical-net |
| D2 | high | stale approval | Proposals had `created_at` but no expiry; a confirmed proposal was executable **indefinitely** (old tab / replay). | 15-min TTL from immutable `created_at`, fail-closed on unknown; `expiresAt` bound into the command fingerprint; `410 PROPOSAL_EXPIRED` with **zero** side effect. | approval-expiry + execute-route |
| D3 | high | document integrity | `finalizeVersion` re-derived the hash but never re-checked file cleanliness; a **retro-quarantined** artifact could become `final` + `published` + `signature_ready`. | `assertFileAttachable` re-run at finalize. (Only the raw document lane leaked; the contract lane was already protected.) | retro-quarantine-finalize (itest) |
| D4 | high | truthful status | Cockpit rendered **"Envoyé"** (success) for a `reminder`/`deadline_reminder` that only *scheduled* (nothing sent). | New `scheduled` → "Planifié" (neutral); `v1.ts` now uses the canonical `artifactStatusView` presenter, killing the duplicate status brain. | truthful-status |
| D5 | medium | ambiguity | "Fais le nécessaire pour Paul." produced `missing_info:[]` and proposed to **execute** an invented `create_task` (only "who"/"when" were checked, never "what"; "Paul" silenced clarification). | Explicit vague-directive detector → `request_missing_info`, approval required, no side effect. Narrow, so clear instructions still pass. | ambiguous-instruction |
| D6 | high | conflicting | An explicit restriction ("…mais ne contacte personne sans mon accord") was **dropped** when the action was low-risk → CloneGuard green → autonomous execution. | Strictest-wins: restriction raises sensitivity to `restricted` (prepare-only + confirm) and traces the conflict. | conflicting-instruction |
| D10 | high | ambiguity | A hallucinated `hintId` fell back to `active[0]` (cancel) / first-pending (validate) → wrong-target on an irreversible/gated action. | Provided-but-unmatched id → `null`; no hint → auto-pick only when exactly one candidate exists. | target-resolution-safety |
| D11 | high | exactly-once / tenancy | Cockpit mission idempotency key `ui|<company>|<instruction>` omitted the **actor**; two users in one company with the same instruction collapsed into one mission. | Client sends no default key; the server derives its actor-bound key `[company,user,mission,instruction]`. Double-click still protected. | client-idempotency-actor |

Full detail: [.p16d-proofs/gap-matrix.json](.p16d-proofs/gap-matrix.json).

## 2 — Proof-of-protection suites added (existing guarantees, now tested)

A guarantee that isn't tested isn't a guarantee. These pin behavior that was already correct:

- **Exactly-once / crash-recovery / tenant isolation** (13 tests): duplicate/reordered-JSON/parallel/timeout requests → one effect; lease-fenced commit/fail (a superseded worker can't overwrite or downgrade a succeeded command); tenant bound into the fingerprint and every read/write. `p16d-exactly-once-recovery-tenant`.
- **State-machine fail-closed** (20 tests): `draft→done`, `failed→done`, `cancelled→executing`, `queued→succeeded`, expired-approval→authorized all throw. `p16d-state-machine-fail-closed` + [state-transition-matrix.json](.p16d-proofs/state-transition-matrix.json).

## 3 — Adversarial audit (how the gaps were found)

A 12-lens read-only audit fleet swept the real runtime; each candidate finding was independently refuted by 3 skeptic/reproducer/severity verifiers (majority-refuted → dropped). The 3 CRITICAL findings each reached **3/3 confirmation**. Raw output: [.p16d-proofs/gap-audit-workflow-raw.json](.p16d-proofs/gap-audit-workflow-raw.json); synthesis: [.p16d-proofs/adversarial-review.json](.p16d-proofs/adversarial-review.json). The verifier pass was partially truncated by a session limit — the ~40 single-lens candidates that never completed 3-voter verification are preserved for follow-up and are **not** claimed as confirmed.

## 4 — Refuted (did not survive verification)

- `queue/release-stuck` and `queue/process-task` "unauthenticated" — **refuted**: both gate on `x-pierre-worker-secret` → 401.
- "Termination bypasses human-only via the CloneGuard regex" — **partially refuted**: `analysis.ts` routes a termination request to `action=termination` → structural `HARD_BLOCK`, so the human-only floor held for termination; the regex gap was defense-in-depth there but the *sole* net for protected characteristics (fixed in D1).

## 5 — Reported, not fixed (documented for follow-up)

Not fixed because each is single-lens, lacks a failing reproduction, and a blind change risks a regression larger than the finding (per the "smallest compatible correction" doctrine):

- **R1** `tenant-context.ts:122` (high) — claimed role-revocation no-op via the legacy `pierre_rt_members.role`; needs a `removeRole` reproduction before touching the permission-aggregation model.
- **R2** `contract-template-compiler.ts:39` (medium) — em-dash for a declared-empty field; required-field emptiness is gated upstream (document-guard / contract-readiness), so this affects only optional fields.
- **R3** `worker.ts:76` (medium) — executor runs before the black hard-block; only `prepare_sensitive_draft` (no external effect) is reachable there.

## 6 — Human-only boundaries (preserved and strengthened)

Termination / sanction / medical / final-recruitment remain **structurally** hard-blocked by `ActionKind` (`HARD_BLOCK` in `cloneguard.ts`), independent of wording. P16D additionally closed the lexical net (D1), the unsafe approve-by-default (D9), and the restriction-dropping path (D6). No fix weakened any human-only floor; Pierre still only *prepares*.

## 7 — Out-of-scope repository blocker (not a Pierre defect)

`src/app/api/webhooks/stripe/route.ts` and `src/lib/partner-program/server/payouts.ts` carry **unresolved git merge-conflict markers** (`git stash pop`) from a concurrent partner (money-path) workstream — 12 `tsc` errors, **zero in Pierre**. Left untouched per the do-not-modify-payments instruction. This blocks a clean whole-repo `tsc`, full `vitest`, and `next build`; it is unrelated to Pierre reliability. (Notably, the stashed side is strictly *safer* — it ANDs the P10 `PRODUCTION_AUTHORIZED` const hard floor into live-payout authorization.)

## 8 — Test & TypeScript evidence

Full detail: [.p16d-proofs/test-evidence.json](.p16d-proofs/test-evidence.json).

- **TypeScript:** `npx tsc --noEmit` — 0 errors in the entire P16D perimeter; the only 12 errors are the partner conflict markers (§7).
- **P16D focused tests:** 131 unit (11 files) + 6 integration (2 files) + route-level approval-expiry, all green.
- **Scoped regression (all green):**
  - `src/lib/pierre` — **5281 passed** / 0 failed / 1 skipped
  - `src/lib/clonechat` + `src/app/api/assistant` + `src/app/assistant` — **526 passed** / 0 failed
  - `src/lib/clonestore/integration/p16c` + `client-cockpit` + `access` + `pierre/cockpit` — **493 passed** / 0 failed
  - integration itests (PGlite) — **10 passed** / 0 failed
- **Full suite / build:** not run — gated by §7 (unrelated conflicts make a whole-repo run/build unable to be clean). Reported honestly rather than shown as a misleading red.

## 9 — Constraints honored

No remote DB · no migration applied (E1.3 tooling untouched) · no deploy · no commit/push/stage · no OpenAI/Stripe/email/telephony/signature/payroll/voice call · no real mission/email/signature · production authorization unchanged · no payments/payouts enabled · no human-only boundary weakened · no second HR registry / CloneChat / orchestration created · C1.6 protected perimeter not gated.

---

### Verdict

**P16D — PIERRE RELIABILITY HARDENED / READY FOR FINAL CONTROLLED DEPLOYMENT.**

All confirmed critical/high blockers in the Pierre perimeter are closed and proven locally: no false success (D4, D7), no duplicate side effect (D11, exactly-once suite), no authorization bypass (refuted queue endpoints; D9 approve-default closed), no tenant leakage (D11 + isolation suite), human-only decisions preserved (D1, D6, D9), no stale-context/expired-approval execution (D2), document approval binds exact clean content (D3), recovery does not duplicate effects (recovery suite), truthful status verified (D4). TypeScript and the scoped regression are green. The only red is an **out-of-scope** partner money-path merge conflict (§7) that P16D was instructed not to touch — it must be resolved by that workstream before a whole-repo build.
