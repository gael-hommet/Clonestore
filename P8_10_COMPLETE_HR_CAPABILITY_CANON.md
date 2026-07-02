# P8.10 — Complete HR Capability Canon

**The single, machine-readable source of truth for everything Pierre must know, decide, prepare, execute, monitor and prove in HR.** Built on top of the P8.9-verified engine (runtime, tenancy, permissions, missions, queue, concurrency, documents, communications, isolation, 100k-company sellability). P8.10 does **not** rebuild the runtime — it defines the exhaustive functional canon so P8.11 (runtime workflows) and P8.12 (country legal rules) can finish every missing HR capability with no improvisation, duplication, blind spot, or untestable promise.

Code: [src/lib/pierre/v1/hr-canon/](src/lib/pierre/v1/hr-canon/) · Verify: [scripts/p810-verify-hr-canon.mjs](scripts/p810-verify-hr-canon.mjs) · Evidence: `.p810-proofs/<run_id>/` · Generated matrices: [P8_10_CAPABILITY_COVERAGE_MATRIX.md](P8_10_CAPABILITY_COVERAGE_MATRIX.md), [P8_10_GAP_REGISTER.md](P8_10_GAP_REGISTER.md).

---

## 1. What this canon guarantees

After P8.10, no statement of the form *"Pierre can do X"* can exist without a full `HrCapabilityDefinition` carrying: a canonical id, a functional contract (inputs, workflow, tasks, artifacts, communications, mutations), an autonomy level, an approval/validation policy, country dependencies, integration dependencies, implementation references, an **honest status**, and **certification criteria**. This is enforced by [capability-validator.ts](src/lib/pierre/v1/hr-canon/capability-validator.ts) and the verify script — a broken or dishonest capability fails the gate.

**Machine-verified totals (run `p810-9ae2dabd8a`):**
- **215 atomic capabilities** across **22/22 canonical domains** (A–V).
- Registry valid, no duplicate ids, every id namespaced by its domain.
- **77 VERIFIED_EXISTING** — each with real evidence (test / route+mutation / DB state-machine / migration table / prior P8 proof).
- **138 gaps** routed exactly: **P8.11 = 102**, **P8.12 = 32**, **HUMAN_ONLY = 4**.
- **15 public product promises** traced → 11 fully backed, 2 partial, 2 aspirational, **0 dangling**.
- **4 country packs** (FR/BE/LU/CH), **0 invented legal rules** (all SOURCE_REQUIRED).
- **All 8 integrity gates GREEN.**

## 2. The 22 domains (full HR lifecycle)

A Organisation & planning · B Recruitment · C Offer & pre-hire · D Contracts & changes · E Onboarding · F Employee 360 & administration · G Absences, leave & time · H Payroll operational · I Compensation & benefits · J Performance · K Training & skills · L Career & mobility · M Employee relations · N Disciplinary · O Health, safety & wellbeing · P HR communications · Q Policies & internal compliance · R Offboarding · S Data, privacy & GDPR · T Reporting & steering · U Proactive operations · V Pierre administration. Defined in [domains.ts](src/lib/pierre/v1/hr-canon/domains.ts).

## 3. Honest implementation status (the audit)

Grounded in a **read-only audit** of the real codebase (`src/lib/pierre/v1`, `src/app/api/pierre`, migrations, tests) across 8 domain clusters. File existence is never treated as proof — `VERIFIED_EXISTING` is used only where a concrete test / route+mutation / state-machine / migration table / prior P8 proof was cited.

| Status | Count | Meaning |
|---|---|---|
| VERIFIED_EXISTING | 77 | proven real (evidence attached) |
| PARTIAL | 36 | some of the flow exists |
| MISSING | 81 | absent → build in P8.11 |
| IMPLEMENTED_UNVERIFIED | 5 | code exists, not yet proven |
| CONTRACT_ONLY | 6 | only a type/interface exists |
| EXTERNAL_DEPENDENCY | 5 | blocked on a real provider (payroll/signature) |
| LEGAL_CONTENT_REQUIRED | 1 | needs verified country legal rules |
| HUMAN_ONLY | 4 | must never be automated |

**What is genuinely strong today** (VERIFIED_EXISTING, from the P8.x program): tenancy/RBAC/sites/members/ownership (A, V), contracts + amendments + templates + signatures plumbing (D), Employee 360 + sensitive data + imports + completeness (F), onboarding server-authoritative flow (E), governed communications delivery at scale (P — proven in P8.9), GDPR export/rectify/anonymize/purge/legal-hold/access-log (S), durable queue + fair-claim + recovery + audit + CloneGuard + autonomy (V), proactive scheduler core (U).

**What is genuinely missing / partial** (routed to P8.11): absence approval/balance/planning (G), payroll preparation pipeline (H, with compute/declaration EXTERNAL), compensation & benefits (I), performance (J), training (K), career & mobility (L), employee relations (M), most disciplinary steps (N), health & safety (O), policy lifecycle (Q), offboarding orchestration (R), richer reporting (T).

## 4. The capability contract

Each capability ([types.ts](src/lib/pierre/v1/hr-canon/types.ts)) declares:
- **Identity**: id, version, domain, operation, label, description.
- **Scope**: lifecycle stages, trigger modes, actors, subject types.
- **Inputs**: required/optional inputs + a **missing-information policy** (fail-closed for critical/legal data — Pierre never guesses).
- **Behaviour**: workflow steps, expected tasks/artifacts/communications, employee mutations.
- **Governance**: approvals, permissions, risk classification (level, reversibility, legal & data sensitivity), **autonomy level** (observe → suggest → prepare_draft → execute_with_validation → execute_autonomous → human_only → forbidden).
- **Proactivity**: proactive signals, deadline rules.
- **Dependencies**: integration dependencies, **country rule dependencies**.
- **Reliability**: audit expectations, recovery policy, idempotency policy.
- **Traceability**: implementation status + references, **evidence**, **certification criteria**, target phase (P8.11 / P8.12 / ALREADY_VERIFIED / HUMAN_ONLY).

## 5. Autonomy & safety invariants (enforced)

- HUMAN_ONLY capabilities (dismissal decision, disciplinary qualification/decision, whistleblower handling) can never be given an executing autonomy.
- Autonomous + irreversible mutations must carry an approval policy.
- GDPR anonymize/purge require an explicit admin approval (irreversible).
- Disciplinary, harassment/whistleblower, medical, and payroll computation are classified high/critical legal or data sensitivity and gated accordingly.
- Pierre never presents itself as a physician (health domain is observe/prepare only) and never runs certified payroll computation (EXTERNAL).

## 6. Public promises are backed

Every public "Pierre can do X" ([public-promise-map.ts](src/lib/pierre/v1/hr-canon/public-promise-map.ts)) links to canonical capability ids; a promise is `fully_backed` only when **all** linked capabilities are VERIFIED_EXISTING. 11/15 are fully backed; forward-looking promises (absences, payroll prep, performance) resolve to `partially_backed`/`aspirational` until P8.11/P8.12 — so marketing can never outrun what is testably real. **0 dangling** promises.

## 7. How P8.11 and P8.12 consume this

- **P8.11** builds/verifies the 102 runtime-workflow gaps (MISSING/PARTIAL/CONTRACT_ONLY/IMPLEMENTED_UNVERIFIED). Each gap already carries its workflow contract, autonomy, approvals and certification criteria.
- **P8.12** sources + legally reviews the 32 country-dependent gaps and fills the [country packs](P8_10_COUNTRY_PACK_ARCHITECTURE.md) — replacing SOURCE_REQUIRED with verified values.
- **HUMAN_ONLY (4)** stay human; Pierre only assists.

Anti-improvisation contract: P8.11/P8.12 must build **only** what is in [P8_10_GAP_REGISTER.md](P8_10_GAP_REGISTER.md).

## 8. Scope discipline (what P8.10 did NOT do)

No new HR workflow implementations; no four-country legal rules written; no real provider called; no Production behaviour change; no payroll activation; no Yousign unblock; no deploy; no P9 change. Unverified legal rules remain `SOURCE_REQUIRED` / `LEGAL_REVIEW_REQUIRED` — **no rule invented from model memory.**

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
