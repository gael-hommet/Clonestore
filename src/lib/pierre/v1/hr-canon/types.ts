// src/lib/pierre/v1/hr-canon/types.ts
// PHASE 8.10 — Complete HR Capability Canon: the strict, machine-readable type system that
// defines EVERYTHING Pierre must know / decide / prepare / execute / monitor / prove in HR.
// This file is pure types + literal unions (no runtime, no side effects). It is the single
// contract that capability-registry.ts, country-packs/, the validators, the coverage engine
// and the P8.11/P8.12 build plans all conform to. No capability may claim "Pierre can do X"
// without a full HrCapabilityDefinition here.

// ── Domains (A–V of the taxonomy) ────────────────────────────────────────────
export type HrDomainId =
  | "org"            // A. Organisation & planning
  | "recruitment"    // B. Recruitment
  | "offer"          // C. Offer & pre-hire
  | "contract"       // D. Contracts & contractual changes
  | "onboarding"     // E. Onboarding
  | "employee360"    // F. Employee 360 & administration
  | "absence"        // G. Absences, leave & time
  | "payroll"        // H. Payroll operational
  | "compensation"   // I. Compensation & benefits
  | "performance"    // J. Performance
  | "training"       // K. Training & skills
  | "career"         // L. Career & mobility
  | "relations"      // M. Employee relations
  | "disciplinary"   // N. Disciplinary
  | "health"         // O. Health, safety & wellbeing
  | "communications" // P. HR communications
  | "policy"         // Q. Policies & internal compliance
  | "offboarding"    // R. Offboarding
  | "data_gdpr"      // S. Data, privacy & GDPR
  | "reporting"      // T. Reporting & steering
  | "proactive"      // U. Proactive operations
  | "pierre_admin";  // V. Pierre administration

// ── HR lifecycle stages (the full employee lifecycle) ────────────────────────
export type HrLifecycleStage =
  | "pre_hire" | "recruitment" | "hiring" | "contract" | "onboarding"
  | "daily_admin" | "absence_time" | "payroll" | "compensation" | "performance"
  | "training" | "career" | "relations" | "disciplinary" | "health_safety"
  | "communications" | "policy" | "compliance" | "mobility" | "offboarding"
  | "archival" | "reporting" | "proactive";

// ── How a capability is triggered ────────────────────────────────────────────
export type HrTriggerMode =
  | "employee_request" | "manager_request" | "hr_request" | "candidate_request"
  | "scheduled" | "event_driven" | "proactive_detection" | "external_webhook" | "system";

// ── Actors that can invoke / be involved ─────────────────────────────────────
export type HrActorRole =
  | "employee" | "manager" | "hr_operator" | "hr_manager" | "admin" | "owner"
  | "payroll_operator" | "candidate" | "external_recipient" | "system" | "pierre_autonomous";

// ── The subject a capability acts on ─────────────────────────────────────────
export type HrSubjectType =
  | "company" | "site" | "team" | "position" | "employee" | "candidate"
  | "contract" | "document" | "mission" | "task" | "delivery" | "policy"
  | "payroll_run" | "training_record" | "absence_request" | "none";

// ── Inputs ───────────────────────────────────────────────────────────────────
export type HrInputRequirement = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean" | "enum" | "money" | "reference" | "file" | "json";
  sensitivity?: "normal" | "sensitive" | "restricted";
  reference?: HrSubjectType; // when type=reference
  notes?: string;
};

// When required information is missing, what Pierre must do (never guess legal/critical data).
export type HrMissingInformationPolicy =
  | "ask_and_block"          // pause and request the info; do not proceed
  | "ask_and_draft_partial"  // prepare a partial draft, flag the gap
  | "block_fail_closed"      // hard stop (critical/legal input missing)
  | "proceed_with_default";  // only for non-critical, explicitly-safe defaults

// ── Workflow contract ────────────────────────────────────────────────────────
export type HrWorkflowStepKind =
  | "collect" | "validate" | "decide" | "prepare_document" | "request_signature"
  | "mutate_record" | "communicate" | "schedule" | "export" | "reconcile"
  | "await_human" | "await_external" | "archive" | "close";

export type HrWorkflowStep = {
  key: string;
  kind: HrWorkflowStepKind;
  label: string;
  autonomy: HrAutonomyLevel;
  optional?: boolean;
};
export type HrWorkflowContract = {
  entryConditions: string[];
  steps: HrWorkflowStep[];
  terminalStates: string[];
  reversible: boolean;
};

export type HrExpectedTask = { type: string; label: string; blocking?: boolean };
export type HrExpectedArtifact = {
  kind: "contract" | "letter" | "certificate" | "report" | "payslip" | "export" | "policy_doc" | "attestation" | "form" | "other";
  format?: "pdf" | "docx" | "csv" | "json" | "none";
  label: string;
  retention?: "hot_90d" | "legal_audit" | "country_defined" | "none";
};
export type HrExpectedCommunication = {
  channel: "in_app" | "email";
  audience: HrActorRole;
  templateFamily: string;
  proofOfSend: boolean;
};
export type HrEmployeeMutation = {
  target: "employee" | "contract" | "absence" | "compensation" | "document" | "onboarding" | "policy_acceptance" | "access" | "none";
  operation: "create" | "update" | "status_change" | "archive" | "delete" | "anonymize";
  field?: string;
  reversible: boolean;
};

// ── Governance ───────────────────────────────────────────────────────────────
export type HrApprovalPolicy = {
  when: "always" | "above_threshold" | "if_legal_sensitive" | "if_irreversible" | "never";
  approver: HrActorRole;
  reason: string;
};
export type HrPermissionRequirement = { permission: string; scope: "company" | "site" | "self" | "team" };

export type HrRiskClassification = {
  level: "low" | "medium" | "high" | "critical";
  reversibility: "reversible" | "partially_reversible" | "irreversible";
  legalSensitivity: "none" | "standard" | "high";
  dataSensitivity: "normal" | "sensitive" | "restricted";
  reasons: string[];
};

// Autonomy ladder — how much Pierre may do without a human.
export type HrAutonomyLevel =
  | "observe_only"            // detect/report only
  | "suggest"                 // propose an action
  | "prepare_draft"           // prepare a draft/document, human sends/decides
  | "execute_with_validation" // execute after a required human validation
  | "execute_autonomous"      // execute end-to-end within governed limits
  | "human_only"              // a human must perform it; Pierre assists only
  | "forbidden";              // must never be automated

// ── Proactivity & deadlines ──────────────────────────────────────────────────
export type HrProactiveSignal = {
  key: string;
  label: string;
  detection: "date_threshold" | "state_gap" | "missing_document" | "expiry" | "sla_breach" | "anomaly";
  leadTime?: string; // e.g. "P30D"
};
export type HrDeadlineRule = {
  key: string;
  label: string;
  basis: "statutory" | "contractual" | "policy" | "operational";
  countryDependent: boolean;
};

// ── External & country dependencies ──────────────────────────────────────────
export type HrIntegrationDependency = {
  system: "signature_provider" | "payroll_provider" | "email_provider" | "identity_provider" | "background_check" | "benefits_provider" | "banking" | "time_attendance" | "ats" | "training_provider" | "none";
  status: "available" | "sandbox_only" | "blocked" | "not_integrated";
  notes?: string;
};
export type HrCountryRuleDependency = {
  ruleFamily: string; // must match a country-pack rule family key
  required: boolean;
  notes?: string;
};

// ── Reliability ──────────────────────────────────────────────────────────────
export type HrAuditExpectation = { event: string; immutable: boolean };
export type HrRecoveryPolicy = {
  onWorkerCrash: "lease_recover_reclaim" | "manual" | "not_applicable";
  onProviderFailure: "retry_backoff_deadletter" | "manual" | "not_applicable";
};
export type HrIdempotencyPolicy = { key: string; dedup: "unique_constraint" | "idempotency_key" | "state_machine_guard" | "none" };

// ── Implementation status (the 9 audit levels) ───────────────────────────────
export type HrImplementationStatus =
  | "VERIFIED_EXISTING"       // real test / route+mutation / state-machine / prior P8 proof
  | "IMPLEMENTED_UNVERIFIED"  // code exists, not proven by a test/route in this canon
  | "PARTIAL"                 // some of the flow exists
  | "CONTRACT_ONLY"           // only a type/interface exists
  | "MISSING"                 // absent
  | "EXTERNAL_DEPENDENCY"     // blocked on a real external provider
  | "LEGAL_CONTENT_REQUIRED"  // needs verified country legal rules
  | "HUMAN_ONLY"              // must be performed by a human
  | "OUT_OF_SCOPE"            // deliberately not Pierre's job
  // ── P8.14 evidence-linked closure statuses (governed implementation, not a rubber-stamp) ──
  | "IMPLEMENTED_GOVERNED"          // realized by a mission pack that compiles + persists + is worker-executable
  | "IMPLEMENTED_EXTERNAL_GOVERNED" // internal workflow complete; external provider not live → governed manual path + persisted blocker
  | "IMPLEMENTED_LEGAL_BLOCKED";    // internal workflow complete; final legal execution fails closed pending lawyer-verified country rules

export type HrImplementationReference = {
  kind: "module" | "route" | "migration" | "function" | "registry" | "doc";
  path: string;
  symbol?: string;
  note?: string;
};
export type HrEvidenceReference = {
  kind: "unit_test" | "integration_test" | "route" | "state_machine" | "migration_table" | "p8_proof" | "manual_note";
  ref: string;   // test name / file path / proof dir / table name
  proves: string;
};
export type HrCertificationCriterion = {
  id: string;
  statement: string;    // what must be true to declare this capability DONE
  verifiedBy: "unit_test" | "integration_test" | "e2e" | "legal_review" | "provider_integration" | "human_signoff";
  met: boolean;
};

export type HrTargetPhase = "P8.11" | "P8.12" | "ALREADY_VERIFIED" | "HUMAN_ONLY";

// ── The canonical capability definition ──────────────────────────────────────
export type HrCapabilityDefinition = {
  id: string;         // stable canonical id, e.g. "contract.create"
  version: number;
  domain: HrDomainId;
  operation: string;  // verb-noun, e.g. "create_employment_contract"
  label: string;
  description: string;

  lifecycleStages: HrLifecycleStage[];
  triggerModes: HrTriggerMode[];

  supportedActors: HrActorRole[];
  subjectTypes: HrSubjectType[];

  requiredInputs: HrInputRequirement[];
  optionalInputs: HrInputRequirement[];
  missingInformationPolicy: HrMissingInformationPolicy;

  workflow: HrWorkflowContract;
  expectedTasks: HrExpectedTask[];
  expectedArtifacts: HrExpectedArtifact[];
  expectedCommunications: HrExpectedCommunication[];
  employeeMutations: HrEmployeeMutation[];

  approvals: HrApprovalPolicy[];
  permissions: HrPermissionRequirement[];
  risk: HrRiskClassification;
  autonomy: HrAutonomyLevel;

  proactiveSignals: HrProactiveSignal[];
  deadlines: HrDeadlineRule[];

  integrationDependencies: HrIntegrationDependency[];
  countryRuleDependencies: HrCountryRuleDependency[];

  auditEvents: HrAuditExpectation[];
  recoveryPolicy: HrRecoveryPolicy;
  idempotencyPolicy: HrIdempotencyPolicy;

  implementation: HrImplementationStatus;
  implementationReferences: HrImplementationReference[];
  evidence: HrEvidenceReference[];

  certificationCriteria: HrCertificationCriterion[];
  targetPhase: HrTargetPhase;
};

// Helper: a partial used by the registry authoring layer, completed by defaults().
export type HrCapabilitySeed = Partial<HrCapabilityDefinition> &
  Pick<HrCapabilityDefinition, "id" | "domain" | "operation" | "label" | "implementation">;
