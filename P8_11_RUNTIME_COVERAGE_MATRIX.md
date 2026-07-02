# P8.11 — Runtime Coverage Matrix (generated)

> Generated from `src/lib/pierre/v1/hr-mission-packs` + the P8.10 canon by `scripts/p811-generate-runtime-coverage.mjs`. Do not hand-edit.

**43 mission packs** realize **102/102** of the canon's P8.11-targeted gaps (dynamic — the count comes from the canon, not hardcoded). Uncovered: 0.

## Runtime status distribution

| Runtime status | Packs |
|---|---|
| IMPLEMENTED | 17 |
| HUMAN_DECISION_REQUIRED | 13 |
| COUNTRY_RULES_REQUIRED | 4 |
| RUNTIME_READY_EXTERNAL_BLOCKED | 9 |

## Governance rollup

- Packs with approvals: 24
- Packs with a human decision: 13
- Packs with an external handoff: 9
- Distinct approvers: hr_manager, owner, hr_operator, manager, payroll_operator, admin
- External systems awaited: signature_provider, identity_provider, payroll_provider, time_attendance, benefits_provider, training_provider

## Coverage by domain

| Domain | Targeted | Covered |
|---|---|---|
| absence | 4 | 4 |
| career | 5 | 5 |
| communications | 4 | 4 |
| compensation | 10 | 10 |
| contract | 5 | 5 |
| data_gdpr | 1 | 1 |
| disciplinary | 4 | 4 |
| health | 5 | 5 |
| offboarding | 2 | 2 |
| offer | 3 | 3 |
| onboarding | 4 | 4 |
| org | 4 | 4 |
| payroll | 8 | 8 |
| performance | 7 | 7 |
| pierre_admin | 1 | 1 |
| policy | 5 | 5 |
| proactive | 6 | 6 |
| recruitment | 9 | 9 |
| relations | 4 | 4 |
| reporting | 6 | 6 |
| training | 5 | 5 |

## Mission packs

| Pack | Domain | Runtime status | Capabilities | Steps |
|---|---|---|---|---|
| `absence.payroll_transmission` | absence | RUNTIME_READY_EXTERNAL_BLOCKED | 1 | 9 |
| `absence.request_to_decision` | absence | IMPLEMENTED | 4 | 9 |
| `absence.timeclock_integration` | absence | RUNTIME_READY_EXTERNAL_BLOCKED | 1 | 7 |
| `career.mobility` | career | HUMAN_DECISION_REQUIRED | 3 | 8 |
| `career.wishes_and_mentoring` | career | IMPLEMENTED | 2 | 7 |
| `communications.governed_campaign` | communications | IMPLEMENTED | 3 | 9 |
| `communications.legal_review` | communications | HUMAN_DECISION_REQUIRED | 1 | 7 |
| `compensation.benefits_and_expenses` | compensation | RUNTIME_READY_EXTERNAL_BLOCKED | 3 | 9 |
| `compensation.equity_and_equity_review` | compensation | HUMAN_DECISION_REQUIRED | 2 | 7 |
| `compensation.salary_change` | compensation | HUMAN_DECISION_REQUIRED | 5 | 8 |
| `contract.change_via_amendment` | contract | IMPLEMENTED | 2 | 9 |
| `contract.submit_signature` | contract | RUNTIME_READY_EXTERNAL_BLOCKED | 1 | 9 |
| `contract.suspension_and_expiration` | contract | COUNTRY_RULES_REQUIRED | 2 | 9 |
| `data_gdpr.right_to_object` | data_gdpr | COUNTRY_RULES_REQUIRED | 1 | 8 |
| `disciplinary.case_governance` | disciplinary | HUMAN_DECISION_REQUIRED | 4 | 10 |
| `health.accommodations_wellbeing` | health | HUMAN_DECISION_REQUIRED | 2 | 7 |
| `health.incident_and_risk` | health | HUMAN_DECISION_REQUIRED | 3 | 8 |
| `offboarding.orchestrate` | offboarding | RUNTIME_READY_EXTERNAL_BLOCKED | 2 | 10 |
| `offer.candidate_conversion` | offer | IMPLEMENTED | 1 | 7 |
| `offer.negotiation_and_signature` | offer | RUNTIME_READY_EXTERNAL_BLOCKED | 2 | 9 |
| `onboarding.access_provisioning` | onboarding | RUNTIME_READY_EXTERNAL_BLOCKED | 1 | 7 |
| `onboarding.run_plan` | onboarding | IMPLEMENTED | 3 | 9 |
| `org.structure_management` | org | IMPLEMENTED | 1 | 7 |
| `org.succession_planning` | org | HUMAN_DECISION_REQUIRED | 1 | 7 |
| `org.workforce_planning` | org | HUMAN_DECISION_REQUIRED | 2 | 8 |
| `payroll.prepare_period` | payroll | HUMAN_DECISION_REQUIRED | 6 | 9 |
| `payroll.transmit_and_reconcile` | payroll | RUNTIME_READY_EXTERNAL_BLOCKED | 2 | 8 |
| `performance.calibration_and_pip` | performance | HUMAN_DECISION_REQUIRED | 2 | 8 |
| `performance.review_cycle` | performance | IMPLEMENTED | 5 | 9 |
| `pierre_admin.country_config` | pierre_admin | COUNTRY_RULES_REQUIRED | 1 | 8 |
| `policy.enforcement_audit` | policy | IMPLEMENTED | 1 | 6 |
| `policy.lifecycle` | policy | IMPLEMENTED | 4 | 9 |
| `proactive.deadline_watch` | proactive | IMPLEMENTED | 3 | 7 |
| `proactive.operational_watch` | proactive | IMPLEMENTED | 3 | 7 |
| `recruitment.decision` | recruitment | HUMAN_DECISION_REQUIRED | 2 | 8 |
| `recruitment.open_requisition` | recruitment | IMPLEMENTED | 3 | 9 |
| `recruitment.pipeline_management` | recruitment | COUNTRY_RULES_REQUIRED | 4 | 8 |
| `relations.complaints_and_alerts` | relations | HUMAN_DECISION_REQUIRED | 3 | 7 |
| `relations.hr_requests` | relations | IMPLEMENTED | 1 | 7 |
| `reporting.executive_and_anomalies` | reporting | IMPLEMENTED | 2 | 7 |
| `reporting.hr_dashboards` | reporting | IMPLEMENTED | 4 | 7 |
| `training.certification_tracking` | training | IMPLEMENTED | 1 | 7 |
| `training.plan_and_enroll` | training | RUNTIME_READY_EXTERNAL_BLOCKED | 4 | 10 |

## Capability → pack runtime map (P8.11 gaps)

| Capability | Domain | Realized by pack(s) |
|---|---|---|
| `absence.approval_workflow` | absence | absence.request_to_decision |
| `absence.conflict_detection` | absence | absence.request_to_decision |
| `absence.payroll_transmission` | absence | absence.payroll_transmission |
| `absence.timeclock_integration` | absence | absence.timeclock_integration |
| `career.geographic_mobility` | career | career.mobility |
| `career.internal_mobility` | career | career.mobility |
| `career.mentoring` | career | career.wishes_and_mentoring |
| `career.succession_transition` | career | career.mobility |
| `career.wishes` | career | career.wishes_and_mentoring |
| `communications.legal_review` | communications | communications.legal_review |
| `communications.read_receipt` | communications | communications.governed_campaign |
| `communications.scheduling` | communications | communications.governed_campaign |
| `communications.templates` | communications | communications.governed_campaign |
| `compensation.benefits` | compensation | compensation.benefits_and_expenses |
| `compensation.equity` | compensation | compensation.equity_and_equity_review |
| `compensation.expenses` | compensation | compensation.benefits_and_expenses |
| `compensation.pay_equity` | compensation | compensation.equity_and_equity_review |
| `compensation.raise_promotion` | compensation | compensation.salary_change |
| `compensation.salary_change_prepare` | compensation | compensation.salary_change |
| `compensation.salary_grid` | compensation | compensation.salary_change |
| `compensation.salary_review` | compensation | compensation.salary_change |
| `compensation.variable_pay` | compensation | compensation.salary_change |
| `compensation.vouchers` | compensation | compensation.benefits_and_expenses |
| `contract.expiration` | contract | contract.suspension_and_expiration |
| `contract.role_change` | contract | contract.change_via_amendment |
| `contract.salary_change` | contract | contract.change_via_amendment |
| `contract.submit_signature` | contract | contract.submit_signature |
| `contract.suspension` | contract | contract.suspension_and_expiration |
| `data_gdpr.right_to_object` | data_gdpr | data_gdpr.right_to_object |
| `disciplinary.appeal` | disciplinary | disciplinary.case_governance |
| `disciplinary.chain_of_custody` | disciplinary | disciplinary.case_governance |
| `disciplinary.closure` | disciplinary | disciplinary.case_governance |
| `disciplinary.file_report` | disciplinary | disciplinary.case_governance |
| `health.accommodations` | health | health.accommodations_wellbeing |
| `health.incident_reporting` | health | health.incident_and_risk |
| `health.mental_health` | health | health.accommodations_wellbeing |
| `health.risk_assessment` | health | health.incident_and_risk |
| `health.safety_clearances` | health | health.incident_and_risk |
| `offboarding.exit_interview` | offboarding | offboarding.orchestrate |
| `offboarding.orchestrate` | offboarding | offboarding.orchestrate |
| `offer.candidate_to_employee` | offer | offer.candidate_conversion |
| `offer.negotiation` | offer | offer.negotiation_and_signature |
| `offer.signature_collection` | offer | offer.negotiation_and_signature |
| `onboarding.access_provisioning` | onboarding | onboarding.access_provisioning |
| `onboarding.document_collection` | onboarding | onboarding.run_plan |
| `onboarding.employee_onboarding_plan` | onboarding | onboarding.run_plan |
| `onboarding.incomplete_handling` | onboarding | onboarding.run_plan |
| `org.manage_org_structure` | org | org.structure_management |
| `org.position_budget` | org | org.workforce_planning |
| `org.succession_planning` | org | org.succession_planning |
| `org.workforce_planning` | org | org.workforce_planning |
| `payroll.absence_recap` | payroll | payroll.prepare_period |
| `payroll.anomaly_detection` | payroll | payroll.prepare_period |
| `payroll.calendar` | payroll | payroll.prepare_period |
| `payroll.collect_variables` | payroll | payroll.prepare_period |
| `payroll.correction` | payroll | payroll.prepare_period |
| `payroll.payslip_distribution` | payroll | payroll.transmit_and_reconcile |
| `payroll.provider_reconciliation` | payroll | payroll.transmit_and_reconcile |
| `payroll.validation` | payroll | payroll.prepare_period |
| `performance.annual_review` | performance | performance.review_cycle |
| `performance.calibration` | performance | performance.calibration_and_pip |
| `performance.feedback_360` | performance | performance.review_cycle |
| `performance.objectives` | performance | performance.review_cycle |
| `performance.one_to_one` | performance | performance.review_cycle |
| `performance.pip` | performance | performance.calibration_and_pip |
| `performance.recognition` | performance | performance.review_cycle |
| `pierre_admin.country_config` | pierre_admin | pierre_admin.country_config |
| `policy.acceptance` | policy | policy.lifecycle |
| `policy.define` | policy | policy.lifecycle |
| `policy.enforcement_audit` | policy | policy.enforcement_audit |
| `policy.impact_diffusion` | policy | policy.lifecycle |
| `policy.version_publish` | policy | policy.lifecycle |
| `proactive.blocked_signature` | proactive | proactive.operational_watch |
| `proactive.contract_expiry` | proactive | proactive.deadline_watch |
| `proactive.expiring_training` | proactive | proactive.deadline_watch |
| `proactive.missing_document` | proactive | proactive.deadline_watch |
| `proactive.payroll_anomaly` | proactive | proactive.operational_watch |
| `proactive.sla_breach` | proactive | proactive.operational_watch |
| `recruitment.candidate_rejection` | recruitment | recruitment.decision |
| `recruitment.classify_intent` | recruitment | recruitment.open_requisition |
| `recruitment.interview_scheduling` | recruitment | recruitment.pipeline_management |
| `recruitment.job_requisition` | recruitment | recruitment.open_requisition |
| `recruitment.pipeline` | recruitment | recruitment.pipeline_management |
| `recruitment.posting` | recruitment | recruitment.open_requisition |
| `recruitment.reference_checks` | recruitment | recruitment.pipeline_management |
| `recruitment.screening_decision` | recruitment | recruitment.decision |
| `recruitment.sourcing` | recruitment | recruitment.pipeline_management |
| `relations.complaints` | relations | relations.complaints_and_alerts |
| `relations.harassment_alert` | relations | relations.complaints_and_alerts |
| `relations.hr_requests` | relations | relations.hr_requests |
| `relations.mediation` | relations | relations.complaints_and_alerts |
| `reporting.absenteeism` | reporting | reporting.hr_dashboards |
| `reporting.anomaly_surfacing` | reporting | reporting.executive_and_anomalies |
| `reporting.completeness_deadlines` | reporting | reporting.hr_dashboards |
| `reporting.executive_report` | reporting | reporting.executive_and_anomalies |
| `reporting.headcount_turnover` | reporting | reporting.hr_dashboards |
| `reporting.recruitment_funnel` | reporting | reporting.hr_dashboards |
| `training.certification_tracking` | training | training.certification_tracking |
| `training.enrollment` | training | training.plan_and_enroll |
| `training.evaluation` | training | training.plan_and_enroll |
| `training.plan` | training | training.plan_and_enroll |
| `training.skills_mapping` | training | training.plan_and_enroll |
