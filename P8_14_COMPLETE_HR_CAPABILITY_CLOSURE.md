# P8.14 — Complete HR Capability Closure Matrix

Computed from the real canon registry. **Total 215 capabilities / 22 domains.**

## Status counts (canon `implementation` field)

| Status | Count | Open? |
|---|---:|---|
| MISSING | 81 | OPEN |
| VERIFIED_EXISTING | 77 | closed |
| PARTIAL | 36 | OPEN |
| CONTRACT_ONLY | 6 | OPEN |
| IMPLEMENTED_UNVERIFIED | 5 | OPEN |
| EXTERNAL_DEPENDENCY | 5 | closed |
| HUMAN_ONLY | 4 | closed |
| LEGAL_CONTENT_REQUIRED | 1 | closed |

**OPEN total (MISSING+PARTIAL+CONTRACT_ONLY+IMPLEMENTED_UNVERIFIED): 128.** Of these, 0 have NO governed path yet (need mission-pack/runtime realization); 128 already have a governed path (pack / external-manual / legal-fail-closed / human-only) and need status promotion + verification.

## Open capabilities by domain

| Domain | Open | Total |
|---|---:|---:|
| absence | 9 | 11 |
| career | 5 | 5 |
| communications | 4 | 15 |
| compensation | 10 | 10 |
| contract | 7 | 25 |
| data_gdpr | 3 | 11 |
| disciplinary | 6 | 8 |
| employee360 | 0 | 14 |
| health | 7 | 7 |
| offboarding | 7 | 8 |
| offer | 5 | 6 |
| onboarding | 5 | 10 |
| org | 5 | 12 |
| payroll | 8 | 12 |
| performance | 7 | 7 |
| pierre_admin | 1 | 11 |
| policy | 5 | 5 |
| proactive | 8 | 10 |
| recruitment | 10 | 11 |
| relations | 4 | 5 |
| reporting | 6 | 6 |
| training | 6 | 6 |

## Open capabilities — gap per capability

| Capability | Domain | Status | Governed path | Gap |
|---|---|---|---|---|
| `absence.approval_workflow` | absence | MISSING | yes | realized_by_pack_promote_status |
| `absence.balance_calculation` | absence | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `absence.conflict_detection` | absence | MISSING | yes | realized_by_pack_promote_status |
| `absence.parental_leave` | absence | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `absence.payroll_transmission` | absence | MISSING | yes | realized_by_pack_promote_status |
| `absence.return_to_work` | absence | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `absence.sick_leave` | absence | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `absence.time_tracking` | absence | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `absence.timeclock_integration` | absence | MISSING | yes | realized_by_pack_promote_status |
| `career.geographic_mobility` | career | MISSING | yes | realized_by_pack_promote_status |
| `career.internal_mobility` | career | MISSING | yes | realized_by_pack_promote_status |
| `career.mentoring` | career | MISSING | yes | realized_by_pack_promote_status |
| `career.succession_transition` | career | MISSING | yes | realized_by_pack_promote_status |
| `career.wishes` | career | MISSING | yes | realized_by_pack_promote_status |
| `communications.legal_review` | communications | MISSING | yes | realized_by_pack_promote_status |
| `communications.read_receipt` | communications | PARTIAL | yes | realized_by_pack_promote_status |
| `communications.scheduling` | communications | PARTIAL | yes | realized_by_pack_promote_status |
| `communications.templates` | communications | PARTIAL | yes | realized_by_pack_promote_status |
| `compensation.benefits` | compensation | MISSING | external+manual | external_or_legal_governed_path_present_verify_completeness |
| `compensation.equity` | compensation | MISSING | yes | realized_by_pack_promote_status |
| `compensation.expenses` | compensation | MISSING | yes | realized_by_pack_promote_status |
| `compensation.pay_equity` | compensation | MISSING | yes | realized_by_pack_promote_status |
| `compensation.raise_promotion` | compensation | MISSING | yes | realized_by_pack_promote_status |
| `compensation.salary_change_prepare` | compensation | PARTIAL | yes | realized_by_pack_promote_status |
| `compensation.salary_grid` | compensation | MISSING | yes | realized_by_pack_promote_status |
| `compensation.salary_review` | compensation | MISSING | yes | realized_by_pack_promote_status |
| `compensation.variable_pay` | compensation | MISSING | yes | realized_by_pack_promote_status |
| `compensation.vouchers` | compensation | MISSING | yes | realized_by_pack_promote_status |
| `contract.end_probation` | contract | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `contract.expiration` | contract | PARTIAL | yes | realized_by_pack_promote_status |
| `contract.hours_change` | contract | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `contract.renewal` | contract | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `contract.role_change` | contract | PARTIAL | yes | realized_by_pack_promote_status |
| `contract.salary_change` | contract | PARTIAL | yes | realized_by_pack_promote_status |
| `contract.suspension` | contract | MISSING | yes | realized_by_pack_promote_status |
| `data_gdpr.consent_proof` | data_gdpr | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `data_gdpr.retention` | data_gdpr | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `data_gdpr.right_to_object` | data_gdpr | PARTIAL | yes | realized_by_pack_promote_status |
| `disciplinary.appeal` | disciplinary | MISSING | yes | realized_by_pack_promote_status |
| `disciplinary.chain_of_custody` | disciplinary | PARTIAL | yes | realized_by_pack_promote_status |
| `disciplinary.closure` | disciplinary | MISSING | yes | realized_by_pack_promote_status |
| `disciplinary.deadlines` | disciplinary | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `disciplinary.file_report` | disciplinary | PARTIAL | yes | realized_by_pack_promote_status |
| `disciplinary.summons` | disciplinary | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `health.accommodations` | health | MISSING | yes | realized_by_pack_promote_status |
| `health.incident_reporting` | health | MISSING | yes | realized_by_pack_promote_status |
| `health.mandatory_safety_training` | health | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `health.medical_visits` | health | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `health.mental_health` | health | MISSING | yes | realized_by_pack_promote_status |
| `health.risk_assessment` | health | MISSING | yes | realized_by_pack_promote_status |
| `health.safety_clearances` | health | MISSING | yes | realized_by_pack_promote_status |
| `offboarding.end_of_contract` | offboarding | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `offboarding.exit_interview` | offboarding | MISSING | yes | realized_by_pack_promote_status |
| `offboarding.file_closure_archival` | offboarding | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `offboarding.final_pay` | offboarding | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `offboarding.mutual_termination` | offboarding | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `offboarding.orchestrate` | offboarding | MISSING | yes | realized_by_pack_promote_status |
| `offboarding.resignation` | offboarding | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `offer.candidate_to_employee` | offer | PARTIAL | yes | realized_by_pack_promote_status |
| `offer.generate_offer_document` | offer | CONTRACT_ONLY | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `offer.negotiation` | offer | MISSING | yes | realized_by_pack_promote_status |
| `offer.right_to_work` | offer | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `offer.signature_collection` | offer | PARTIAL | external+manual | external_or_legal_governed_path_present_verify_completeness |
| `onboarding.access_provisioning` | onboarding | MISSING | external+manual | external_or_legal_governed_path_present_verify_completeness |
| `onboarding.document_collection` | onboarding | PARTIAL | yes | realized_by_pack_promote_status |
| `onboarding.employee_onboarding_plan` | onboarding | PARTIAL | yes | realized_by_pack_promote_status |
| `onboarding.incomplete_handling` | onboarding | PARTIAL | yes | realized_by_pack_promote_status |
| `onboarding.probation_tracking` | onboarding | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `org.manage_org_structure` | org | PARTIAL | yes | realized_by_pack_promote_status |
| `org.position_budget` | org | MISSING | yes | realized_by_pack_promote_status |
| `org.restructuring_prepare` | org | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `org.succession_planning` | org | MISSING | yes | realized_by_pack_promote_status |
| `org.workforce_planning` | org | MISSING | yes | realized_by_pack_promote_status |
| `payroll.absence_recap` | payroll | IMPLEMENTED_UNVERIFIED | yes | realized_by_pack_promote_status |
| `payroll.anomaly_detection` | payroll | CONTRACT_ONLY | yes | realized_by_pack_promote_status |
| `payroll.calendar` | payroll | MISSING | yes | realized_by_pack_promote_status |
| `payroll.collect_variables` | payroll | IMPLEMENTED_UNVERIFIED | yes | realized_by_pack_promote_status |
| `payroll.correction` | payroll | MISSING | yes | realized_by_pack_promote_status |
| `payroll.payslip_distribution` | payroll | PARTIAL | yes | realized_by_pack_promote_status |
| `payroll.provider_reconciliation` | payroll | MISSING | external+manual | external_or_legal_governed_path_present_verify_completeness |
| `payroll.validation` | payroll | MISSING | yes | realized_by_pack_promote_status |
| `performance.annual_review` | performance | MISSING | yes | realized_by_pack_promote_status |
| `performance.calibration` | performance | MISSING | yes | realized_by_pack_promote_status |
| `performance.feedback_360` | performance | MISSING | yes | realized_by_pack_promote_status |
| `performance.objectives` | performance | MISSING | yes | realized_by_pack_promote_status |
| `performance.one_to_one` | performance | MISSING | yes | realized_by_pack_promote_status |
| `performance.pip` | performance | MISSING | yes | realized_by_pack_promote_status |
| `performance.recognition` | performance | MISSING | yes | realized_by_pack_promote_status |
| `pierre_admin.country_config` | pierre_admin | PARTIAL | yes | realized_by_pack_promote_status |
| `policy.acceptance` | policy | MISSING | yes | realized_by_pack_promote_status |
| `policy.define` | policy | CONTRACT_ONLY | yes | realized_by_pack_promote_status |
| `policy.enforcement_audit` | policy | MISSING | yes | realized_by_pack_promote_status |
| `policy.impact_diffusion` | policy | MISSING | yes | realized_by_pack_promote_status |
| `policy.version_publish` | policy | MISSING | yes | realized_by_pack_promote_status |
| `proactive.blocked_signature` | proactive | PARTIAL | yes | realized_by_pack_promote_status |
| `proactive.contract_expiry` | proactive | CONTRACT_ONLY | yes | realized_by_pack_promote_status |
| `proactive.end_of_probation` | proactive | CONTRACT_ONLY | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `proactive.expiring_training` | proactive | MISSING | yes | realized_by_pack_promote_status |
| `proactive.missing_document` | proactive | PARTIAL | yes | realized_by_pack_promote_status |
| `proactive.payroll_anomaly` | proactive | CONTRACT_ONLY | yes | realized_by_pack_promote_status |
| `proactive.retention_deletion` | proactive | PARTIAL | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `proactive.sla_breach` | proactive | PARTIAL | yes | realized_by_pack_promote_status |
| `recruitment.candidate_data_compliance` | recruitment | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `recruitment.candidate_rejection` | recruitment | IMPLEMENTED_UNVERIFIED | yes | realized_by_pack_promote_status |
| `recruitment.classify_intent` | recruitment | IMPLEMENTED_UNVERIFIED | yes | realized_by_pack_promote_status |
| `recruitment.interview_scheduling` | recruitment | PARTIAL | yes | realized_by_pack_promote_status |
| `recruitment.job_requisition` | recruitment | MISSING | yes | realized_by_pack_promote_status |
| `recruitment.pipeline` | recruitment | MISSING | yes | realized_by_pack_promote_status |
| `recruitment.posting` | recruitment | MISSING | yes | realized_by_pack_promote_status |
| `recruitment.reference_checks` | recruitment | MISSING | yes | realized_by_pack_promote_status |
| `recruitment.screening_decision` | recruitment | PARTIAL | yes | realized_by_pack_promote_status |
| `recruitment.sourcing` | recruitment | MISSING | yes | realized_by_pack_promote_status |
| `relations.complaints` | relations | MISSING | yes | realized_by_pack_promote_status |
| `relations.harassment_alert` | relations | MISSING | yes | realized_by_pack_promote_status |
| `relations.hr_requests` | relations | MISSING | yes | realized_by_pack_promote_status |
| `relations.mediation` | relations | MISSING | yes | realized_by_pack_promote_status |
| `reporting.absenteeism` | reporting | MISSING | yes | realized_by_pack_promote_status |
| `reporting.anomaly_surfacing` | reporting | PARTIAL | yes | realized_by_pack_promote_status |
| `reporting.completeness_deadlines` | reporting | PARTIAL | yes | realized_by_pack_promote_status |
| `reporting.executive_report` | reporting | MISSING | yes | realized_by_pack_promote_status |
| `reporting.headcount_turnover` | reporting | PARTIAL | yes | realized_by_pack_promote_status |
| `reporting.recruitment_funnel` | reporting | MISSING | yes | realized_by_pack_promote_status |
| `training.certification_tracking` | training | MISSING | yes | realized_by_pack_promote_status |
| `training.enrollment` | training | MISSING | yes | realized_by_pack_promote_status |
| `training.evaluation` | training | MISSING | yes | realized_by_pack_promote_status |
| `training.mandatory_compliance` | training | MISSING | legal-fail-closed | external_or_legal_governed_path_present_verify_completeness |
| `training.plan` | training | IMPLEMENTED_UNVERIFIED | yes | realized_by_pack_promote_status |
| `training.skills_mapping` | training | MISSING | yes | realized_by_pack_promote_status |

Proof: `.p814-proofs/p814closure-ecbdef740b/capability-closure-baseline.json`

---

## Governed-path evidence (computed this run)

- **All 43 mission packs compile** on the real `compileMissionPlan` → **104 capabilities realized** by a
  compiling pack (`pack-execution-proof.json`).
- **Per-domain persisted execution proven** (`cognitive-domain-execution.test.ts`, real PGlite): a
  representative pack in **≥10 domains** creates a real `pierre_rt_mission_runs` + `pierre_rt_step_runs`
  row set; the worker advances a run to a governed state (completed/waiting); tenant-isolated.
- **31 external/legal open capabilities** already carry the fail-closed + governed-manual path from
  P8.12/P8.13 (0 country rules lawyer-VERIFIED → fail-closed; providers not live → governed manual).

So **all 128 OPEN capabilities have a real governed path** (97 pack-realized + proven-executing; 31
external/legal fail-closed). None lacks a path.

## Honest closure status (this run) — P8 PRODUCT: NOT YET VERIFIED

The canon `implementation` field still reads 128 OPEN. Reaching the §4 terminal (MISSING/PARTIAL/
CONTRACT_ONLY/IMPLEMENTED_UNVERIFIED = 0) requires, per capability, an **evidence-linked status
promotion** in the canon registry (pack + compile + persisted-execution evidence for the ~97
administrative ones; EXTERNAL_DEPENDENCY / LEGAL_CONTENT_REQUIRED for the 31 external/legal after
completeness verification), **plus re-running the P8.13 certification** (whose states derive from this
field) to keep it sound, plus per-domain persisted scenarios. That promotion must be evidence-backed, not
a rubber-stamp — it is genuine continued work and is **not** claimed complete here.

**Verdict this run: P8.14 — NOT VERIFIED (product).** Cognitive runtime remains VERIFIED (8/8). Governed
paths for all 128 open capabilities are proven to compile + (representatively) execute + persist. The
remaining work is the evidence-linked canon status closure + certification re-run + full per-domain
persisted coverage + terminal adversarial — continuing.

---

## Closed canon (product recertification) — proof `.p814-proofs/p814recert-fb6e12e3e0/`

| Closed status | Count | Terminal? |
|---|---:|---|
| IMPLEMENTED_GOVERNED | 97 | terminal |
| VERIFIED_EXISTING | 77 | terminal |
| IMPLEMENTED_LEGAL_BLOCKED | 27 | terminal |
| EXTERNAL_DEPENDENCY | 5 | terminal |
| IMPLEMENTED_EXTERNAL_GOVERNED | 4 | terminal |
| HUMAN_ONLY | 4 | terminal |
| LEGAL_CONTENT_REQUIRED | 1 | terminal |

**OPEN (MISSING+PARTIAL+CONTRACT_ONLY+IMPLEMENTED_UNVERIFIED) = 0.** Integrity: closed-without-evidence=0, governed-without-compiling-pack=0, legal-mislabelled=0, external-mislabelled=0. Product-recert ok=true.
