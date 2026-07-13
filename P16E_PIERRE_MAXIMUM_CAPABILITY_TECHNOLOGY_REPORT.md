# P16E — Pierre Maximum Capability, Technology Integration & Enterprise Intelligence

**Scope:** local-only. No remote DB, no migration applied, no live provider, no deploy, no commit, no production authorization, no payments/payouts, no human-only decision. Prepared ≠ sent; proposed ≠ approved; timeout ≠ success.

**Verdict:** `P16E — PARTIAL / CAPABILITY, TECHNOLOGY OR RELIABILITY BLOCKERS REMAIN`

The reliability, human-only, tenant/authorization, capability-honesty, technology-mapping, communication-truthfulness, mission entity-binding, document-fidelity, **audit-attribution, operator-observability, truthful-status, and mission-planning core is genuinely closed and proven**. The successful verdict is deliberately **not** claimed because §8/§9/§11/§13/§14 (proactivity build, enterprise simulations, full 25-scenario adversarial campaign, T1/T2 edge sweep, and real browser QA) were not completed. Stated honestly rather than inflated.

---

## 0b — Third continuation session (2026-07-13) — observability, truthful status, planning

| # | Verdict | Fix / Result |
|---|---------|--------------|
| **F20/F29** audit attribution (`use/task/{approve,cancel,reschedule}/route.ts`, `doc/generate/route.ts`) | **CONFIRMED → FIXED** | Human actions wrote audit events with `payload:null` / no `user_id`. Every audit payload now carries `{ actor_type:"user", user_id, action }` (no salary/medical/secret/PII). Test: `p16e-f20-f29-audit-attribution` (3). |
| **§4** operator observability | **MET (verified, not duplicated)** | The canonical diagnostics surface (`/api/pierre/observability/diagnostics|events|health`) is server-authorized (internal secret, **fail-closed 403**), **aggregate** (area statuses/counts — no raw instructions/PII), and **redacted** (`redaction.ts` FORBIDDEN_SECRET/CONTENT keys). 215 tests. No duplicate dashboard built. |
| **F30** sensitive draft shown "Validé" (`client-cockpit/v1.ts`) | **CONFIRMED → FIXED** | A sensitive draft that "succeeds" is only *prepared* — now shown **"À valider"** (human decision required), never "Validé". |
| **F32** raw English status badges (`PierreStatusBadges.tsx`) | **CONFIRMED → FIXED** | The badge's local map leaked the **raw English** internal state for unmapped statuses; it now delegates to the canonical `taskStatusView` (French or "Inconnu", never raw). Test: `p16e-f30-f32-truthful-status` (13). |
| **§6** mission-planning evaluation | **DONE** | All **20 canonical HR scenarios** run through the real deterministic planner (`analyzeInstruction`, no model calls): 20/20 satisfy the invariants (no autonomous external side effect, ambiguous→clarification, sensitive→human-only prepare-only, restriction preserved). Also **strengthened** `SENSITIVE_RULES` so harassment/discrimination is classified sensitive at the planning layer (not only caught by CloneGuard at execution). Proof: `mission-planning-evaluation.json`; test: `p16e-planning-invariants` (10). |
| **§7** temporal reasoning | **VERIFIED (no silent invention)** | `detectMissionSchedule` sets a concrete `scheduled_for` only from EXPLICIT temporal references; ambiguous/absent → no invented date + a missing-info question. Contradiction/negation covered by §3.B + planning #16. |

Proofs added/updated: `operator-observability.json`, `truthful-status-audit.json`, `mission-planning-evaluation.json`.

---

## 0 — Continuation session (2026-07-13) — high-risk integrity gates closed

This session (a continuation) closed the FIRST-PRIORITY integrity gates from the prior checkpoint, each confirmed with a deterministic reproduction and a regression test:

| # | Verdict | Fix |
|---|---------|-----|
| **F11/F12** communication false-success (`resend.ts` + `email-production/runtime.ts`) | **CONFIRMED → FIXED** | Dry-run never fabricates a `provider_message_id` (`null` + `simulated:true`/`sent:false`); a sandbox redirect is labelled (`intended` vs `actual` recipients, original **never** marked contacted); a LIVE send now **requires a real acknowledgement** (non-null id) or fails closed (a silently-simulating provider can no longer report "sent"). Tests: `p16e-f11-f12-truthful-email` (4) + updated `channels-b37` (151) + `pierre-b37-smoke` (9). |
| **F24** mission entity binding (`mission-service.ts`) | **CONFIRMED → FIXED** | `createMission` verifies `employee_id`/`site_id` belong to the active company **before any insert**, fail-closed with a **non-revealing** error (a foreign id is indistinguishable from a non-existent one); site coherence + not-`left`; **no mission/task/audit** on failure. Test: `p16e-f24-mission-entity-binding` (6). |
| **F28** name fidelity (`renderers.ts`) | **CONFIRMED → FIXED** | The WinAnsi PDF corrupted non-Latin-1 names to `?` (`Łukasz→?ukasz`). Now out-of-Latin-1 chars are **transliterated legibly** (`Łukasz→Lukasz`, `Nguyễn→Nguyen`) while Latin-1 is preserved exactly; the **DOCX renderer preserves ALL names exactly** (the faithful path). Test: `p16e-f28-name-fidelity` (11). |
| **F25** document integrity (`documents.ts`) | **CONFIRMED → FIXED** | `verifyDocumentIntegrity` compared the version `content_hash` (for contracts = canonical model hash) against PDF **bytes** — two different hashes — so it could never return `ok:true` for a contract version. Now it compares the file's recorded `sha256` to the recomputed bytes (true file integrity). Test: `p16e-f25-document-integrity` (2). |
| **F31** audit attribution (`mission-service.ts`) | **CONFIRMED → FIXED** | Human ('user') state transitions recorded `actor_id: null`. Now `transitionTask`/`transitionMission` attribute the real user for human decisions. |
| **F15** required-field fallback (`clonestore/documents/renderer.ts`) | **REVIEWED → REFUTED** | A template-author `fallback` on a `required` variable is a legitimate default for informational documents; the high-stakes contract path uses `contract-readiness` (proven in R2). No contract-integrity hole. |
| **F09** communications idempotency | **REFUTED** | `idem = sha256(company:intent:recipient:channel)` is deterministic; only the delivery row PK is a uuid. |

Gates after this session: global **tsc 0**, full suite **17619 passed / 0 failures** (3 assistant files flake on collection under parallel load — untouched C1.6 perimeter, pass in isolation/together 68/68), **build exit 0**. Proofs: `.p16e-proofs/document-technology-evaluation.json`, `communication-technology-evaluation.json`, `observability-evaluation.json`, `build.json`, `full-suite.json`, `typescript.json`.

---

## 1 — Baseline recovered (§2)

- Zero conflict markers repo-wide. The partner money-path merge was resolved by the concurrent C1.7 workstream taking the **safer** side (`Boolean(PRODUCTION_AUTHORIZED) && isPartnerLivePayoutAuthorized()` — P10 hard floor ANDed in; Stripe webhook de-duplicated to 578 lines).
- **Global `tsc --noEmit`: 0 errors.** **Full `vitest run`: 17626 passed / 0 failed / 1 skipped.** **`npm run build`: success.**
- Scoped: Pierre 5296✓, CloneChat+assistant 569✓, p16c+cockpit+access 165✓.

Proofs: `.p16e-proofs/baseline.json`, `typescript.json`, `full-suite.json`, `build.json`, `scoped-tests.json`.

## 2 — Reliability closure — the three deferred P16D findings (§4)

| # | Verdict | Fix | Test |
|---|---------|-----|------|
| **R1** role revocation | **CONFIRMED → FIXED** | `removeRole`/`assignRole` never updated the legacy `pierre_rt_members.role`, so `resolveTenantContext`'s `codeFallback`/`dbPerms`-fallback re-granted revoked authority (proven: a revoked member kept `validation.decide`/`employee.write`/`tenancy.admin`). Added `syncBaseRole()` — the base column tracks the highest remaining system role (viewer floor when none). | `p16e-r1-role-revocation.itest.ts` (4) |
| **R2** empty required fields | **REFUTED-by-design → PROVEN** | `evaluateContractReadiness` blocks generation when any `policy.required_fields` value is not `present()`, and `present()` excludes `null`/`""`/**and the em-dash "—"**. Field checks are draft-stage, so a required-empty field never reaches approval/finalization. Optional-empty renders a neutral "—". No fix needed; now proven. | `p16e-r2-required-fields.test.ts` (9) |
| **R3** guard before execution | **CONFIRMED → FIXED** | The worker ran `executor.run()` (which enqueues to the outbox as its first act) *before* the black hard-block check. Now CloneGuard is evaluated **before** the executor: a black task creates no outbox row / no side effect. | `p16e-r3-guard-before-execution.itest.ts` (2) |

## 3 — Additional confirmed HIGH findings fixed (§3, §7, §8, §17)

- **§7A entity resolution** — `findPierreEmployeeByName` picked the *first partial match* on governed action routes (`/api/pierre/use/submit`, `/workflows/rh`): "Paul" acted on a guessed Paul. Now an exact-unique match resolves; any ambiguity returns `null` so the caller asks and performs no side effect. `p16e-entity-resolution.test.ts` (6).
- **§8 autonomy escalation** — `createMission` trusted client `autonomy_mode`, letting a `mission.create` user request higher autonomy than the company's governed `default_autonomy_mode`. Now the effective autonomy is **clamped** to the company ceiling (a caller may request more cautious, never higher). `p16e-autonomy-clamp.itest.ts` (5).
- **§17 F19 signature-reconcile authz** — `reconcileSignatureRequests` (which finalizes signed contracts) enforced entitlement but **no RBAC permission**, so an entitled read-only viewer could drive finalization. Added `requirePermission(ctx, "document.approve")`. `p16e-f19-reconcile-authz.itest.ts` (2).

## 4 — Findings refuted with evidence (§3)

- **F09** communications idempotency "random key" — **refuted**: `idem = sha256(company:intent:recipient:channel)` is deterministic; only the delivery row PK is a uuid.
- **queue/release-stuck + process-task "unauthenticated"** — **refuted**: both gate on `x-pierre-worker-secret` → 401.

Full candidate disposition: `.p16e-proofs/remaining-p16d-findings.json`, `open-limitations.json`.

## 5 — Capability closure matrix (§5)

Generated from the **real** `hr-canon` registry (`scripts/p16e-capability-matrix.mts` → `.p16e-proofs/capability-closure-matrix.json`), with an honest rule: **OPERATIONAL requires `VERIFIED_EXISTING` *and* evidence** (a governed path proven by a test/route); VERIFIED-without-evidence is downgraded, never rubber-stamped.

- **215 capabilities, 22 domains.**
- **77 OPERATIONAL** · 125 PLANNED · 7 PREPARE_ONLY · 5 BLOCKED_MISSING_PROVIDER · 1 BLOCKED_MISSING_DATA.
- **Integrity: 0 verified-without-evidence, 0 duplicate ids** — no dead capability is called operational, no dishonest claim.

## 6 — Technology map T1/T2 (§6, §14)

From the **real** registries (`scripts/p16e-technology-map.mts` → `.p16e-proofs/technology-map.json`): **T1 = 15** technology contracts (6 live-blocked: email, calendar, signature/Yousign, voice, push, external connectors), **T2 = 14** CloneXxx product technologies (3 integration-ready, 10 local-safe-ready, 1 architecture-only = CloneVoice). Doctrine holds: Pierre is the HR brain; T1/T2 are technologies used by it, never independent decision-makers. Live providers blocked. `t1-t2-integration-matrix.json` records the p16c-verified invariants.

## 7 — Human-only, tenancy, recovery, truthful status (proof bundles)

`human-only-evaluation.json`, `tenancy-security-results.json`, `recovery-results.json`, `truthful-status-audit.json` — each lists what is proven (with test names) and, honestly, what was not exhaustively swept.

## 8 — What was NOT completed (honest scope)

Not executed this session (not fabricated — see `open-limitations.json`): §9 mission-planning evaluation, §10 proactivity, §11 enterprise fixtures/simulations, §12 full document-technology audit (incl. F28 non-Latin-1 `?` rendering), §13 full communication audit (incl. latent F11/F12 resend live-mode sandbox), §15 cost/latency (the C1.7 `model-router.ts` exists but is **not** wired into `/api/assistant/chat` — decision D3), §16 observability, §17 full 25-scenario adversarial campaign, §18 exhaustive status-vocabulary sweep, §20 browser QA. Continuation in `P16E_CONTINUATION_PROMPT.md`.

Remaining HIGH-but-latent: **F11/F12** (resend live-mode sandbox — must be fixed before any live email enablement; latent because live is blocked). Remaining medium: F24 (client employee_id/site_id persisted without tenant-existence check — bounded because document generation re-verifies tenant), F28, F15, F17, F20/F29/F31, F22, F25, F27, F30, F32.

## 9 — Test & TypeScript evidence (latest, 2026-07-13 third continuation)

- Global `tsc --noEmit`: **0 errors**. Full suite: **17,736 passed / 0 failed / 1 skipped (438 files)** — fully green this run. Build: **SUCCESS** (BUILD_ID produced). P16E integration: **21/21**.
- P16E new tests across all sessions: R1 (4) · R2 (9) · R3 (2) · entity (6) · autonomy (5) · F19 (2) · F11/F12 (4) · F24 (6) · F28 (11) · F25 (2) · F20/F29 (3) · F30/F32 (13) · planning invariants (10) — all green; plus the 20-scenario `mission-planning-evaluation.json` (20/20) and observability (215).
- Pre-existing environmental integration failures: 7 in `p85-r4-tenant-leases/fairness` (missing `lease_fencing` DB function + worker/scheduler DB roles in PGlite) — fail in isolation, reference none of the changed code, unrelated to P16E.

## 10 — Constraints honored

No remote DB · no migration applied · no deploy · no commit/push/stage · no live provider · no real mission/email/signature · production authorization unchanged (`const` floor false) · no payments/payouts · no human-only boundary weakened · no second Pierre/HR-brain/registry/runtime/CloneChat-personality/status-brain · C1.6/C1.7 perimeter untouched · money-path untouched.

---

### Verdict

**P16E — PARTIAL / CAPABILITY, TECHNOLOGY OR RELIABILITY BLOCKERS REMAIN.**

Closed and proven across all sessions: R1/R2/R3; human-only boundaries (structural HARD_BLOCK + guard-before-execution + harassment now sensitive at the planning layer); tenant/authorization (role revocation, autonomy clamp, signature-reconcile authz, mission entity-binding); communication truthfulness (F11/F12 — no fabricated ack, sandbox labelled, live requires real acknowledgement); document fidelity + integrity (F28 name transliteration, F25 file-hash); audit attribution (F20/F29/F31 — human events attributable, no PII); operator observability (existing canonical surface: fail-closed, aggregate, redacted); truthful status (F30 sensitive draft "À valider", F32 no raw English); the 20-scenario mission-planning evaluation; capability honesty (215 mapped, 0 dishonest); T1/T2 mapping; and green **tsc + full suite + build**.

**Not yet done** (the remaining blockers to the successful verdict): §8 proactive-behaviour build + evaluation, §9 the four enterprise fixtures + accelerated simulations, §11 the full 25-scenario adversarial campaign, §13 the T1/T2 edge sweep, and §14 real Pierre browser QA. These are queued precisely in `P16E_CONTINUATION_PROMPT.md` / `.p16e-state/next-actions.md`. No latent HIGH product defect remains open in the closed perimeters.
