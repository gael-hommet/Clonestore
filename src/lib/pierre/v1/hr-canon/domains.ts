// src/lib/pierre/v1/hr-canon/domains.ts
// PHASE 8.10 — the 22 canonical HR domains (A–V). Each domain is an area of the HR lifecycle
// that Pierre must cover. Capabilities in capability-registry.ts must reference one of these
// domain ids. Ordered A→V to match the taxonomy.

import type { HrDomainId, HrLifecycleStage } from "./types";

export type HrDomain = {
  id: HrDomainId;
  letter: string;
  name: string;
  description: string;
  lifecycleStages: HrLifecycleStage[];
};

export const HR_DOMAINS: readonly HrDomain[] = [
  { id: "org", letter: "A", name: "Organisation & planning", description: "Company structure, sites, teams, positions, roles, org chart, headcount, workforce planning, succession, restructuring.", lifecycleStages: ["pre_hire", "reporting"] },
  { id: "recruitment", letter: "B", name: "Recruitment", description: "Requisition, need definition, job description, budget approval, posting, sourcing, candidates, pipeline, screening, interviews, evaluations, references, decision, rejection, talent pool, candidate-data compliance.", lifecycleStages: ["pre_hire", "recruitment"] },
  { id: "offer", letter: "C", name: "Offer & pre-hire", description: "Offer, negotiation, compensation, required documents, right-to-work checks, hire preparation, signature collection, candidate→employee conversion.", lifecycleStages: ["recruitment", "hiring"] },
  { id: "contract", letter: "D", name: "Contracts & contractual changes", description: "Create, revise, approve, sign, renew; amendments; role/salary/hours/site changes; mobility; suspension; end-of-probation; expiration; archival; versioning.", lifecycleStages: ["contract", "mobility"] },
  { id: "onboarding", letter: "E", name: "Onboarding", description: "Preboarding, document collection, account/access, equipment, introduction, schedule, manager, buddy, initial trainings, policies, probation, checkpoints, incomplete-onboarding handling, closure.", lifecycleStages: ["onboarding"] },
  { id: "employee360", letter: "F", name: "Employee 360 & administration", description: "Identity, contact, professional data, status, contract, history, documents, compensation, benefits, skills, trainings, absences, performance, relations, sensitive data, completeness, corrections, imports, exports.", lifecycleStages: ["daily_admin"] },
  { id: "absence", letter: "G", name: "Absences, leave & time", description: "Request, approval, balance, planning, conflicts, legal leave, sickness, accident, parental, unjustified absence, return, accommodation, part-time, hours, schedules, on-call, remote, time-clock, payroll transmission.", lifecycleStages: ["absence_time"] },
  { id: "payroll", letter: "H", name: "Payroll operational", description: "Variable collection, hours, absences, bonuses, commissions, benefits, reimbursements, contractual changes, checks, anomalies, chases, validation, export, transmission, provider return, reconciliation, correction, payslips, secure distribution, archival, payroll calendar. (Pierre prepares/governs; a certified engine computes.)", lifecycleStages: ["payroll"] },
  { id: "compensation", letter: "I", name: "Compensation & benefits", description: "Grid, salary, raise, bonus, variable, equity, benefits, mutuelle, prévoyance, vouchers, mobility, expenses, salary review, equity/equality, budget, communication.", lifecycleStages: ["compensation"] },
  { id: "performance", letter: "J", name: "Performance", description: "Objectives, reviews, annual/professional interviews, feedback, one-to-ones, improvement plans, calibration, promotion, recognition, documentation, tracking.", lifecycleStages: ["performance"] },
  { id: "training", letter: "K", name: "Training & skills", description: "Skill mapping, required/held skills, gap, plan, requests, budget, enrollment, convocations, tracking, certification, expiry, mandatory training, proof, evaluation.", lifecycleStages: ["training"] },
  { id: "career", letter: "L", name: "Career & mobility", description: "Wishes, evolution, promotion, internal/geographic mobility, succession, mentoring, retention, potential, role transition.", lifecycleStages: ["career", "mobility"] },
  { id: "relations", letter: "M", name: "Employee relations", description: "HR questions, requests, complaints, conflicts, mediation, alerts, harassment, discrimination, whistleblower protection, tracking, confidentiality, corrective measures.", lifecycleStages: ["relations"] },
  { id: "disciplinary", letter: "N", name: "Disciplinary", description: "Report, facts, collection, evidence retention, analysis, qualification, summons, interview, decision, warning, sanction, appeal, deadlines, closure. Governed; requires human + legal validation.", lifecycleStages: ["disciplinary"] },
  { id: "health", letter: "O", name: "Health, safety & wellbeing", description: "Medical obligations, incidents, accidents, risks, accommodations, prevention, tracking, mental health, workload, safety, clearances, mandatory trainings, access restrictions. Pierre never acts as a physician.", lifecycleStages: ["health_safety"] },
  { id: "communications", letter: "P", name: "HR communications", description: "Individual/collective/manager/candidate/employee communications across onboarding, absence, payroll, performance, training, policy, incident, departure; reminders, chases, read-receipts, proof-of-send.", lifecycleStages: ["communications"] },
  { id: "policy", letter: "Q", name: "Policies & internal compliance", description: "Create, version, validate, publish, acceptance, update, impact, diffusion, proof, exceptions, enforcement.", lifecycleStages: ["policy", "compliance"] },
  { id: "offboarding", letter: "R", name: "Offboarding", description: "Resignation, dismissal, mutual termination (or local equivalent), end-of-contract, retirement, death, handover, documents, access, equipment, final pay, exit interview, confidentiality, archival, alumni, file closure.", lifecycleStages: ["offboarding", "archival"] },
  { id: "data_gdpr", letter: "S", name: "Data, privacy & GDPR", description: "Legal basis, minimization, access, rectification, export, deletion, anonymization, archival, retention, legal hold, restrictions, access log, sensitive data, candidate/employee rights, proofs.", lifecycleStages: ["compliance", "archival"] },
  { id: "reporting", letter: "T", name: "Reporting & steering", description: "Headcount, turnover, absenteeism, recruitment, onboarding, payroll, performance, training, risks, completeness, deadlines, trends, executive/HR reports, anomalies, recommended actions.", lifecycleStages: ["reporting"] },
  { id: "proactive", letter: "U", name: "Proactive operations", description: "Contract expiry, end-of-probation, interviews to schedule, missing documents, expiring training, mandatory visits, blocked signatures, incomplete onboarding, payroll anomalies, untreated absence, incomplete files, access to close, retention obligations, deletions to run, operational risk, provider chases, SLA breaches.", lifecycleStages: ["proactive"] },
  { id: "pierre_admin", letter: "V", name: "Pierre administration", description: "Autonomy, approvals, company rules, sending identity, templates, channels, permissions, delegations, limits, audit, incidents, recovery, country configuration.", lifecycleStages: ["compliance"] },
] as const;

export const HR_DOMAIN_IDS: readonly HrDomainId[] = HR_DOMAINS.map((d) => d.id);
export function getDomain(id: HrDomainId): HrDomain | undefined { return HR_DOMAINS.find((d) => d.id === id); }
