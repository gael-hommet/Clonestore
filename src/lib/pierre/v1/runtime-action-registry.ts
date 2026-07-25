// src/lib/pierre/v1/runtime-action-registry.ts
// PHASE 8.5 §8 — the CANONICAL, CLOSED runtime action registry. A runtime step NEVER carries a free
// executable instruction: it carries an action drawn from THIS server registry. An action absent from
// the registry is never executed — it blocks the plan and is signalled. There is no generic
// database.query / http.request / run_code / execute_prompt / arbitrary_tool action. A free policy or
// "safe" flag supplied by the client is ignored: the server policy here is authoritative.

export type RuntimeActionCategory =
  | "read" | "prepare" | "approval" | "communication" | "document" | "signature" | "wait" | "schedule" | "state_transition";
export type RuntimeActionRisk = "read_only" | "low" | "controlled" | "sensitive" | "prohibited";
export type RuntimeExecutionMode = "automatic" | "automatic_after_policy" | "human_approval_required" | "manual_only";
export type AmbiguousFailurePolicy = "reconcile" | "manual_review" | "never_retry";
export type CompensationStrategy = "none" | "local_rollback" | "external_reconciliation" | "manual";

export type RuntimeActionDefinition = {
  actionKey: string;
  version: string;
  category: RuntimeActionCategory;
  risk: RuntimeActionRisk;
  executionMode: RuntimeExecutionMode;
  /** lightweight server-side validation of the typed input payload (no free fields). */
  validateInput: (payload: Record<string, unknown>) => string[];
  requiredPermission: string | null;
  requiredObjectTypes: string[];
  idempotencyStrategy: string;
  timeoutSeconds: number;
  maxAttempts: number;
  canRetryAutomatically: boolean;
  ambiguousFailurePolicy: AmbiguousFailurePolicy;
  compensationStrategy: CompensationStrategy;
  /** the runtime_event kinds an action of this category may legitimately wait on. */
  allowedWaitEvents: string[];
};

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-fA-F-]{36}$/.test(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function def(p: Partial<RuntimeActionDefinition> & { actionKey: string; category: RuntimeActionCategory; risk: RuntimeActionRisk }): RuntimeActionDefinition {
  return {
    version: "1",
    executionMode: "automatic",
    validateInput: () => [],
    requiredPermission: null,
    requiredObjectTypes: [],
    idempotencyStrategy: "step_run_id",
    timeoutSeconds: 60,
    maxAttempts: 5,
    canRetryAutomatically: true,
    ambiguousFailurePolicy: "manual_review",
    compensationStrategy: "none",
    allowedWaitEvents: [],
    ...p,
  };
}

// ── the closed registry ─────────────────────────────────────────────────────────────
const REGISTRY: Record<string, RuntimeActionDefinition> = {
  // structural / state
  "mission.noop": def({ actionKey: "mission.noop", category: "read", risk: "read_only", canRetryAutomatically: false }),
  "mission.complete": def({ actionKey: "mission.complete", category: "state_transition", risk: "low", canRetryAutomatically: false }),
  "mission.block": def({ actionKey: "mission.block", category: "state_transition", risk: "low", canRetryAutomatically: false,
    validateInput: (p) => (isStr(p.blocker_code) ? [] : ["blocker_code required"]) }),

  // reads (governed services, read-only)
  "employee.read": def({ actionKey: "employee.read", category: "read", risk: "read_only", requiredPermission: "employee.read", requiredObjectTypes: ["employee"], canRetryAutomatically: false,
    validateInput: (p) => (isUuid(p.employee_id) ? [] : ["employee_id (uuid) required"]) }),
  "contract.read": def({ actionKey: "contract.read", category: "read", risk: "read_only", requiredPermission: "document.read", requiredObjectTypes: ["contract"], canRetryAutomatically: false,
    validateInput: (p) => (isUuid(p.contract_id) ? [] : ["contract_id (uuid) required"]) }),
  "document.read": def({ actionKey: "document.read", category: "read", risk: "read_only", requiredPermission: "document.read", requiredObjectTypes: ["document"], canRetryAutomatically: false,
    validateInput: (p) => (isUuid(p.document_id) ? [] : ["document_id (uuid) required"]) }),

  // durable waits
  "wait.until_time": def({ actionKey: "wait.until_time", category: "wait", risk: "read_only", canRetryAutomatically: false, allowedWaitEvents: ["timer"],
    validateInput: (p) => (isStr(p.wake_at) ? [] : ["wake_at (ISO instant) required"]) }),
  "wait.for_event": def({ actionKey: "wait.for_event", category: "wait", risk: "read_only", canRetryAutomatically: false, allowedWaitEvents: ["external_event"],
    validateInput: (p) => (isStr(p.event_kind) ? [] : ["event_kind required"]) }),

  // human approval (reuses pierre_rt_validations)
  "approval.request": def({ actionKey: "approval.request", category: "approval", risk: "controlled", executionMode: "automatic_after_policy", requiredPermission: "validation.read", canRetryAutomatically: false, allowedWaitEvents: ["approval"],
    validateInput: (p) => (isStr(p.reason) ? [] : ["reason required"]) }),

  // communication — NEVER sends email directly; emits a governed outbox event + the P8.4 pipeline
  "communication.create_intent": def({ actionKey: "communication.create_intent", category: "communication", risk: "controlled", requiredPermission: "document.read", idempotencyStrategy: "source_event_key", ambiguousFailurePolicy: "reconcile", compensationStrategy: "external_reconciliation", allowedWaitEvents: ["external_event"],
    validateInput: (p) => (isStr(p.event_kind) && isUuid(p.object_id) ? [] : ["event_kind + object_id (uuid) required"]) }),

  // follow-up / relance — schedules a durable, bounded follow-up (stop-conditions checked at fire time)
  "follow_up.schedule": def({ actionKey: "follow_up.schedule", category: "schedule", risk: "low", requiredPermission: "document.read",
    validateInput: (p) => (isStr(p.reason) && (isStr(p.due_at) || typeof p.delay_seconds === "number") ? [] : ["reason + (due_at or delay_seconds) required"]) }),

  // signature — NEVER calls the provider directly; calls the P8.3 governed services then waits
  "signature.prepare": def({ actionKey: "signature.prepare", category: "signature", risk: "sensitive", executionMode: "automatic_after_policy", requiredPermission: "document.write", requiredObjectTypes: ["contract"], idempotencyStrategy: "idempotency_key", ambiguousFailurePolicy: "reconcile", compensationStrategy: "external_reconciliation", allowedWaitEvents: ["external_event"],
    validateInput: (p) => (isUuid(p.contract_id) ? [] : ["contract_id (uuid) required"]) }),

  // P8.14 §4 — real domain COMPUTATION over tenant-scoped persisted state (read-only, autonomous-eligible).
  // Computes a whitelisted HR metric and persists the result as an artifact. NEVER fabricates a value; a
  // metric it cannot compute returns a governed blocker. This is the missing analytics/computation surface.
  "analytics.compute": def({ actionKey: "analytics.compute", category: "read", risk: "read_only", requiredPermission: "audit.read", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (typeof p.metric === "string" && ANALYTICS_METRICS.has(p.metric) ? [] : [`metric must be one of: ${[...ANALYTICS_METRICS].join(", ")}`]) }),

  // P22-continuation — the missing DOCUMENT-PRODUCING action. Produces a governed, versioned DRAFT
  // document artifact (via the P8.3 DocumentService), linked to the mission (+ employee when given).
  // risk "controlled" + executionMode "automatic_after_policy": producing a DRAFT is safe and
  // autonomous-eligible; SENDING (communication.create_intent) and SIGNING (signature.prepare) stay
  // separately gated. Never renders a fake "signed"/"sent" — only a draft artifact + its content hash.
  "document.generate": def({ actionKey: "document.generate", category: "document", risk: "controlled", executionMode: "automatic_after_policy",
    requiredPermission: "document.write", idempotencyStrategy: "step_run_id", ambiguousFailurePolicy: "reconcile", compensationStrategy: "local_rollback",
    validateInput: (p) => {
      const errs: string[] = [];
      if (!isStr(p.document_type)) errs.push("document_type required");
      if (!isStr(p.title)) errs.push("title required");
      return errs;
    } }),

  // P22 reprise — two GENERIC, reusable HR primitives that replace the bulk of mission.noop skeleton
  // steps (intake/collect/validate + track/classify/detect/reconcile) with REAL persisted effects.
  // Neither invents data. Both are tenant-scoped and traced (they write to pierre_rt_events).
  //
  // hr.record.append — persists ONE structured, typed HR record/observation (classification, tracking,
  // detection, reconciliation) as a canonical event linked to the mission. Success => a real row exists.
  "hr.record.append": def({ actionKey: "hr.record.append", category: "prepare", risk: "low", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.record_type) ? [] : ["record_type required"]) }),
  // hr.data.collect — collects the declared-required fields from the typed input, persists what is present
  // as a record, and returns a governed NEEDS_INFORMATION blocker when a required field is missing (never
  // a fake success, never invented values). required_fields/provided are optional (empty => nothing missing).
  "hr.data.collect": def({ actionKey: "hr.data.collect", category: "read", risk: "low", idempotencyStrategy: "step_run_id",
    validateInput: () => [] }),

  // P22 semantic continuation — a REAL domain BUSINESS-EFFECT action (not a trace). Creates a real
  // absence row in pierre_rt_employee_absences (via the governed P8.3 absence service), FK-linked to the
  // employee, tenant-scoped, permissioned (absence.write). SUCCESS ⇒ a real business object exists — a
  // trace event is a side effect, never the deliverable. This is the pattern for replacing trace-only
  // domain steps with genuine persistence.
  "absence.record.create": def({ actionKey: "absence.record.create", category: "state_transition", risk: "controlled",
    requiredPermission: "absence.write", requiredObjectTypes: ["employee"], idempotencyStrategy: "step_run_id", compensationStrategy: "local_rollback",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isUuid(p.employee_id)) e.push("employee_id (uuid) required");
      if (!isStr(p.absence_type)) e.push("absence_type required");
      if (!isStr(p.start_date)) e.push("start_date required");
      if (!isStr(p.end_date)) e.push("end_date required");
      return e;
    } }),

  // P22 domain closure — a REAL Employee-360 business object: a typed timeline entry FK-linked to the
  // employee (pierre_rt_employee_events). Reuses the governed appendEmployeeTimelineEvent service. Used
  // for record/capture domain steps (objectives, calibration, career wishes, GDPR objection, appeal).
  "employee.timeline.append": def({ actionKey: "employee.timeline.append", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", requiredObjectTypes: ["employee"], idempotencyStrategy: "step_run_id",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isUuid(p.employee_id)) e.push("employee_id (uuid) required");
      if (!isStr(p.entry_type)) e.push("entry_type required");
      return e;
    } }),

  // P22 domain closure — reconcile an EXTERNAL provider/event return. If the return is present it is
  // applied and recorded as a reconciliation event; if not, it returns a governed awaiting-external
  // outcome (never a fake reconciliation). This is inherently external-dependent (a provider return).
  "hr.reconcile.apply": def({ actionKey: "hr.reconcile.apply", category: "read", risk: "controlled", idempotencyStrategy: "step_run_id",
    ambiguousFailurePolicy: "reconcile", compensationStrategy: "external_reconciliation",
    validateInput: (p) => (isStr(p.reconcile_kind) ? [] : ["reconcile_kind required"]) }),

  // P22 miracle-grade — the 4 previously NEW_TABLE_REQUIRED gaps, now real business objects.
  "workforce.plan.create": def({ actionKey: "workforce.plan.create", category: "state_transition", risk: "controlled",
    requiredPermission: "company.admin", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.period) ? [] : ["period required"]) }),
  "recruitment.candidate.ingest": def({ actionKey: "recruitment.candidate.ingest", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.full_name) ? [] : ["full_name required"]) }),
  // P22 depth — full recruitment workflow (requisition → application → interview → feedback → offer).
  "recruitment.requisition.create": def({ actionKey: "recruitment.requisition.create", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.role_title) ? [] : ["role_title required"]) }),
  "recruitment.application.create": def({ actionKey: "recruitment.application.create", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.candidate_id) ? [] : ["candidate_id (uuid) required"]) }),
  "recruitment.interview.prepare": def({ actionKey: "recruitment.interview.prepare", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.candidate_id) ? [] : ["candidate_id (uuid) required"]) }),
  "recruitment.feedback.record": def({ actionKey: "recruitment.feedback.record", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isUuid(p.interview_id)) e.push("interview_id (uuid) required");
      if (!isUuid(p.candidate_id)) e.push("candidate_id (uuid) required");
      return e;
    } }),
  // Offers are prepared as DRAFT and never auto-sent (human validation gates the send).
  "recruitment.offer.prepare": def({ actionKey: "recruitment.offer.prepare", category: "document", risk: "sensitive", executionMode: "human_approval_required",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isUuid(p.candidate_id)) e.push("candidate_id (uuid) required");
      if (!isStr(p.role_title)) e.push("role_title required");
      return e;
    } }),
  "hr.request.create": def({ actionKey: "hr.request.create", category: "state_transition", risk: "low",
    requiredPermission: "employee.read", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.subject) ? [] : ["subject required"]) }),
  "country.pack.bind": def({ actionKey: "country.pack.bind", category: "state_transition", risk: "controlled",
    requiredPermission: "company.admin", idempotencyStrategy: "step_run_id",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isStr(p.country_code)) e.push("country_code required");
      if (!isStr(p.pack_key)) e.push("pack_key required");
      return e;
    } }),

  // P22 depth — EMPLOYEE onboarding (salaried arrival) real domain actions.
  "employee.onboarding.case.create": def({ actionKey: "employee.onboarding.case.create", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id", validateInput: () => [] }),
  "employee.onboarding.plan.create": def({ actionKey: "employee.onboarding.plan.create", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.case_id) ? [] : ["case_id (uuid) required"]) }),
  "employee.onboarding.requirement.fulfill": def({ actionKey: "employee.onboarding.requirement.fulfill", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isUuid(p.case_id)) e.push("case_id (uuid) required");
      if (!isStr(p.requirement_type)) e.push("requirement_type required");
      return e;
    } }),
  "employee.onboarding.progress.compute": def({ actionKey: "employee.onboarding.progress.compute", category: "read", risk: "read_only",
    requiredPermission: "employee.read", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.case_id) ? [] : ["case_id (uuid) required"]) }),
  "employee.onboarding.step.complete": def({ actionKey: "employee.onboarding.step.complete", category: "state_transition", risk: "controlled",
    requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isUuid(p.case_id)) e.push("case_id (uuid) required");
      if (!isStr(p.step_key)) e.push("step_key required");
      return e;
    } }),

  // P22 depth — PRE-PAYROLL (collect/verify/reconcile/structure/export; NEVER a legal payroll/DSN).
  "payroll.period.open": def({ actionKey: "payroll.period.open", category: "state_transition", risk: "controlled",
    requiredPermission: "payroll_prep.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isStr(p.period_key)) e.push("period_key required");
      if (!isStr(p.starts_on)) e.push("starts_on required");
      if (!isStr(p.ends_on)) e.push("ends_on required");
      return e;
    } }),
  "payroll.population.collect": def({ actionKey: "payroll.population.collect", category: "state_transition", risk: "controlled",
    requiredPermission: "payroll_prep.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.period_id) ? [] : ["period_id (uuid) required"]) }),
  "payroll.variable.create": def({ actionKey: "payroll.variable.create", category: "state_transition", risk: "controlled",
    requiredPermission: "payroll_prep.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isUuid(p.period_id)) e.push("period_id (uuid) required");
      if (!isUuid(p.employee_id)) e.push("employee_id (uuid) required");
      if (!isStr(p.variable_type)) e.push("variable_type required");
      return e;
    } }),
  "payroll.variable.evidence.attach": def({ actionKey: "payroll.variable.evidence.attach", category: "state_transition", risk: "controlled",
    requiredPermission: "payroll_prep.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.variable_id) ? [] : ["variable_id (uuid) required"]) }),
  "payroll.variable.validate": def({ actionKey: "payroll.variable.validate", category: "state_transition", risk: "controlled",
    requiredPermission: "payroll_prep.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.variable_id) ? [] : ["variable_id (uuid) required"]) }),
  "payroll.anomaly.detect": def({ actionKey: "payroll.anomaly.detect", category: "read", risk: "low",
    requiredPermission: "payroll_prep.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.period_id) ? [] : ["period_id (uuid) required"]) }),
  "payroll.readiness.compute": def({ actionKey: "payroll.readiness.compute", category: "read", risk: "read_only",
    requiredPermission: "payroll_prep.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.period_id) ? [] : ["period_id (uuid) required"]) }),
  "payroll.export.generate": def({ actionKey: "payroll.export.generate", category: "document", risk: "controlled",
    requiredPermission: "payroll_prep.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.period_id) ? [] : ["period_id (uuid) required"]) }),
  "payroll.provider_return.reconcile": def({ actionKey: "payroll.provider_return.reconcile", category: "read", risk: "controlled",
    requiredPermission: "payroll_prep.write", idempotencyStrategy: "idempotency_key", ambiguousFailurePolicy: "reconcile",
    validateInput: (p) => {
      const e: string[] = [];
      if (!isUuid(p.period_id)) e.push("period_id (uuid) required");
      if (!isStr(p.provider_event_id)) e.push("provider_event_id required");
      return e;
    } }),
  "payroll.brief.generate": def({ actionKey: "payroll.brief.generate", category: "read", risk: "read_only",
    requiredPermission: "payroll_prep.read", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.period_id) ? [] : ["period_id (uuid) required"]) }),

  // P22 depth — PERFORMANCE (prepares/tracks; never auto-decides a score/promotion/sanction).
  "performance.campaign.create": def({ actionKey: "performance.campaign.create", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isStr(p.campaign_key)) e.push("campaign_key required"); if (!isStr(p.title)) e.push("title required"); return e; } }),
  "performance.campaign.population.build": def({ actionKey: "performance.campaign.population.build", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.campaign_id) ? [] : ["campaign_id (uuid) required"]) }),
  "performance.interview.create": def({ actionKey: "performance.interview.create", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isUuid(p.campaign_id)) e.push("campaign_id (uuid) required"); if (!isUuid(p.participant_id)) e.push("participant_id (uuid) required"); return e; } }),
  "performance.response.record": def({ actionKey: "performance.response.record", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isUuid(p.interview_id)) e.push("interview_id (uuid) required"); if (!isStr(p.question_key)) e.push("question_key required"); return e; } }),
  "performance.summary.generate": def({ actionKey: "performance.summary.generate", category: "document", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.interview_id) ? [] : ["interview_id (uuid) required"]) }),
  "performance.summary.submit_for_validation": def({ actionKey: "performance.summary.submit_for_validation", category: "approval", risk: "controlled", executionMode: "automatic_after_policy", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.interview_id) ? [] : ["interview_id (uuid) required"]) }),
  "performance.summary.apply_validation": def({ actionKey: "performance.summary.apply_validation", category: "approval", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.interview_id) ? [] : ["interview_id (uuid) required"]) }),
  "performance.interview.complete": def({ actionKey: "performance.interview.complete", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.interview_id) ? [] : ["interview_id (uuid) required"]) }),
  "performance.action_plan.create": def({ actionKey: "performance.action_plan.create", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.title) ? [] : ["title required"]) }),
  "performance.action_plan.validate": def({ actionKey: "performance.action_plan.validate", category: "approval", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.plan_id) ? [] : ["plan_id (uuid) required"]) }),
  "performance.action_item.create": def({ actionKey: "performance.action_item.create", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.action) ? [] : ["action required"]) }),
  "performance.objective.create": def({ actionKey: "performance.objective.create", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isUuid(p.employee_id)) e.push("employee_id (uuid) required"); if (!isStr(p.title)) e.push("title required"); return e; } }),
  "performance.overdue.detect": def({ actionKey: "performance.overdue.detect", category: "state_transition", risk: "low", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.as_of) ? [] : ["as_of required"]) }),
  "performance.template.section.add": def({ actionKey: "performance.template.section.add", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isUuid(p.template_id)) e.push("template_id (uuid) required"); if (!isStr(p.section_key)) e.push("section_key required"); if (!isStr(p.title)) e.push("title required"); return e; } }),
  "performance.template.question.add": def({ actionKey: "performance.template.question.add", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isUuid(p.section_id)) e.push("section_id (uuid) required"); if (!isStr(p.question_key)) e.push("question_key required"); if (!isStr(p.label)) e.push("label required"); return e; } }),
  "performance.response.completeness.validate": def({ actionKey: "performance.response.completeness.validate", category: "read", risk: "read_only", requiredPermission: "employee.read", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.interview_id) ? [] : ["interview_id (uuid) required"]) }),
  "performance.report.generate": def({ actionKey: "performance.report.generate", category: "read", risk: "low", requiredPermission: "employee.read", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.campaign_id) ? [] : ["campaign_id (uuid) required"]) }),
  "performance.reminders.send": def({ actionKey: "performance.reminders.send", category: "communication", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.campaign_id) ? [] : ["campaign_id (uuid) required"]) }),

  // P22 depth — TRAINING (no invented obligation; no certification without proof).
  "training.requirement.create": def({ actionKey: "training.requirement.create", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isStr(p.requirement_key)) e.push("requirement_key required"); if (!isStr(p.title)) e.push("title required"); return e; } }),
  "training.session.create": def({ actionKey: "training.session.create", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.title) ? [] : ["title required"]) }),
  "training.enrollment.create": def({ actionKey: "training.enrollment.create", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isUuid(p.session_id)) e.push("session_id (uuid) required"); if (!isUuid(p.employee_id)) e.push("employee_id (uuid) required"); return e; } }),
  "training.attendance.record": def({ actionKey: "training.attendance.record", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.enrollment_id) ? [] : ["enrollment_id (uuid) required"]) }),
  "training.proof.attach": def({ actionKey: "training.proof.attach", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.enrollment_id) ? [] : ["enrollment_id (uuid) required"]) }),
  "training.proof.verify": def({ actionKey: "training.proof.verify", category: "approval", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isUuid(p.proof_id)) e.push("proof_id (uuid) required"); if (!isStr(p.verified_on)) e.push("verified_on required"); return e; } }),
  "training.requirement.validate_source": def({ actionKey: "training.requirement.validate_source", category: "approval", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.requirement_key) ? [] : ["requirement_key required"]) }),
  "training.certification.issue": def({ actionKey: "training.certification.issue", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isUuid(p.employee_id)) e.push("employee_id (uuid) required"); if (!isUuid(p.proof_id)) e.push("proof_id (uuid) required"); if (!isStr(p.certification_key)) e.push("certification_key required"); if (!isStr(p.issued_on)) e.push("issued_on required"); return e; } }),
  "training.expiry.detect": def({ actionKey: "training.expiry.detect", category: "read", risk: "low", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isStr(p.as_of) ? [] : ["as_of required"]) }),
  "training.enrollment.complete": def({ actionKey: "training.enrollment.complete", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.enrollment_id) ? [] : ["enrollment_id (uuid) required"]) }),
  "training.plan.create": def({ actionKey: "training.plan.create", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => { const e: string[] = []; if (!isStr(p.plan_key)) e.push("plan_key required"); if (!isStr(p.title)) e.push("title required"); return e; } }),
  "training.plan.item.add": def({ actionKey: "training.plan.item.add", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.plan_id) ? [] : ["plan_id (uuid) required"]) }),
  "training.plan.complete": def({ actionKey: "training.plan.complete", category: "state_transition", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.plan_id) ? [] : ["plan_id (uuid) required"]) }),
  "training.report.generate": def({ actionKey: "training.report.generate", category: "read", risk: "low", requiredPermission: "employee.read", idempotencyStrategy: "step_run_id",
    validateInput: () => [] }),
  "training.invitations.send": def({ actionKey: "training.invitations.send", category: "communication", risk: "controlled", requiredPermission: "employee.write", idempotencyStrategy: "step_run_id",
    validateInput: (p) => (isUuid(p.session_id) ? [] : ["session_id (uuid) required"]) }),
};

// The whitelisted HR metrics analytics.compute may compute (no free-form computation).
export const ANALYTICS_METRICS: ReadonlySet<string> = new Set([
  "headcount", "turnover", "absenteeism", "recruitment_funnel", "completeness_deadlines", "executive_report",
  "anomaly_surfacing", "payroll_variables", "payroll_absence_recap", "payroll_anomalies", "payroll_validation",
  "workforce_planning", "position_budget", "succession_planning", "pay_equity", "compensation_equity", "performance_calibration",
]);

export function getRuntimeActionDefinition(actionKey: string, version?: string): RuntimeActionDefinition | null {
  const d = REGISTRY[actionKey];
  if (!d) return null;
  if (version && version !== d.version) return null; // an obsolete/unknown version is refused, never guessed
  return d;
}
export function isKnownRuntimeAction(actionKey: string): boolean {
  return !!REGISTRY[actionKey];
}
export function allRuntimeActions(): RuntimeActionDefinition[] {
  return Object.values(REGISTRY);
}
export function validateRuntimeActionInput(actionKey: string, payload: Record<string, unknown>): { ok: boolean; errors: string[] } {
  const d = REGISTRY[actionKey];
  if (!d) return { ok: false, errors: [`unknown action ${actionKey}`] };
  const errors = d.validateInput(payload ?? {});
  return { ok: errors.length === 0, errors };
}
/** Server-authoritative execution policy (the client never declares an action "safe"). */
export function resolveRuntimeExecutionPolicy(actionKey: string): { executionMode: RuntimeExecutionMode; risk: RuntimeActionRisk; requiresApproval: boolean } | null {
  const d = REGISTRY[actionKey];
  if (!d) return null;
  return { executionMode: d.executionMode, risk: d.risk, requiresApproval: d.executionMode === "human_approval_required" || d.risk === "sensitive" };
}
