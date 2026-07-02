# P8.10 — Gap Register (generated) — the exact P8.11 / P8.12 build list

> Generated from the canon. P8.11/P8.12 must build ONLY what is listed here (anti-improvisation contract).

- **Total gaps:** 138
- **P8.11 (runtime workflows):** 102
- **P8.12 (country legal rules):** 32
- **HUMAN_ONLY (never automated):** 4

## P8.11 — build & verify runtime workflows (102)

| ID | Domain | Label | Status | Autonomy | Legal | Country rule families | Integrations |
|---|---|---|---|---|---|---|---|
| `absence.approval_workflow` | absence | Absence approval workflow (manager/HR) | MISSING | execute_with_validation | standard | - | - |
| `absence.conflict_detection` | absence | Absence conflict/overlap detection & planning | MISSING | execute_autonomous | standard | - | - |
| `absence.timeclock_integration` | absence | Time-clock integration | MISSING | prepare_draft | standard | - | - |
| `absence.payroll_transmission` | absence | Transmit absences to payroll | MISSING | execute_with_validation | standard | - | - |
| `career.wishes` | career | Track career wishes & evolution paths | MISSING | prepare_draft | standard | - | - |
| `career.internal_mobility` | career | Internal mobility requests & approval | MISSING | prepare_draft | standard | - | - |
| `career.geographic_mobility` | career | Geographic mobility (site change) | MISSING | prepare_draft | high | - | - |
| `career.succession_transition` | career | Role transition & succession execution | MISSING | prepare_draft | standard | - | - |
| `career.mentoring` | career | Mentoring relationships & retention monitoring | MISSING | suggest | standard | - | - |
| `communications.templates` | communications | Manage communication templates (multilingual, versioned) | PARTIAL | execute_with_validation | standard | - | - |
| `communications.scheduling` | communications | Schedule comms (quiet hours, batch, delay) | PARTIAL | execute_autonomous | standard | - | - |
| `communications.read_receipt` | communications | Track read receipt / engagement | PARTIAL | execute_autonomous | standard | - | - |
| `communications.legal_review` | communications | Validate communication content for legal/compliance | MISSING | prepare_draft | high | - | - |
| `compensation.salary_grid` | compensation | Salary grid maintenance | MISSING | prepare_draft | standard | - | - |
| `compensation.salary_change_prepare` | compensation | Prepare salary change (feeds contract amendment) | PARTIAL | prepare_draft | high | - | - |
| `compensation.raise_promotion` | compensation | Raise / promotion compensation | MISSING | prepare_draft | standard | - | - |
| `compensation.variable_pay` | compensation | Variable pay (bonus, commission, incentive) | MISSING | prepare_draft | standard | - | - |
| `compensation.equity` | compensation | Equity (options/RSUs) administration | MISSING | prepare_draft | high | - | - |
| `compensation.benefits` | compensation | Benefits administration (mutuelle, prévoyance) | MISSING | prepare_draft | standard | - | benefits_provider:not_integrated |
| `compensation.vouchers` | compensation | Meal vouchers / titres | MISSING | prepare_draft | standard | - | - |
| `compensation.expenses` | compensation | Expense reimbursement | MISSING | execute_with_validation | standard | - | - |
| `compensation.salary_review` | compensation | Salary review campaign | MISSING | prepare_draft | standard | - | - |
| `compensation.pay_equity` | compensation | Pay-equity analysis & reporting | MISSING | observe_only | high | - | - |
| `contract.role_change` | contract | Role change (via amendment) | PARTIAL | prepare_draft | high | - | - |
| `contract.salary_change` | contract | Salary change (via amendment) | PARTIAL | prepare_draft | high | - | - |
| `contract.suspension` | contract | Contract suspension | MISSING | prepare_draft | high | - | - |
| `contract.expiration` | contract | Contract expiration handling | PARTIAL | prepare_draft | standard | - | - |
| `contract.submit_signature` | contract | Submit contract to e-signature provider | EXTERNAL_DEPENDENCY | execute_with_validation | high | - | signature_provider:blocked |
| `data_gdpr.right_to_object` | data_gdpr | Right to object / opt-out from a processing category | PARTIAL | execute_with_validation | high | - | - |
| `disciplinary.file_report` | disciplinary | File disciplinary report & collect facts/evidence | PARTIAL | prepare_draft | high | - | - |
| `disciplinary.chain_of_custody` | disciplinary | Document chronology & evidence chain of custody | PARTIAL | prepare_draft | standard | - | - |
| `disciplinary.appeal` | disciplinary | Manage disciplinary appeals | MISSING | prepare_draft | high | - | - |
| `disciplinary.closure` | disciplinary | Track case closure & archive | MISSING | execute_with_validation | standard | - | - |
| `health.incident_reporting` | health | Report & track workplace incidents/accidents | MISSING | prepare_draft | high | - | - |
| `health.risk_assessment` | health | Risk assessment & prevention planning | MISSING | prepare_draft | high | - | - |
| `health.accommodations` | health | Manage medical accommodations | MISSING | prepare_draft | high | - | - |
| `health.mental_health` | health | Wellbeing / workload signals (never diagnostic) | MISSING | observe_only | standard | - | - |
| `health.safety_clearances` | health | Manage safety clearances & access restrictions | MISSING | prepare_draft | standard | - | - |
| `offboarding.orchestrate` | offboarding | Orchestrate offboarding (access, handover, equipment, docs) | MISSING | execute_with_validation | standard | - | - |
| `offboarding.exit_interview` | offboarding | Exit interview | MISSING | prepare_draft | standard | - | - |
| `offer.negotiation` | offer | Offer negotiation workflow | MISSING | prepare_draft | standard | - | - |
| `offer.signature_collection` | offer | Collect offer/pre-hire signatures | PARTIAL | execute_with_validation | standard | - | signature_provider:blocked |
| `offer.candidate_to_employee` | offer | Convert candidate → employee (onboarding handoff) | PARTIAL | execute_with_validation | standard | - | - |
| `onboarding.employee_onboarding_plan` | onboarding | Employee onboarding plan (preboarding, access, equipment, buddy, checkpoints) | PARTIAL | prepare_draft | standard | - | - |
| `onboarding.document_collection` | onboarding | Onboarding document collection & chase | PARTIAL | execute_with_validation | standard | - | - |
| `onboarding.access_provisioning` | onboarding | Account/access provisioning | MISSING | prepare_draft | standard | - | identity_provider:not_integrated |
| `onboarding.incomplete_handling` | onboarding | Detect & escalate incomplete onboarding | PARTIAL | execute_autonomous | standard | - | - |
| `org.manage_org_structure` | org | Model teams/departments/positions & org chart | PARTIAL | prepare_draft | standard | - | - |
| `org.workforce_planning` | org | Workforce planning, headcount & future needs | MISSING | suggest | standard | - | - |
| `org.position_budget` | org | Position budgeting & approval | MISSING | prepare_draft | standard | - | - |
| `org.succession_planning` | org | Succession planning for key roles | MISSING | suggest | standard | - | - |
| `payroll.collect_variables` | payroll | Collect payroll variables (hours, premiums, bonuses) | IMPLEMENTED_UNVERIFIED | prepare_draft | standard | - | - |
| `payroll.absence_recap` | payroll | Absence recap for a payroll period | IMPLEMENTED_UNVERIFIED | prepare_draft | standard | - | - |
| `payroll.anomaly_detection` | payroll | Payroll data anomaly detection | CONTRACT_ONLY | execute_autonomous | standard | - | - |
| `payroll.validation` | payroll | Payroll variables validation before transmission | MISSING | execute_with_validation | standard | - | - |
| `payroll.payslip_distribution` | payroll | Secure payslip distribution | PARTIAL | execute_with_validation | standard | - | - |
| `payroll.provider_reconciliation` | payroll | Reconcile provider return | MISSING | execute_with_validation | standard | - | payroll_provider:not_integrated |
| `payroll.calendar` | payroll | Payroll calendar & cutoffs | MISSING | execute_autonomous | standard | - | - |
| `payroll.correction` | payroll | Payroll correction / rappel | MISSING | execute_with_validation | standard | - | - |
| `performance.objectives` | performance | Create & track objectives (OKRs/goals) | MISSING | prepare_draft | standard | - | - |
| `performance.annual_review` | performance | Annual/professional interview workflow | MISSING | prepare_draft | standard | - | - |
| `performance.feedback_360` | performance | 360 feedback & peer review | MISSING | prepare_draft | standard | - | - |
| `performance.one_to_one` | performance | One-to-ones & performance notes | MISSING | prepare_draft | standard | - | - |
| `performance.calibration` | performance | Calibration & promotion committee support | MISSING | suggest | standard | - | - |
| `performance.pip` | performance | Performance improvement plan (PIP) | MISSING | prepare_draft | high | - | - |
| `performance.recognition` | performance | Recognition & documentation | MISSING | prepare_draft | standard | - | - |
| `pierre_admin.country_config` | pierre_admin | Country configuration (jurisdiction resolution + packs) | PARTIAL | execute_with_validation | high | - | - |
| `policy.define` | policy | Define an internal HR policy | CONTRACT_ONLY | prepare_draft | standard | - | - |
| `policy.version_publish` | policy | Version & publish policy updates | MISSING | execute_with_validation | standard | - | - |
| `policy.acceptance` | policy | Require & record policy acceptance (NDA, code of conduct) | MISSING | execute_with_validation | standard | - | - |
| `policy.impact_diffusion` | policy | Policy impact analysis & diffusion + proof | MISSING | prepare_draft | standard | - | - |
| `policy.enforcement_audit` | policy | Audit policy application & exceptions | MISSING | execute_autonomous | standard | - | - |
| `proactive.contract_expiry` | proactive | Detect contract expiry & prompt | CONTRACT_ONLY | execute_autonomous | standard | - | - |
| `proactive.missing_document` | proactive | Missing-document detection & chase | PARTIAL | execute_autonomous | standard | - | - |
| `proactive.expiring_training` | proactive | Expiring training/certification detection | MISSING | execute_autonomous | standard | - | - |
| `proactive.blocked_signature` | proactive | Blocked-signature detection | PARTIAL | execute_autonomous | standard | - | - |
| `proactive.payroll_anomaly` | proactive | Payroll anomaly / untreated absence detection | CONTRACT_ONLY | execute_autonomous | standard | - | - |
| `proactive.sla_breach` | proactive | SLA breach & provider-chase detection | PARTIAL | execute_autonomous | standard | - | - |
| `recruitment.classify_intent` | recruitment | Detect recruitment intent from request | IMPLEMENTED_UNVERIFIED | execute_autonomous | standard | - | - |
| `recruitment.job_requisition` | recruitment | Open a job requisition (need, job description, budget approval) | MISSING | prepare_draft | standard | - | - |
| `recruitment.posting` | recruitment | Publish/post an opening | MISSING | prepare_draft | standard | - | - |
| `recruitment.sourcing` | recruitment | Sourcing & candidate intake | MISSING | suggest | standard | - | - |
| `recruitment.pipeline` | recruitment | Candidate pipeline & talent pool management | MISSING | prepare_draft | standard | - | - |
| `recruitment.interview_scheduling` | recruitment | Interview scheduling & evaluation capture | PARTIAL | prepare_draft | standard | - | - |
| `recruitment.reference_checks` | recruitment | Reference checks | MISSING | prepare_draft | standard | - | - |
| `recruitment.screening_decision` | recruitment | Screening/hiring decision (accept/reject) | PARTIAL | execute_with_validation | high | - | - |
| `recruitment.candidate_rejection` | recruitment | Formal candidate rejection notification | IMPLEMENTED_UNVERIFIED | prepare_draft | high | - | - |
| `relations.hr_requests` | relations | HR questions/requests ticketing | MISSING | execute_with_validation | standard | - | - |
| `relations.complaints` | relations | Log & resolve complaints/conflicts | MISSING | prepare_draft | high | - | - |
| `relations.mediation` | relations | Mediation & escalation tracking | MISSING | observe_only | standard | - | - |
| `relations.harassment_alert` | relations | Harassment/discrimination alert intake (governed, confidential) | MISSING | observe_only | high | - | - |
| `reporting.headcount_turnover` | reporting | Headcount & turnover reporting | PARTIAL | execute_autonomous | standard | - | - |
| `reporting.absenteeism` | reporting | Absenteeism reporting | MISSING | execute_autonomous | standard | - | - |
| `reporting.recruitment_funnel` | reporting | Recruitment/onboarding funnel reporting | MISSING | execute_autonomous | standard | - | - |
| `reporting.completeness_deadlines` | reporting | Completeness & deadline dashboards | PARTIAL | execute_autonomous | standard | - | - |
| `reporting.executive_report` | reporting | Executive/HR periodic reports + recommended actions | MISSING | prepare_draft | standard | - | - |
| `reporting.anomaly_surfacing` | reporting | Surface anomalies & risks | PARTIAL | execute_autonomous | standard | - | - |
| `training.skills_mapping` | training | Map required vs held skills / gap | MISSING | prepare_draft | standard | - | - |
| `training.plan` | training | Create & track training plans | IMPLEMENTED_UNVERIFIED | prepare_draft | standard | - | - |
| `training.enrollment` | training | Enroll employees & manage convocations | MISSING | execute_with_validation | standard | - | - |
| `training.certification_tracking` | training | Track certification validity & expiry | MISSING | execute_autonomous | standard | - | - |
| `training.evaluation` | training | Post-training evaluation | MISSING | prepare_draft | standard | - | - |

## P8.12 — source & review country legal rules (32)

| ID | Domain | Label | Status | Autonomy | Legal | Country rule families | Integrations |
|---|---|---|---|---|---|---|---|
| `absence.balance_calculation` | absence | Leave balance calculation & accrual | MISSING | execute_autonomous | standard | paid_leave | - |
| `absence.sick_leave` | absence | Sick leave & medical certificate handling | PARTIAL | prepare_draft | standard | sick_leave | - |
| `absence.parental_leave` | absence | Maternity/paternity/parental leave | MISSING | prepare_draft | high | parental_leave | - |
| `absence.return_to_work` | absence | Return-to-work & accommodation | MISSING | prepare_draft | high | occupational_health | - |
| `absence.time_tracking` | absence | Working time / hours / schedules / on-call | PARTIAL | prepare_draft | standard | working_time | - |
| `contract.renewal` | contract | Contract renewal | PARTIAL | prepare_draft | high | fixed_term_rules | - |
| `contract.hours_change` | contract | Working-hours change (via amendment) | PARTIAL | prepare_draft | high | working_time | - |
| `contract.end_probation` | contract | End of probation decision | PARTIAL | execute_with_validation | high | probation_periods | - |
| `data_gdpr.retention` | data_gdpr | Enforce statutory retention & scheduled deletion | PARTIAL | execute_with_validation | high | document_retention | - |
| `data_gdpr.legal_basis` | data_gdpr | Maintain legal basis & data minimization | LEGAL_CONTENT_REQUIRED | prepare_draft | high | data_protection | - |
| `data_gdpr.consent_proof` | data_gdpr | Maintain consent proof for communications | MISSING | execute_autonomous | high | data_protection | - |
| `disciplinary.summons` | disciplinary | Summon employee for disciplinary interview | MISSING | prepare_draft | high | disciplinary_procedure | - |
| `disciplinary.deadlines` | disciplinary | Enforce statutory disciplinary deadlines | MISSING | execute_autonomous | high | disciplinary_procedure | - |
| `health.medical_visits` | health | Manage mandatory occupational-health visits | MISSING | prepare_draft | high | occupational_health | - |
| `health.mandatory_safety_training` | health | Track mandatory H&S training completion | MISSING | execute_autonomous | high | mandatory_trainings | - |
| `offboarding.resignation` | offboarding | Process resignation | MISSING | prepare_draft | high | notice_periods | - |
| `offboarding.mutual_termination` | offboarding | Mutual termination (or local equivalent) | MISSING | prepare_draft | high | severance | - |
| `offboarding.end_of_contract` | offboarding | End of fixed-term contract | PARTIAL | prepare_draft | standard | fixed_term_rules | - |
| `offboarding.final_pay` | offboarding | Prepare final pay & documents (STC) | MISSING | prepare_draft | high | payroll_contributions | - |
| `offboarding.file_closure_archival` | offboarding | Close & archive employee file (retention) | PARTIAL | execute_with_validation | standard | document_retention | - |
| `offer.generate_offer_document` | offer | Generate job-offer document (promesse d'embauche) | CONTRACT_ONLY | prepare_draft | high | contract_types | - |
| `offer.right_to_work` | offer | Right-to-work / work-authorization verification | MISSING | prepare_draft | high | right_to_work | - |
| `onboarding.probation_tracking` | onboarding | Probation checkpoints & end-of-probation prompt | PARTIAL | execute_autonomous | standard | probation_periods | - |
| `org.restructuring_prepare` | org | Prepare restructuring scenarios (analysis only) | MISSING | observe_only | high | employee_representation | - |
| `payroll.export_transmission` | payroll | Export & transmit to payroll provider | EXTERNAL_DEPENDENCY | execute_with_validation | high | payroll_contributions | payroll_provider:not_integrated |
| `payroll.official_calculation` | payroll | Official payroll calculation (certified engine) | EXTERNAL_DEPENDENCY | observe_only | high | payroll_contributions | payroll_provider:not_integrated |
| `payroll.dsn_declaration` | payroll | Social declaration submission (e.g. DSN/ONSS/CCSS) | EXTERNAL_DEPENDENCY | observe_only | high | payroll_contributions | payroll_provider:not_integrated |
| `payroll.payslip_generation` | payroll | Payslip generation | EXTERNAL_DEPENDENCY | observe_only | high | payslip_requirements | payroll_provider:not_integrated |
| `proactive.end_of_probation` | proactive | End-of-probation monitoring | CONTRACT_ONLY | execute_autonomous | standard | probation_periods | - |
| `proactive.retention_deletion` | proactive | Retention obligation & scheduled deletion detection | PARTIAL | execute_with_validation | high | document_retention | - |
| `recruitment.candidate_data_compliance` | recruitment | Candidate data GDPR/consent & retention | MISSING | prepare_draft | high | data_protection | - |
| `training.mandatory_compliance` | training | Enforce mandatory training compliance & proof | MISSING | execute_autonomous | high | mandatory_trainings | - |

## HUMAN_ONLY — governed, never automated (4)

| ID | Domain | Label | Status | Autonomy | Legal | Country rule families | Integrations |
|---|---|---|---|---|---|---|---|
| `disciplinary.qualify` | disciplinary | Analyze facts & qualify violation | HUMAN_ONLY | human_only | high | disciplinary_procedure | - |
| `disciplinary.decision` | disciplinary | Issue disciplinary decision/warning/sanction | HUMAN_ONLY | human_only | high | disciplinary_procedure | - |
| `offboarding.dismissal` | offboarding | Dismissal procedure (governed, human+legal) | HUMAN_ONLY | human_only | high | dismissal_procedure, notice_periods, severance | - |
| `relations.whistleblower` | relations | Whistleblower protection & confidentiality | HUMAN_ONLY | human_only | high | data_protection | - |

