# P8.14 — Autonomy & Proactivity

## Autonomy (owner §12)

[`autonomy-policy.ts`](src/lib/pierre/v1/cognitive-runtime/autonomy-policy.ts) classifies each step by
**reusing** the fail-closed `decideValidation` + `cloneguard.evaluateGuard` — the LLM cannot override them:

- **AUTONOMOUS** — low-risk, reversible, in-permission, no legal/material effect (e.g. a reminder).
- **CONFIRMATION_REQUIRED** — significant external comms, contract/comp changes, provider submission.
- **HUMAN_DECISION_REQUIRED** — termination, sanction, medical, harassment/discrimination, guard-black:
  Pierre prepares, never decides. Restricted sensitivity ⇒ human-only, in every autonomy mode.

Proof: `human-only-boundaries.json` (`human_only_bypasses: 0`); `cognitive-modules.test.ts` autonomy suite.

## Long-running continuation (owner §14)

[`continuation-controller.ts`](src/lib/pierre/v1/cognitive-runtime/continuation-controller.ts) maps the
**real durable** `pierre_rt_mission_runs` status → cognitive terminal states (`AWAITING_APPROVAL/DATE/
PROVIDER/INFORMATION`, `BLOCKED_*`, `FAILED_*`, `COMPLETED`, `CANCELLED`). Durability, fencing, leases,
waits and the scheduler are the **existing** run engine (not re-implemented) — so Pierre resumes after page
close / logout / server restart / worker restart / provider timeout, fail-closed on unknown (never falsely
"completed").

## Proactive initiative (owner §17)

[`proactive-controller.ts`](src/lib/pierre/v1/cognitive-runtime/proactive-controller.ts): detected signals
→ `deduplicate` (reused) → **priority gate** (severity-weighted, decide ignore/observe/task/mission/alert)
→ `signalToMissionRequest` (reused; no governed pack ⇒ no mission, fail-closed). No alert spam (dedup vs
existing live keys), no duplicate work, highest-priority first. Proven in the proactive + scenario-G tests.

**Honest scope:** the priority gate + dedup + governed mission-creation are wired and tested over injected
candidates. The **database-backed detectors** that emit those candidates from live company state (contract
expiry, onboarding gaps, SLA breach) are the remaining wiring — the signal types + routing exist; the
scheduled DB queries that feed them are the increment to reach fully-autonomous observe-open-close.
