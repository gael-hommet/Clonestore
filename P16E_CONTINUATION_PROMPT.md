# P16E — Continuation Prompt (updated 2026-07-13, third continuation)

## Verdict: PARTIAL. Reliability + integrity + communication + document + audit-attribution + observability + truthful-status + mission-planning core is CLOSED & PROVEN.

## Completed & verified (do not redo)
- §4 R1 role-revocation, R2 required-fields (refuted+proven), R3 guard-before-exec; §7A employee disambiguation; §8 autonomy clamp; §17 F19 signature-reconcile authz.
- §3 F11/F12 communication false-success; §4 F24 mission entity binding; §5 F28 name fidelity + F25 doc integrity; §10 F31 actor_id; F15 refuted.
- §3 **F20/F29** audit attribution — task approve/cancel/reschedule + doc/generate carry `{actor_type:"user", user_id, action}`. `p16e-f20-f29-audit-attribution` (3).
- §4 **operator observability** — existing canonical diagnostics surface verified (fail-closed 403, aggregate, redacted, 215 tests). No duplicate built.
- §5 **F30** sensitive draft -> "À valider"; **F32** badges delegate to canonical presenter (no raw English). `p16e-f30-f32-truthful-status` (13).
- §6 **mission-planning evaluation** — 20/20 scenarios via the real deterministic planner (`analyzeInstruction`, no model calls); harassment/discrimination now classified sensitive at the analysis layer. `p16e-planning-invariants` (10) + `.p16e-proofs/mission-planning-evaluation.json`.
- §7 temporal — verified no silent date invention; contradiction/negation covered (§3.B + planning #16).
- §5 capability matrix (215, 77 operational); §6 T1/T2 map (15/14).
- Gates: **tsc 0**, full suite **17,736 passed / 0 failed / 1 skipped** (fully green), P16E integration **21/21**, **build SUCCESS**.

## Remaining work (the blockers to the successful verdict)
1. **§8 proactivity** — build/harden the governed proactive signal layer (each signal: trigger/evidence/company+employee scope/urgency/confidence/proposed step/required human authorization/dedup key/expiry; may NOT send/sign/decide/publish). Tests: no duplicate alert, no fake emergency, stale expiry, company switch, employee archived, permission revoked, no cross-tenant signal. -> `.p16e-proofs/proactive-behavior-evaluation.json`.
2. **§9 enterprise fixtures** (15 / 120 / 1500 / 10000 synthetic employees) + accelerated multi-week simulations (hires/absences/expiring contracts/manager changes/role revocations/document changes/provider timeouts/worker crashes/concurrent approvals). Deterministic, mocked providers, real local runtime, no model spam. Measure correctness/latency/db-ops/duplicate-prevention/queue/recovery/tenant-isolation/audit-completeness. -> `.p16e-proofs/enterprise-simulation-results.json`.
3. **§10/§11 full 25-scenario adversarial campaign** -> update `tenancy-security-results.json` / `recovery-results.json` / `human-only-evaluation.json` (image/voice/CSV injection at the backend-contract level only — NOT C1.7 media UI).
4. **§13 T1/T2 edge sweep** (15 T1 + 14 T2): company binding / permissions / input+output validation / failure / retry / idempotency / human-only boundary / provider-evidence truthfulness / fallback / kill switch / observability. Live-blocked stays live-blocked; no provider enablement.
5. **§14 Pierre browser QA** (owner/admin/HR/manager/viewer/revoked/suspended/no-Pierre) with synthetic fixtures + screenshots + network traces. NOT microphone/attachments/streaming/model-routing (C1.7).

## Protected files (do not edit without a proven shared bug)
- `src/lib/partner-program/**`, `src/app/api/webhooks/stripe/**` (money path — P10 floor intact).
- C1.7/C1.6: `model-router.ts`, `chat/route.ts`, `useCloneChat.ts`, `useVoiceDictation.ts`, `transcribe/route.ts`, `CloneChatWorkspace.tsx`, `universal-access.ts`.
