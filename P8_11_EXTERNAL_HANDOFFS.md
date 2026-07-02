# P8.11 — External Handoffs (orchestrated, blocked)

The mission packs that require a real external provider are **fully orchestrated** (collect → prepare → handoff → reconcile → incident/recovery → evidence) but **blocked** on the provider — no provider is contacted and no success is ever simulated. Finishing these is P8.12.

Source: `.p811-proofs/<run_id>/external-handoffs.json` + [handoff.ts](src/lib/pierre/v1/hr-operations/handoff.ts).

## External systems awaited (9 handoffs, 6 systems)

| System | Handoffs | Packs | Status |
|---|---|---|---|
| `signature_provider` | 2 | `offer.negotiation_and_signature`, `contract.submit_signature` | blocked (Yousign, P8.7.4) |
| `payroll_provider` | 2 | `absence.payroll_transmission`, `payroll.transmit_and_reconcile` | not_integrated (certified engine + declarations = P8.12) |
| `identity_provider` | 2 | `onboarding.access_provisioning`, `offboarding.orchestrate` | not_integrated |
| `time_attendance` | 1 | `absence.timeclock_integration` | not_integrated |
| `benefits_provider` | 1 | `compensation.benefits_and_expenses` | not_integrated |
| `training_provider` | 1 | `training.plan_and_enroll` | not_integrated |

## What is already built for each (no provider needed)

- **Collect + validate** the inputs the provider will need.
- **Prepare** the artifact/recap (e.g. absence recap, payroll variables, offer document, access request).
- **Handoff descriptor** — a governed record of what is expected back (never a provider call).
- **Await + reconcile** — the case waits (`awaiting_external` → `reconciling`); reconciliation is **idempotent** and an **ambiguous return is never treated as success** ([reconciliation.ts](src/lib/pierre/v1/hr-operations/reconciliation.ts)).
- **Recovery** — worker-crash lease recovery + provider-failure retry/backoff/dead-letter (from the verified runtime).
- **Completion evidence** — the case cannot close until the external return is reconciled.

## What P8.12 adds

The real provider integration per system (contract, credentials, live calls), the certified payroll computation + official social declarations, and the Yousign production unblock (external blocker P8.7.4). The orchestration above does not change — only the blocked handoff becomes a live call.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
