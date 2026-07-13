# P16E — next action

## Status: PARTIAL. Reliability + integrity + communication + document + audit-attribution + observability + truthful-status + planning core CLOSED & PROVEN.

## Done (across all sessions)
- §4 R1/R2/R3, §7A, §8, §17 F19.
- §3 F11/F12 (comm false-success), §4 F24 (mission entity binding), §5 F25/F28 (doc integrity/fidelity), §10 F31 (actor_id), F15 refuted.
- §3 F20/F29 (task+doc audit attribution) — FIXED + proven (3 tests).
- §4 operator observability — MET by existing canonical diagnostics surface (fail-closed, aggregate, redacted; 215 tests). No duplicate built.
- §5 F30/F32 (sensitive draft 'À valider'; badges no raw English) — FIXED + proven (13 tests).
- §6 mission-planning evaluation — 20/20 scenarios via real planner; harassment/discrimination now classified sensitive at analysis layer (10 tests + mission-planning-evaluation.json).
- §7 temporal — verified no silent date invention; contradiction covered.
- §5 capability matrix (215, 77 operational); §6 T1/T2 map (15/14).
- Gates: tsc 0, full suite 17736/0/1skip (fully green), build running.

## Remaining (for next continuation)
1. §8 proactivity — build/harden the governed proactive signal layer + proactive-behavior-evaluation.json (trigger/evidence/urgency/confidence/dedup/expiry; may not send/sign/decide).
2. §9 enterprise fixtures (15/120/1500/10000 synthetic) + accelerated multi-week simulations -> enterprise-simulation-results.json (deterministic, mocked providers, no model spam).
3. §10/§11 full 25-scenario adversarial campaign -> tenancy-security-results / recovery-results / human-only-evaluation.
4. §13 T1/T2 edge sweep (15 T1 + 14 T2) — tenant/permission/idempotency/failure/kill-switch, no provider enablement.
5. §14 Pierre browser QA (owner/admin/HR/manager/viewer/revoked/suspended) with synthetic fixtures + screenshots + network traces.

## Protected (do not edit without a proven shared bug)
- src/lib/partner-program/** ; src/app/api/webhooks/stripe/** (money path)
- C1.7/C1.6: model-router.ts, chat/route.ts, useCloneChat.ts, useVoiceDictation.ts, transcribe/route.ts, CloneChatWorkspace.tsx, universal-access.ts
