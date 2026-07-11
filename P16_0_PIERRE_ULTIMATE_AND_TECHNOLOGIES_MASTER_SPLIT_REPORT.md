# P16.0 — Pierre Ultimate + CloneStore Technologies Master Split

**Date:** 2026-07-09 · **Nature:** a **planning + classification** phase — the master split and execution plan for evolving Pierre and building a reusable technologies layer. **No build, no product change, production OFF, no payment, no Stripe change, no deploy.**

> **Verdict: P16.0 — MASTER SPLIT VERIFIED / TWO WORKSTREAMS + INTEGRATION GATE RECOMMENDED.**

The remaining work is classified into **49 items** across 5 categories, grounded in the real P14 coverage catalog: **12 Pierre Ultimate · 15 Technologies · 10 Integration adapters · 6 External-Blocked · 6 Must-Not-Claim** (`src/lib/clonestore/ultimate/p16-master-split.ts`).

---

## Answers to the 9 questions

**1. One chantier or two?** **Two + an integration gate.** Session A (**P16A** — Pierre Ultimate), Session B (**T1** — CloneStore Technologies), then Session C (**P16C** — integration). Rationale: safer (separate blast radius), less context pollution, cleaner test boundaries, reusable technologies (avoids hardcoding into Pierre), independent non-regression, and easy to stop one track without blocking the other.

**2. What belongs to Pierre?** The 12 Pierre-Ultimate items (owner=`pierre`): HR mission/document/dossier depth, onboarding/offboarding, absences + pre-payroll prep, interviews/performance/training, sensitive employee relations (prep only), proactive follow-up, monthly value/ROI report, sector adaptation, helpdesk quality, quality control. Pierre stays the HR employee under human validation — **no second HR brain**.

**3. What belongs to technologies?** The 15 reusable capabilities (owner=`technology`): Document, Mail, Calendar, Signature, Voice/CloneVoice, Notification, Connector, Memory, Evidence/Trace, Workflow, Analytics/ROI, File, Export, Permission, and the **TechnologyBus** (built on the existing employee-context-registry so any future AI employee consumes the same layer).

**4. What belongs to integration?** The 10 adapters (owner=`integration`): `PierreDocumentTechAdapter`, `…MailTechAdapter`, `…CalendarTechAdapter`, `…SignatureTechAdapter`, `…VoiceTechAdapter`, `…NotificationTechAdapter`, `…AnalyticsTechAdapter`, `…EvidenceTechAdapter`, `…WorkflowTechAdapter`, `…PermissionTechAdapter` — each with input/output, source of truth, validation gate, audit, failure behavior, and a **safe fallback** (Pierre degrades safely when a technology isn't live).

**5. What can be built safely before Stripe live?** **33 of the 49 items** — all Pierre-Ultimate and Technology and Integration items except the 16 `later`/external ones. None require Stripe live. Start with the low-risk foundations: MemoryTech + PermissionTech (verified), EvidenceTech, then DocumentTech / WorkflowTech / AnalyticsTech, plus Pierre's low-risk depth (mission, helpdesk, quality).

**6. What remains external/live blocked?** 6 external-blocked: Stripe live, Yousign/signature live, email domain/provider, external legal/tax validation (FR/BE/LU/CH), live SIRH/payroll, production monitoring provider. (Grounded: the P14-referenced ones map to P14 LEGAL/PROVIDER/EXTERNAL_BLOCKED.)

**7. What must never be claimed?** 6 must-not-claim (grounded to P14 MUST_NOT_CLAIM where referenced): legal-compliance guarantee, autonomous DRH, payroll engine/DSN, live signature while fallback-only, live Stripe while unverified, final sensitive decisions without human validation.

**8. Recommended next chantier?** **T1 (Technologies) and P16A (Pierre Ultimate) in parallel-capable but separate sessions**, foundations first (Memory/Permission/Evidence), then the integration gate P16C. Build order favours reuse: technologies as contracts → Pierre adapters → depth.

**9. Exact next prompts to run:**
- `START P16A — PIERRE ULTIMATE COMPLETION` (see [P16A_PIERRE_ULTIMATE_COMPLETION_PLAN.md](P16A_PIERRE_ULTIMATE_COMPLETION_PLAN.md)).
- `START T1 — CLONESTORE TECHNOLOGIES LAYER` (see [T1_CLONESTORE_TECHNOLOGIES_LAYER_PLAN.md](T1_CLONESTORE_TECHNOLOGIES_LAYER_PLAN.md)).
- `START P16C — PIERRE x TECHNOLOGIES INTEGRATION` (after A + B; see [P16C_PIERRE_TECHNOLOGIES_INTEGRATION_PLAN.md](P16C_PIERRE_TECHNOLOGIES_INTEGRATION_PLAN.md)).

## How we avoid breaking the launch-ready product
- Everything future ships behind **safe flags (default OFF)**, non-production.
- **No second HR brain** — reuse the verified V1 runtime + cognitive-runtime; WorkflowTech is a generic engine, HR reasoning stays in Pierre.
- Technologies are **reusable, contract-based** (the split enforces "no Pierre-only tech without justification").
- Sensitive/final decisions stay **human-validated**; legal/country depth stays external-blocked (never claim compliance).
- Independent non-regression per workstream; the P16C gate opens only when A + B are proven.

## Gates
- **P16.0 tests 14/14** (12 master-split incl. the P14 cross-check + 2 computed-proof) · **tsc 0 source errors** · non-regression **6846/6846**.
- **Additive-only** — no file under `pierre/v1`, `production`, `pricing`, or the P12–P15.1 modules modified · **PRODUCTION_AUTHORIZED false** · payment mode never live · no payment/Stripe change/deploy · P8–P15.1 + Pierre V1 untouched.

Proofs: [.p16-proofs/p16-0-master-split/](.p16-proofs/p16-0-master-split/) (master-split · pierre-plan · technology-plan · integration-plan · session-strategy · perimeter · final-verdict).
