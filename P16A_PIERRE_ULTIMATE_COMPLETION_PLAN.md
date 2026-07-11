# P16A — Pierre Ultimate Completion Plan

**This plan does NOT build.** It defines the Pierre Ultimate workstream (Session A). **Doctrine:** Pierre stays the AI HR employee under human validation; **no second HR brain**; the current launch-ready Pierre is not weakened; future features ship behind safe flags, non-production. Pierre consumes technologies (T1) through contracts — it does not hardcode them.

## Priority order (each area references a P14 requirement)

| # | Area | Current | Missing capability | Data | Tech dependency (T1) | Human validation | Commercial claim allowed / forbidden |
|---|---|---|---|---|---|---|---|
| 1 | **HR mission depth** | VERIFIED (P8/P9.6) | Richer multi-step plans / continuations | pierre_rt_ missions/tasks | WorkflowTech | plan proposed, executed under mode | ✅ "transforms requests into structured missions" · ❌ "autonomous execution of sensitive acts" |
| 2 | **HR document depth** | PARTIAL | Deeper templates, amendments, exports | company footprint, dossier | DocumentTech, ExportTech | doc prepared → human validates | ✅ "prepares HR documents to validate" · ❌ "legally guaranteed contract" |
| 3 | **Employee dossier 360** | PARTIAL | Unified 360 view + timeline | employee records, evidence | MemoryTech, EvidenceTech | read-mostly; edits governed | ✅ "centralizes the employee file" · ❌ "official HR register of truth" |
| 4 | **Onboarding / offboarding depth** | PARTIAL | Full governed checklists + follow-up | mission packs | WorkflowTech, NotificationTech | steps validated | ✅ "orchestrates onboarding/offboarding" · ❌ "replaces manager decisions" |
| 5 | **Absences + pre-payroll prep** | PARTIAL | Variables prep to hand to payroll | absence/leave records | DocumentTech, ExportTech | variables validated before transmit | ✅ "prepares pre-payroll variables" · ❌ "payroll engine / DSN" |
| 6 | **Interviews / performance / training** | PARTIAL | Convocations, trames, comptes-rendus | calendar, dossier | CalendarTech, DocumentTech | prepared, human runs | ✅ "prepares interviews/reviews" · ❌ "decides ratings/promotions" |
| 7 | **Employee relations (sensitive)** | PARTIAL | Case structuring/history only | case FSM, evidence | EvidenceTech | **HUMAN_ONLY** for decisions | ✅ "structures the sensitive case" · ❌ "final disciplinary decision" |
| 8 | **Proactive HR follow-up** | PARTIAL | Signal→governed reminders | proactive signals | NotificationTech | reminders proposed | ✅ "proactively follows up" · ❌ "acts without validation" |
| 9 | **Monthly value / ROI report** | ARCHITECTURE_READY | Delivered report artifact | analytics.compute artifacts | AnalyticsTech | report reviewed | ✅ "reports operational value/ROI (estimates)" · ❌ "guaranteed savings" |
| 10 | **Sector adaptation** | ARCHITECTURE_READY | Sector conventions (sourced) | country/sector packs | ConnectorTech + **external legal** | sourced, never invented | ❌ "conforme au droit [secteur/pays]" (external legal) |

## Cross-cutting
- **HR helpdesk quality** (VERIFIED) — improve coverage/quality of answers.
- **HR quality control** (PARTIAL, CloneGuard) — deepen risk/quality gate, expose via EvidenceTech.

## Tests + proofs required (per area, at build time)
- Unit tests on the governed capability + hard floors (sensitive → HUMAN_ONLY, no auto contract/termination).
- Browser proof for user-facing depth (cockpit view / mission flow) on real V1 data.
- Non-regression: existing launch-ready Pierre unchanged; flags default OFF.

## Guardrails (non-negotiable)
- No second HR brain — reuse the real V1 runtime + cognitive-runtime.
- Every new feature behind a safe flag (default OFF), non-production.
- Sensitive/final decisions stay human-validated.
- Legal/country depth stays external-blocked (never claim compliance).
- Pierre consumes T1 technologies through the P16C adapters — no hardcoding.

**Next prompt to run this workstream:** `START P16A — PIERRE ULTIMATE COMPLETION`.
