// src/lib/clonestore/runtime-integration/runtime-mission-promotion-types.ts
// PHASE 4.8 — Runtime Mission Promotion Contract / Draft → Controlled Mission — Types
//
// DESIGN-ONLY / CONTRACT-ONLY. Décrit comment un RuntimeMissionDraft SERAIT promu
// vers une « Controlled Mission » (mission gouvernée, validation humaine, sans
// exécution autonome). Ne promeut RIEN réellement, ne crée AUCUNE mission réelle,
// n'exécute RIEN, n'appelle PAS le moteur Pierre, n'écrit PAS en base.
//
// INVARIANTS ABSOLUS (champs littéralement false) :
//   promotion_applied false · execution_enabled false · mission_executed false
//   autonomous_execution false · pierre_engine_called false · ai_call_performed false
//   db_write_performed false · email_sent false · message_sent false
//   document_generated false · clonevoice_active false
//   public_launch_external_validated false
//   requires_human_validation true · controlled true · read_only true

import type {
  RuntimeMissionDraft,
  RuntimeMissionDraftGuardSnapshot,
  RuntimeMissionDraftTraceSnapshot,
  RuntimeMissionDraftScaleSnapshot,
  RuntimeMissionDraftQueueSnapshot,
  RuntimeMissionDraftCostSnapshot,
  RuntimeMissionDraftIdempotencySnapshot,
  RuntimeMissionDraftRiskLevel,
} from "./runtime-mission-draft-types";

// ── Enums ─────────────────────────────────────────────────────────────────────

export type RuntimeMissionPromotionPhase = "4.8";

export type RuntimeMissionPromotionMode = "design_only" | "contract_only";

export type RuntimeMissionPromotionStatus =
  | "draft_received"
  | "eligibility_pending"
  | "eligible_for_promotion"
  | "requires_human_validation"
  | "promotion_contract_ready"
  | "not_eligible"
  | "blocked";

export type RuntimeMissionPromotionVerdict =
  | "eligible"
  | "requires_human_validation"
  | "not_eligible"
  | "blocked";

export type ControlledMissionStatus =
  | "proposed"
  | "awaiting_validation"
  | "controlled_ready"
  | "blocked";

export type RuntimeMissionPromotionRiskLevel = RuntimeMissionDraftRiskLevel;

export type RuntimeMissionPromotionValidationMode =
  | "human_validation_required"
  | "dual_control_required"
  | "human_review_recommended"
  | "blocked";

export type RuntimeMissionPromotionGateSeverity = "blocking" | "warning" | "info";

export type RuntimeMissionPromotionGateId =
  | "draft_valid"
  | "draft_no_execution_flags"
  | "draft_not_blocked"
  | "employee_route_present"
  | "guard_decision_present"
  | "trace_contract_present"
  | "idempotency_present"
  | "human_validation_defined"
  | "tenant_scope_strict"
  | "no_real_mission_side_effect"
  | "scale_80k_not_proven_ack";

export type RuntimeMissionPromotionGate = {
  id: RuntimeMissionPromotionGateId;
  label: string;
  description: string;
  required: boolean;
  passed: boolean;
  severity: RuntimeMissionPromotionGateSeverity;
  reason?: string;
};

// ── Safety flags (littéralement false sauf controlled / requires_human_validation) ──

export type RuntimeMissionPromotionSafetyFlags = {
  promotion_applied: false;
  execution_enabled: false;
  mission_executed: false;
  autonomous_execution: false;
  pierre_engine_called: false;
  ai_call_performed: false;
  db_write_performed: false;
  email_sent: false;
  message_sent: false;
  document_generated: false;
  clonevoice_active: false;
  public_launch_external_validated: false;
  requires_human_validation: true;
  controlled: true;
  scale_80k_not_proven: true;
};

// ── Plan-only promotion steps (gouvernance, jamais exécutées) ─────────────────

export type RuntimeMissionPromotionPlanStepKind =
  | "governance_review"
  | "human_validation"
  | "controlled_preparation"
  | "trace_registration"
  | "controlled_handoff";

export type RuntimeMissionPromotionPlanStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  kind: RuntimeMissionPromotionPlanStepKind;
  requires_human: boolean;
  plan_only: true;
  execution_enabled: false;
};

// ── Controlled mission validation requirements ────────────────────────────────

export type ControlledMissionValidationRequirement = {
  requirement_id: string;
  label: string;
  reason: string;
  risk_level: RuntimeMissionPromotionRiskLevel;
  required_approver_role: string;
  blocks_execution: boolean;
};

// ── Controlled Mission (cible de promotion — contrat, jamais exécutée) ────────

export type ControlledMission = {
  controlled_mission_id: string;
  draft_id: string;
  command_id: string;
  intent_id: string;
  route_id: string;
  plan_id: string;
  employee_key: string | null;
  title: string;
  objective: string;
  summary: string;
  domain: string;
  status: ControlledMissionStatus;
  risk_level: RuntimeMissionPromotionRiskLevel;
  validation_mode: RuntimeMissionPromotionValidationMode;
  steps: RuntimeMissionPromotionPlanStep[];
  required_validations: ControlledMissionValidationRequirement[];
  guard_snapshot: RuntimeMissionDraftGuardSnapshot;
  trace_snapshot: RuntimeMissionDraftTraceSnapshot;
  scale_snapshot: RuntimeMissionDraftScaleSnapshot;
  queue_snapshot: RuntimeMissionDraftQueueSnapshot;
  cost_snapshot: RuntimeMissionDraftCostSnapshot;
  idempotency: RuntimeMissionDraftIdempotencySnapshot;
  safety_flags: RuntimeMissionPromotionSafetyFlags;
  // Invariants littéraux
  controlled: true;
  promotion_applied: false;
  execution_enabled: false;
  read_only: true;
};

// ── Decision ──────────────────────────────────────────────────────────────────

export type RuntimeMissionPromotionDecision = {
  verdict: RuntimeMissionPromotionVerdict;
  promotion_applied: false;
  controlled: true;
  blocking_gates: RuntimeMissionPromotionGateId[];
  human_validation_required: boolean;
  message: string;
};

// ── Issues / recommendations / actions ────────────────────────────────────────

export type RuntimeMissionPromotionIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type RuntimeMissionPromotionRecommendation = {
  id: string;
  text: string;
  href?: string;
  action_label?: string;
};

export type RuntimeMissionPromotionAction = {
  id: string;
  label: string;
  href: string;
  primary: boolean;
};

// ── Promotion Contract (assemblage complet, design-only) ──────────────────────

export type RuntimeMissionPromotionContract = {
  phase: RuntimeMissionPromotionPhase;
  mode: RuntimeMissionPromotionMode;
  promotion_id: string;
  draft_id: string;
  status: RuntimeMissionPromotionStatus;
  gates: RuntimeMissionPromotionGate[];
  decision: RuntimeMissionPromotionDecision;
  controlled_mission: ControlledMission | null;
  safety_flags: RuntimeMissionPromotionSafetyFlags;
  issues: RuntimeMissionPromotionIssue[];
  recommendations: RuntimeMissionPromotionRecommendation[];
  actions: RuntimeMissionPromotionAction[];
  scale_80k_not_proven: true;
  public_launch_external_validated: false;
  read_only: true;
  generated_at: string;
};

export type RuntimeMissionPromotionReadResult = {
  mode: RuntimeMissionPromotionMode;
  contract: RuntimeMissionPromotionContract;
  read_only: true;
  execution_enabled: false;
};

// Référence au draft d'entrée (type ré-exporté pour confort).
export type { RuntimeMissionDraft };
