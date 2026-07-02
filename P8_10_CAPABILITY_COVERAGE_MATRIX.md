# P8.10 — Capability Coverage Matrix (generated)

> Generated from `src/lib/pierre/v1/hr-canon` by `scripts/p810-generate-coverage-report.mjs`. Do not hand-edit.

**215 atomic capabilities across 22/22 domains.** Verified-existing: 77 (35.8%).

## Status distribution

| Status | Count |
|---|---|
| MISSING | 81 |
| VERIFIED_EXISTING | 77 |
| PARTIAL | 36 |
| CONTRACT_ONLY | 6 |
| IMPLEMENTED_UNVERIFIED | 5 |
| EXTERNAL_DEPENDENCY | 5 |
| HUMAN_ONLY | 4 |
| LEGAL_CONTENT_REQUIRED | 1 |

## By target phase

| Target | Count |
|---|---|
| ALREADY_VERIFIED | 77 |
| P8.11 | 102 |
| P8.12 | 32 |
| HUMAN_ONLY | 4 |

## By domain

| Domain | Total | Verified | Readiness % | Status breakdown |
|---|---|---|---|---|
| Organisation & planning (org) | 12 | 7 | 58.3% | VERIFIED_EXISTING:7, PARTIAL:1, MISSING:4 |
| Recruitment (recruitment) | 11 | 1 | 9.1% | IMPLEMENTED_UNVERIFIED:2, VERIFIED_EXISTING:1, MISSING:6, PARTIAL:2 |
| Offer & pre-hire (offer) | 6 | 1 | 16.7% | CONTRACT_ONLY:1, VERIFIED_EXISTING:1, MISSING:2, PARTIAL:2 |
| Contracts & contractual changes (contract) | 25 | 17 | 68% | VERIFIED_EXISTING:17, PARTIAL:6, MISSING:1, EXTERNAL_DEPENDENCY:1 |
| Onboarding (onboarding) | 10 | 5 | 50% | VERIFIED_EXISTING:5, PARTIAL:4, MISSING:1 |
| Employee 360 & administration (employee360) | 14 | 14 | 100% | VERIFIED_EXISTING:14 |
| Absences, leave & time (absence) | 11 | 2 | 18.2% | VERIFIED_EXISTING:2, MISSING:7, PARTIAL:2 |
| Payroll operational (payroll) | 12 | 0 | 0% | IMPLEMENTED_UNVERIFIED:2, CONTRACT_ONLY:1, MISSING:4, EXTERNAL_DEPENDENCY:4, PARTIAL:1 |
| Compensation & benefits (compensation) | 10 | 0 | 0% | MISSING:9, PARTIAL:1 |
| Performance (performance) | 7 | 0 | 0% | MISSING:7 |
| Training & skills (training) | 6 | 0 | 0% | MISSING:5, IMPLEMENTED_UNVERIFIED:1 |
| Career & mobility (career) | 5 | 0 | 0% | MISSING:5 |
| Employee relations (relations) | 5 | 0 | 0% | MISSING:4, HUMAN_ONLY:1 |
| Disciplinary (disciplinary) | 8 | 0 | 0% | PARTIAL:2, HUMAN_ONLY:2, MISSING:4 |
| Health, safety & wellbeing (health) | 7 | 0 | 0% | MISSING:7 |
| HR communications (communications) | 15 | 11 | 73.3% | VERIFIED_EXISTING:11, PARTIAL:3, MISSING:1 |
| Policies & internal compliance (policy) | 5 | 0 | 0% | CONTRACT_ONLY:1, MISSING:4 |
| Offboarding (offboarding) | 8 | 0 | 0% | MISSING:5, HUMAN_ONLY:1, PARTIAL:2 |
| Data, privacy & GDPR (data_gdpr) | 11 | 7 | 63.6% | VERIFIED_EXISTING:7, PARTIAL:2, LEGAL_CONTENT_REQUIRED:1, MISSING:1 |
| Reporting & steering (reporting) | 6 | 0 | 0% | PARTIAL:3, MISSING:3 |
| Proactive operations (proactive) | 10 | 2 | 20% | VERIFIED_EXISTING:2, CONTRACT_ONLY:3, PARTIAL:4, MISSING:1 |
| Pierre administration (pierre_admin) | 11 | 10 | 90.9% | VERIFIED_EXISTING:10, PARTIAL:1 |

## Full capability list

| ID | Domain | Label | Status | Autonomy | Risk | Target |
|---|---|---|---|---|---|---|
| `absence.approval_workflow` | absence | Absence approval workflow (manager/HR) | MISSING | execute_with_validation | medium | P8.11 |
| `absence.balance_calculation` | absence | Leave balance calculation & accrual | MISSING | execute_autonomous | medium | P8.12 |
| `absence.conflict_detection` | absence | Absence conflict/overlap detection & planning | MISSING | execute_autonomous | low | P8.11 |
| `absence.create_request` | absence | Create absence request | VERIFIED_EXISTING | execute_with_validation | low | ALREADY_VERIFIED |
| `absence.list` | absence | List employee absences | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `absence.parental_leave` | absence | Maternity/paternity/parental leave | MISSING | prepare_draft | high | P8.12 |
| `absence.payroll_transmission` | absence | Transmit absences to payroll | MISSING | execute_with_validation | medium | P8.11 |
| `absence.return_to_work` | absence | Return-to-work & accommodation | MISSING | prepare_draft | high | P8.12 |
| `absence.sick_leave` | absence | Sick leave & medical certificate handling | PARTIAL | prepare_draft | medium | P8.12 |
| `absence.time_tracking` | absence | Working time / hours / schedules / on-call | PARTIAL | prepare_draft | medium | P8.12 |
| `absence.timeclock_integration` | absence | Time-clock integration | MISSING | prepare_draft | low | P8.11 |
| `career.geographic_mobility` | career | Geographic mobility (site change) | MISSING | prepare_draft | high | P8.11 |
| `career.internal_mobility` | career | Internal mobility requests & approval | MISSING | prepare_draft | medium | P8.11 |
| `career.mentoring` | career | Mentoring relationships & retention monitoring | MISSING | suggest | low | P8.11 |
| `career.succession_transition` | career | Role transition & succession execution | MISSING | prepare_draft | medium | P8.11 |
| `career.wishes` | career | Track career wishes & evolution paths | MISSING | prepare_draft | low | P8.11 |
| `communications.audit_lifecycle` | communications | Audit delivery lifecycle (PII-free) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `communications.create_intent` | communications | Create communication intent from outbox event | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `communications.dead_letter` | communications | Dead-letter failed communications | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `communications.legal_review` | communications | Validate communication content for legal/compliance | MISSING | prepare_draft | high | P8.11 |
| `communications.preferences` | communications | Communication preferences per user/category/channel | VERIFIED_EXISTING | execute_with_validation | low | ALREADY_VERIFIED |
| `communications.provider_webhook` | communications | Ingest & apply provider webhook (idempotent, monotonic) | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `communications.read_receipt` | communications | Track read receipt / engagement | PARTIAL | execute_autonomous | low | P8.11 |
| `communications.resolve_recipient` | communications | Resolve recipient (strategy-based) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `communications.retry_cancel` | communications | Retry / cancel a delivery (governed) | VERIFIED_EXISTING | execute_with_validation | low | ALREADY_VERIFIED |
| `communications.scheduling` | communications | Schedule comms (quiet hours, batch, delay) | PARTIAL | execute_autonomous | low | P8.11 |
| `communications.secure_link` | communications | Secure, time-limited, revocable document link | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `communications.send_email` | communications | Send email communication (governed, proof-of-send) | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `communications.send_in_app` | communications | Send in-app communication (governed) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `communications.suppression` | communications | Suppress address (bounce/complaint) | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `communications.templates` | communications | Manage communication templates (multilingual, versioned) | PARTIAL | execute_with_validation | low | P8.11 |
| `compensation.benefits` | compensation | Benefits administration (mutuelle, prévoyance) | MISSING | prepare_draft | medium | P8.11 |
| `compensation.equity` | compensation | Equity (options/RSUs) administration | MISSING | prepare_draft | high | P8.11 |
| `compensation.expenses` | compensation | Expense reimbursement | MISSING | execute_with_validation | medium | P8.11 |
| `compensation.pay_equity` | compensation | Pay-equity analysis & reporting | MISSING | observe_only | high | P8.11 |
| `compensation.raise_promotion` | compensation | Raise / promotion compensation | MISSING | prepare_draft | high | P8.11 |
| `compensation.salary_change_prepare` | compensation | Prepare salary change (feeds contract amendment) | PARTIAL | prepare_draft | high | P8.11 |
| `compensation.salary_grid` | compensation | Salary grid maintenance | MISSING | prepare_draft | medium | P8.11 |
| `compensation.salary_review` | compensation | Salary review campaign | MISSING | prepare_draft | high | P8.11 |
| `compensation.variable_pay` | compensation | Variable pay (bonus, commission, incentive) | MISSING | prepare_draft | high | P8.11 |
| `compensation.vouchers` | compensation | Meal vouchers / titres | MISSING | prepare_draft | low | P8.11 |
| `contract.apply_amendment_effects` | contract | Apply amendment effects to employee record | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `contract.approve` | contract | Approve employment contract | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `contract.archive` | contract | Archive contract | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `contract.create` | contract | Create employment contract | VERIFIED_EXISTING | prepare_draft | high | ALREADY_VERIFIED |
| `contract.create_amendment` | contract | Create contract amendment (avenant) | VERIFIED_EXISTING | prepare_draft | high | ALREADY_VERIFIED |
| `contract.end_probation` | contract | End of probation decision | PARTIAL | execute_with_validation | high | P8.12 |
| `contract.expiration` | contract | Contract expiration handling | PARTIAL | prepare_draft | high | P8.11 |
| `contract.finalize` | contract | Finalize contract to final status | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `contract.finalize_signed` | contract | Finalize signed contract with evidence | VERIFIED_EXISTING | execute_autonomous | high | ALREADY_VERIFIED |
| `contract.generate_artifacts` | contract | Generate contract PDF/DOCX | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `contract.hours_change` | contract | Working-hours change (via amendment) | PARTIAL | prepare_draft | high | P8.12 |
| `contract.ingest_signature_webhook` | contract | Ingest & reconcile signature webhook | VERIFIED_EXISTING | execute_autonomous | high | ALREADY_VERIFIED |
| `contract.prepare_signature` | contract | Prepare contract for signature (idempotent) | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `contract.readiness_check` | contract | Check contract readiness before action | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `contract.renewal` | contract | Contract renewal | PARTIAL | prepare_draft | high | P8.12 |
| `contract.request_changes` | contract | Request contract changes | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `contract.role_change` | contract | Role change (via amendment) | PARTIAL | prepare_draft | high | P8.11 |
| `contract.salary_change` | contract | Salary change (via amendment) | PARTIAL | prepare_draft | high | P8.11 |
| `contract.schedule_amendment` | contract | Schedule future amendment activation | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `contract.signature_security_tier` | contract | Enforce signature level (SES/AES/QES) security matrix | VERIFIED_EXISTING | execute_autonomous | high | ALREADY_VERIFIED |
| `contract.submit_review` | contract | Submit contract for review | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `contract.submit_signature` | contract | Submit contract to e-signature provider | EXTERNAL_DEPENDENCY | execute_with_validation | high | P8.11 |
| `contract.suspension` | contract | Contract suspension | MISSING | prepare_draft | high | P8.11 |
| `contract.template_manage` | contract | Manage contract templates & versions (governed, immutable published) | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `contract.versioning` | contract | Contract versioning | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `data_gdpr.access_log` | data_gdpr | Data access audit trail (who/what/when, no values) | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `data_gdpr.anonymize` | data_gdpr | Anonymize employee (pseudonymization, legal aggregates preserved) | VERIFIED_EXISTING | execute_with_validation | critical | ALREADY_VERIFIED |
| `data_gdpr.consent_proof` | data_gdpr | Maintain consent proof for communications | MISSING | execute_autonomous | high | P8.12 |
| `data_gdpr.delete_document` | data_gdpr | Delete a document (erasure) | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `data_gdpr.export_company` | data_gdpr | Export company data (bulk SAR) | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `data_gdpr.export_employee` | data_gdpr | Export employee data (SAR / portability) | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `data_gdpr.legal_basis` | data_gdpr | Maintain legal basis & data minimization | LEGAL_CONTENT_REQUIRED | prepare_draft | high | P8.12 |
| `data_gdpr.legal_hold` | data_gdpr | Set legal hold (blocks anonymization + purge) | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `data_gdpr.purge` | data_gdpr | Purge employee (physical delete w/ retention guard) | VERIFIED_EXISTING | execute_with_validation | critical | ALREADY_VERIFIED |
| `data_gdpr.retention` | data_gdpr | Enforce statutory retention & scheduled deletion | PARTIAL | execute_with_validation | high | P8.12 |
| `data_gdpr.right_to_object` | data_gdpr | Right to object / opt-out from a processing category | PARTIAL | execute_with_validation | high | P8.11 |
| `disciplinary.appeal` | disciplinary | Manage disciplinary appeals | MISSING | prepare_draft | high | P8.11 |
| `disciplinary.chain_of_custody` | disciplinary | Document chronology & evidence chain of custody | PARTIAL | prepare_draft | high | P8.11 |
| `disciplinary.closure` | disciplinary | Track case closure & archive | MISSING | execute_with_validation | high | P8.11 |
| `disciplinary.deadlines` | disciplinary | Enforce statutory disciplinary deadlines | MISSING | execute_autonomous | high | P8.12 |
| `disciplinary.decision` | disciplinary | Issue disciplinary decision/warning/sanction | HUMAN_ONLY | human_only | critical | HUMAN_ONLY |
| `disciplinary.file_report` | disciplinary | File disciplinary report & collect facts/evidence | PARTIAL | prepare_draft | high | P8.11 |
| `disciplinary.qualify` | disciplinary | Analyze facts & qualify violation | HUMAN_ONLY | human_only | critical | HUMAN_ONLY |
| `disciplinary.summons` | disciplinary | Summon employee for disciplinary interview | MISSING | prepare_draft | high | P8.12 |
| `employee360.archive` | employee360 | Archive employee (mark as left) | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `employee360.completeness` | employee360 | Employee completeness score + blocking items | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `employee360.create` | employee360 | Create employee with identity | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `employee360.custom_fields` | employee360 | Custom field definitions & values | VERIFIED_EXISTING | execute_with_validation | low | ALREADY_VERIFIED |
| `employee360.documents_list` | employee360 | List employee documents (metadata only) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `employee360.import` | employee360 | Bulk employee import (validated batches) | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `employee360.list` | employee360 | List employees (site-scoped, paginated) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `employee360.reactivate` | employee360 | Reactivate employee | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `employee360.rectify` | employee360 | Rectify employee data (GDPR correction) | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `employee360.search` | employee360 | Search employees (accent/typo tolerant) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `employee360.sensitive_data` | employee360 | Manage sensitive data (restricted access + audit) | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `employee360.timeline` | employee360 | Employee timeline (events + status history) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `employee360.update` | employee360 | Update employee (identity, contact, role, dates) | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `employee360.view_360` | employee360 | Employee 360 view (events, documents, absences) | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `health.accommodations` | health | Manage medical accommodations | MISSING | prepare_draft | high | P8.11 |
| `health.incident_reporting` | health | Report & track workplace incidents/accidents | MISSING | prepare_draft | high | P8.11 |
| `health.mandatory_safety_training` | health | Track mandatory H&S training completion | MISSING | execute_autonomous | high | P8.12 |
| `health.medical_visits` | health | Manage mandatory occupational-health visits | MISSING | prepare_draft | high | P8.12 |
| `health.mental_health` | health | Wellbeing / workload signals (never diagnostic) | MISSING | observe_only | high | P8.11 |
| `health.risk_assessment` | health | Risk assessment & prevention planning | MISSING | prepare_draft | high | P8.11 |
| `health.safety_clearances` | health | Manage safety clearances & access restrictions | MISSING | prepare_draft | high | P8.11 |
| `offboarding.dismissal` | offboarding | Dismissal procedure (governed, human+legal) | HUMAN_ONLY | human_only | critical | HUMAN_ONLY |
| `offboarding.end_of_contract` | offboarding | End of fixed-term contract | PARTIAL | prepare_draft | high | P8.12 |
| `offboarding.exit_interview` | offboarding | Exit interview | MISSING | prepare_draft | low | P8.11 |
| `offboarding.file_closure_archival` | offboarding | Close & archive employee file (retention) | PARTIAL | execute_with_validation | medium | P8.12 |
| `offboarding.final_pay` | offboarding | Prepare final pay & documents (STC) | MISSING | prepare_draft | high | P8.12 |
| `offboarding.mutual_termination` | offboarding | Mutual termination (or local equivalent) | MISSING | prepare_draft | high | P8.12 |
| `offboarding.orchestrate` | offboarding | Orchestrate offboarding (access, handover, equipment, docs) | MISSING | execute_with_validation | high | P8.11 |
| `offboarding.resignation` | offboarding | Process resignation | MISSING | prepare_draft | high | P8.12 |
| `offer.candidate_to_employee` | offer | Convert candidate → employee (onboarding handoff) | PARTIAL | execute_with_validation | medium | P8.11 |
| `offer.generate_offer_document` | offer | Generate job-offer document (promesse d'embauche) | CONTRACT_ONLY | prepare_draft | high | P8.12 |
| `offer.negotiation` | offer | Offer negotiation workflow | MISSING | prepare_draft | medium | P8.11 |
| `offer.render_offer_premium` | offer | Render offer document (premium) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `offer.right_to_work` | offer | Right-to-work / work-authorization verification | MISSING | prepare_draft | high | P8.12 |
| `offer.signature_collection` | offer | Collect offer/pre-hire signatures | PARTIAL | execute_with_validation | high | P8.11 |
| `onboarding.access_provisioning` | onboarding | Account/access provisioning | MISSING | prepare_draft | medium | P8.11 |
| `onboarding.complete_session` | onboarding | Complete onboarding session (READY gate) | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `onboarding.complete_step` | onboarding | Complete onboarding step (server-verified + evidence hash) | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `onboarding.document_collection` | onboarding | Onboarding document collection & chase | PARTIAL | execute_with_validation | medium | P8.11 |
| `onboarding.employee_onboarding_plan` | onboarding | Employee onboarding plan (preboarding, access, equipment, buddy, checkpoints) | PARTIAL | prepare_draft | medium | P8.11 |
| `onboarding.get_session` | onboarding | Get onboarding session state + steps | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `onboarding.incomplete_handling` | onboarding | Detect & escalate incomplete onboarding | PARTIAL | execute_autonomous | low | P8.11 |
| `onboarding.probation_tracking` | onboarding | Probation checkpoints & end-of-probation prompt | PARTIAL | execute_autonomous | medium | P8.12 |
| `onboarding.registry_steps` | onboarding | Canonical onboarding step registry | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `onboarding.reopen_step` | onboarding | Reopen completed step (governed recovery) | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `org.archive_site` | org | Archive site + reassign employees | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `org.assign_site_manager` | org | Assign site manager | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `org.create_site` | org | Create establishment/site | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `org.list_sites` | org | List sites (RBAC-scoped) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `org.manage_org_structure` | org | Model teams/departments/positions & org chart | PARTIAL | prepare_draft | low | P8.11 |
| `org.position_budget` | org | Position budgeting & approval | MISSING | prepare_draft | medium | P8.11 |
| `org.read_company` | org | Read company information | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `org.restructuring_prepare` | org | Prepare restructuring scenarios (analysis only) | MISSING | observe_only | high | P8.12 |
| `org.succession_planning` | org | Succession planning for key roles | MISSING | suggest | medium | P8.11 |
| `org.update_company` | org | Update company properties | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `org.update_site` | org | Update site properties | VERIFIED_EXISTING | execute_with_validation | low | ALREADY_VERIFIED |
| `org.workforce_planning` | org | Workforce planning, headcount & future needs | MISSING | suggest | low | P8.11 |
| `payroll.absence_recap` | payroll | Absence recap for a payroll period | IMPLEMENTED_UNVERIFIED | prepare_draft | medium | P8.11 |
| `payroll.anomaly_detection` | payroll | Payroll data anomaly detection | CONTRACT_ONLY | execute_autonomous | high | P8.11 |
| `payroll.calendar` | payroll | Payroll calendar & cutoffs | MISSING | execute_autonomous | medium | P8.11 |
| `payroll.collect_variables` | payroll | Collect payroll variables (hours, premiums, bonuses) | IMPLEMENTED_UNVERIFIED | prepare_draft | high | P8.11 |
| `payroll.correction` | payroll | Payroll correction / rappel | MISSING | execute_with_validation | high | P8.11 |
| `payroll.dsn_declaration` | payroll | Social declaration submission (e.g. DSN/ONSS/CCSS) | EXTERNAL_DEPENDENCY | observe_only | critical | P8.12 |
| `payroll.export_transmission` | payroll | Export & transmit to payroll provider | EXTERNAL_DEPENDENCY | execute_with_validation | high | P8.12 |
| `payroll.official_calculation` | payroll | Official payroll calculation (certified engine) | EXTERNAL_DEPENDENCY | observe_only | critical | P8.12 |
| `payroll.payslip_distribution` | payroll | Secure payslip distribution | PARTIAL | execute_with_validation | high | P8.11 |
| `payroll.payslip_generation` | payroll | Payslip generation | EXTERNAL_DEPENDENCY | observe_only | high | P8.12 |
| `payroll.provider_reconciliation` | payroll | Reconcile provider return | MISSING | execute_with_validation | high | P8.11 |
| `payroll.validation` | payroll | Payroll variables validation before transmission | MISSING | execute_with_validation | high | P8.11 |
| `performance.annual_review` | performance | Annual/professional interview workflow | MISSING | prepare_draft | medium | P8.11 |
| `performance.calibration` | performance | Calibration & promotion committee support | MISSING | suggest | high | P8.11 |
| `performance.feedback_360` | performance | 360 feedback & peer review | MISSING | prepare_draft | medium | P8.11 |
| `performance.objectives` | performance | Create & track objectives (OKRs/goals) | MISSING | prepare_draft | low | P8.11 |
| `performance.one_to_one` | performance | One-to-ones & performance notes | MISSING | prepare_draft | low | P8.11 |
| `performance.pip` | performance | Performance improvement plan (PIP) | MISSING | prepare_draft | high | P8.11 |
| `performance.recognition` | performance | Recognition & documentation | MISSING | prepare_draft | low | P8.11 |
| `pierre_admin.action_registry` | pierre_admin | Closed autonomous action registry (fail-closed) | VERIFIED_EXISTING | execute_autonomous | high | ALREADY_VERIFIED |
| `pierre_admin.approval_workflow` | pierre_admin | Human approval workflow (validation requests + fingerprinting) | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `pierre_admin.audit_trail` | pierre_admin | Immutable audit trail & observability | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `pierre_admin.autonomy_config` | pierre_admin | Company autonomy & permission delegation config | VERIFIED_EXISTING | execute_with_validation | high | ALREADY_VERIFIED |
| `pierre_admin.cloneguard` | pierre_admin | CloneGuard approval & prohibition gates | VERIFIED_EXISTING | execute_autonomous | high | ALREADY_VERIFIED |
| `pierre_admin.country_config` | pierre_admin | Country configuration (jurisdiction resolution + packs) | PARTIAL | execute_with_validation | high | P8.11 |
| `pierre_admin.durable_queue` | pierre_admin | Durable task queue with leasing + fair claim | VERIFIED_EXISTING | execute_autonomous | high | ALREADY_VERIFIED |
| `pierre_admin.mission_orchestration` | pierre_admin | Mission creation & orchestration | VERIFIED_EXISTING | execute_autonomous | medium | ALREADY_VERIFIED |
| `pierre_admin.permission_enforcement` | pierre_admin | API-layer permission enforcement + escalation prevention | VERIFIED_EXISTING | execute_autonomous | high | ALREADY_VERIFIED |
| `pierre_admin.recovery` | pierre_admin | Worker lease recovery with fencing | VERIFIED_EXISTING | execute_autonomous | high | ALREADY_VERIFIED |
| `pierre_admin.sending_identity` | pierre_admin | Sending identity, channels & limits config | VERIFIED_EXISTING | execute_with_validation | medium | ALREADY_VERIFIED |
| `policy.acceptance` | policy | Require & record policy acceptance (NDA, code of conduct) | MISSING | execute_with_validation | medium | P8.11 |
| `policy.define` | policy | Define an internal HR policy | CONTRACT_ONLY | prepare_draft | medium | P8.11 |
| `policy.enforcement_audit` | policy | Audit policy application & exceptions | MISSING | execute_autonomous | medium | P8.11 |
| `policy.impact_diffusion` | policy | Policy impact analysis & diffusion + proof | MISSING | prepare_draft | low | P8.11 |
| `policy.version_publish` | policy | Version & publish policy updates | MISSING | execute_with_validation | medium | P8.11 |
| `proactive.blocked_signature` | proactive | Blocked-signature detection | PARTIAL | execute_autonomous | medium | P8.11 |
| `proactive.contract_expiry` | proactive | Detect contract expiry & prompt | CONTRACT_ONLY | execute_autonomous | medium | P8.11 |
| `proactive.end_of_probation` | proactive | End-of-probation monitoring | CONTRACT_ONLY | execute_autonomous | medium | P8.12 |
| `proactive.expiring_training` | proactive | Expiring training/certification detection | MISSING | execute_autonomous | medium | P8.11 |
| `proactive.followup` | proactive | Follow-up scheduling (durable, bounded) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `proactive.missing_document` | proactive | Missing-document detection & chase | PARTIAL | execute_autonomous | low | P8.11 |
| `proactive.payroll_anomaly` | proactive | Payroll anomaly / untreated absence detection | CONTRACT_ONLY | execute_autonomous | high | P8.11 |
| `proactive.retention_deletion` | proactive | Retention obligation & scheduled deletion detection | PARTIAL | execute_with_validation | high | P8.12 |
| `proactive.scheduler` | proactive | Durable proactive scheduler (bounded recurrence, stop conditions) | VERIFIED_EXISTING | execute_autonomous | low | ALREADY_VERIFIED |
| `proactive.sla_breach` | proactive | SLA breach & provider-chase detection | PARTIAL | execute_autonomous | medium | P8.11 |
| `recruitment.candidate_data_compliance` | recruitment | Candidate data GDPR/consent & retention | MISSING | prepare_draft | high | P8.12 |
| `recruitment.candidate_rejection` | recruitment | Formal candidate rejection notification | IMPLEMENTED_UNVERIFIED | prepare_draft | medium | P8.11 |
| `recruitment.classify_intent` | recruitment | Detect recruitment intent from request | IMPLEMENTED_UNVERIFIED | execute_autonomous | low | P8.11 |
| `recruitment.interview_scheduling` | recruitment | Interview scheduling & evaluation capture | PARTIAL | prepare_draft | medium | P8.11 |
| `recruitment.job_requisition` | recruitment | Open a job requisition (need, job description, budget approval) | MISSING | prepare_draft | medium | P8.11 |
| `recruitment.pipeline` | recruitment | Candidate pipeline & talent pool management | MISSING | prepare_draft | medium | P8.11 |
| `recruitment.plan_hiring_tasks` | recruitment | Plan hiring tasks & missing-info detection | VERIFIED_EXISTING | prepare_draft | low | ALREADY_VERIFIED |
| `recruitment.posting` | recruitment | Publish/post an opening | MISSING | prepare_draft | low | P8.11 |
| `recruitment.reference_checks` | recruitment | Reference checks | MISSING | prepare_draft | medium | P8.11 |
| `recruitment.screening_decision` | recruitment | Screening/hiring decision (accept/reject) | PARTIAL | execute_with_validation | high | P8.11 |
| `recruitment.sourcing` | recruitment | Sourcing & candidate intake | MISSING | suggest | medium | P8.11 |
| `relations.complaints` | relations | Log & resolve complaints/conflicts | MISSING | prepare_draft | high | P8.11 |
| `relations.harassment_alert` | relations | Harassment/discrimination alert intake (governed, confidential) | MISSING | observe_only | critical | P8.11 |
| `relations.hr_requests` | relations | HR questions/requests ticketing | MISSING | execute_with_validation | medium | P8.11 |
| `relations.mediation` | relations | Mediation & escalation tracking | MISSING | observe_only | high | P8.11 |
| `relations.whistleblower` | relations | Whistleblower protection & confidentiality | HUMAN_ONLY | human_only | critical | HUMAN_ONLY |
| `reporting.absenteeism` | reporting | Absenteeism reporting | MISSING | execute_autonomous | low | P8.11 |
| `reporting.anomaly_surfacing` | reporting | Surface anomalies & risks | PARTIAL | execute_autonomous | medium | P8.11 |
| `reporting.completeness_deadlines` | reporting | Completeness & deadline dashboards | PARTIAL | execute_autonomous | low | P8.11 |
| `reporting.executive_report` | reporting | Executive/HR periodic reports + recommended actions | MISSING | prepare_draft | low | P8.11 |
| `reporting.headcount_turnover` | reporting | Headcount & turnover reporting | PARTIAL | execute_autonomous | low | P8.11 |
| `reporting.recruitment_funnel` | reporting | Recruitment/onboarding funnel reporting | MISSING | execute_autonomous | low | P8.11 |
| `training.certification_tracking` | training | Track certification validity & expiry | MISSING | execute_autonomous | medium | P8.11 |
| `training.enrollment` | training | Enroll employees & manage convocations | MISSING | execute_with_validation | low | P8.11 |
| `training.evaluation` | training | Post-training evaluation | MISSING | prepare_draft | low | P8.11 |
| `training.mandatory_compliance` | training | Enforce mandatory training compliance & proof | MISSING | execute_autonomous | high | P8.12 |
| `training.plan` | training | Create & track training plans | IMPLEMENTED_UNVERIFIED | prepare_draft | low | P8.11 |
| `training.skills_mapping` | training | Map required vs held skills / gap | MISSING | prepare_draft | low | P8.11 |
