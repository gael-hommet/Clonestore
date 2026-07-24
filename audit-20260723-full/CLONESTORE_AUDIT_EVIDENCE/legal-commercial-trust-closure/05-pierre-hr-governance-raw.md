# Raw finding — Pierre HR capability & governance mapping (for AI Act / HR-decision analysis)

Source: read-only Explore agent, full reads of CloneGuard/autonomy/capability-canon modules.

## 1. CloneGuard governance evaluator
Two independently-implemented CloneGuard evaluators exist (`src/lib/pierre/hr/cloneguard.ts` HR-domain "Bloc 14", and `src/lib/pierre/v1/cloneguard.ts` runtime core "Phase 8.1") — wired into different paths (HR mission/task pipeline uses `hr/cloneguard.ts`; P16A sensitive-floor reuses `v1/cloneguard.ts`). `legacy-execute-governance.ts` (P0.1) reuses `evaluatePierreCloneGuard` + `evaluateGovernance` unmodified.

Gated action-kind list (`hr/cloneguard.ts:45-61`): `email_send, email_draft, doc_generate, doc_rewrite, pdf_generate, reminder_create, followup_schedule, contract_action, disciplinary_prep, disciplinary_decision, dismissal_action, payroll_action, absence_action, integration_sync, unknown_action`. Decisions: `allow | allow_with_warning | require_approval | block | refuse`.

`refuse` (absolute, `can_override:false`): harassment, discrimination, violence/aggression, "prud'hommes", "faute grave/lourde", `dismissal_action`, `disciplinary_decision` action-kinds.
`block`: `email_send` (never auto-executed), any `approval_required:true` task, "judiciaire" context.
`require_approval`: `contract_action`, `disciplinary_prep`, `absence_action`, `payroll_action`, `integration_sync`/HRIS sync, "licenciement"/"rupture conventionnelle"/"offboarding" free text, red/black risk hint.

`hr/governance.ts` final combined decision requires ALL THREE sub-evaluators (CloneGuard + ClonePolicy + CloneTrust) to agree before `allowed_to_auto_execute:true`.

## 2. Human-only floors — FOUR independent hard-coded lists (not one canonical enum)
- **A.** `v1/cloneguard.ts:31-34` `HARD_BLOCK`: `sanction, termination, dismissal, sensitive_medical, discrimination_flagged, harassment_flagged, final_recruitment_decision`. `APPROVAL_ONLY` (37-39): `contract, amendment, compensation, sensitive_legal_letter`. Text-pattern net (58-64) incl. `protected_characteristic` regex (`origine|religion|handicap|grossesse|enceinte|syndic|orientation sexuelle`).
- **B.** `hr/autonomy.ts:47-52` `isBlackAction()` — invariant rule runs BEFORE any autonomy-level switch: black actions are always blocked regardless of the 5 autonomy levels.
- **C.** `v1/ultimate/p16a/sensitive-floor.ts` — `FinalDecisionCategory`: `dismissal, sanction, salary_change, promotion, legal_conclusion, medical_conclusion, protected_class_assessment, irreversible_decision, unsupported_country_legal` — "ALWAYS human-only — independent of the autonomy mode."
- **D.** `pierre-legal-taxonomy.ts` ("B47" taxonomy, 12 sensitive categories: dismissal, sanction, harassment, discrimination, health, salary, payroll, contract, conflict, legal, employee_data, absence_sensitive) — every one `autonomous_decision_allowed:false`, `send_allowed:false`.

## 3. HR capability canon (P8.10)
`src/lib/pierre/v1/hr-canon/capability-registry.ts` — 215 capabilities across 22 domains (`org, recruitment, offer, contract, onboarding, employee360, absence, payroll, compensation, performance, training, career, relations, disciplinary, health, communications, policy, offboarding, data_gdpr, reporting, proactive, pierre_admin`). Status breakdown: 77 VERIFIED_EXISTING, 36 PARTIAL, 81 MISSING, 5 IMPLEMENTED_UNVERIFIED, 6 CONTRACT_ONLY, 5 EXTERNAL_DEPENDENCY, 1 LEGAL_CONTENT_REQUIRED, **4 HUMAN_ONLY**: `disciplinary.qualify`, `disciplinary.decision`, `offboarding.dismissal`, `relations.whistleblower`. Country packs FR/BE/LU/CH exist, "0 invented legal rules (all SOURCE_REQUIRED)".

## 4. Autonomous vs. human-gated execution
`v1/autonomy.ts:22-42` — `AUTO_EXECUTE_ACTIONS`: reminders, deadline reminders, acknowledge receipt, classification, status updates, standard reports, low-risk notifications, task creation, operational summaries. `APPROVAL_REQUIRED_ACTIONS` (always gated): contract, amendment, compensation, sanction, termination, dismissal, sensitive_medical, discrimination_flagged, harassment_flagged, final_recruitment_decision, sensitive_legal_letter.

`tasks/execute-task.ts` — CloneGuard then full Governance run before ANY executor; if not allowed, task is set `awaiting_approval` with `HUMAN_APPROVAL_REQUIRED`, never proceeds without a recorded human decision.

`v1/runtime-plan-compiler.ts` `compileMissionPlan()` — structural enforcement: any `risk:"sensitive"` step must declare an `approval_gate` pointing to an upstream approval step, or the whole plan is refused at compile time; `risk:"prohibited"` steps refused outright.

## 5. Special-category data (GDPR Art. 9)
**No employee-record schema field exists** for health/union/religion/biometric data — sensitivity is only tagged generically (`"normal"|"sensitive"|"restricted"`). What exists instead is **text-pattern detection over free-form mission text** in three places (`v1/cloneguard.ts:61,63`; `p16a/sensitive-floor.ts:29,31`; `pierre-legal-taxonomy.ts` health keywords) — used only to trigger a human-only gate, never to store/classify a structured Art.9 field. `relations.whistleblower`/`relations.harassment_alert` exist in the capability registry (MISSING/HUMAN_ONLY, not yet a runtime workflow). No "biométrique"/"biometric" literal match anywhere under `src/lib/pierre`. **Whether uploaded documents (e.g. medical certificates) store such data was out of scope for this pass** — flagged as an open question for the DPA/AIPD analysis.

## 6. Built-in UI disclaimers (product copy, not marketing)
`src/components/pierre/autonomy/PierreAutonomyPanel.tsx:28,135-138` — "Réservé à une décision humaine... jamais automatisé, quel que soit le mode" — rendered from the REAL server-derived `decideValidation()` matrix, not cosmetic labels. `PierreMissionUnderstanding.tsx:300-303,548-550`, `PierreExecutionBoard.tsx:385` ("Validation humaine requise" signal pill) — all wired to the actual governance engine.
