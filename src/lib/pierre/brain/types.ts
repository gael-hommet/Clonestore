// src/lib/pierre/brain/types.ts
// Pierre Brain Final Core — Types purs.
// Pas de Supabase, pas de Next, pas d'async.

export type PierreBrainDomain =
  | "recruitment"
  | "onboarding"
  | "employee_admin"
  | "contract"
  | "absence"
  | "prepay"
  | "performance"
  | "training"
  | "employee_relations"
  | "offboarding"
  | "document"
  | "communication"
  | "reporting"
  | "unknown";

export type PierreBrainRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type PierreBrainConfidence =
  | "low"
  | "medium"
  | "high";

export type PierreBrainTaskDraft = {
  type: string;
  title: string;
  description: string;
  priority: number;
  approval_required: boolean;
  risk_level: PierreBrainRiskLevel;
  expected_artifact: string | null;
  payload: Record<string, unknown>;
};

export type PierreBrainMissingInfo = {
  field: string;
  label: string;
  required: boolean;
  reason: string;
  question: string;
};

export type PierreBrainInterpretation = {
  intent: string;
  domain: PierreBrainDomain;
  summary: string;
  employee_refs: string[];
  dates: string[];
  document_needs: string[];
  risk_level: PierreBrainRiskLevel;
  sensitive_topics: string[];
  missing_info: PierreBrainMissingInfo[];
  requires_human_validation: boolean;
  confidence: PierreBrainConfidence;
  reasoning_summary: string;
};

export type PierreBrainRiskReview = {
  risk_level: PierreBrainRiskLevel;
  sensitive_topics: string[];
  approval_required: boolean;
  human_only: boolean;
  blocked_reason: string | null;
  safe_next_step: string;
};

export type PierreBrainTaskPlan = {
  tasks: PierreBrainTaskDraft[];
  dependencies: Array<{
    task_title: string;
    depends_on: string[];
    reason: string;
  }>;
  validation_points: string[];
  artifact_expectations: string[];
  execution_notes: string[];
};

export type PierreBrainQualityGate = {
  valid: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  safe_to_use: boolean;
  normalization_hints: string[];
};

export type PierreBrainSource = "ai" | "deterministic" | "hybrid";

export type PierreBrainFinalOutput = {
  source: PierreBrainSource;
  ai_enabled: boolean;
  ai_ok: boolean;
  provider: string | null;
  interpretation: PierreBrainInterpretation;
  risk_review: PierreBrainRiskReview;
  task_plan: PierreBrainTaskPlan;
  quality_gate: PierreBrainQualityGate;
  normalized_brain_output_json: Record<string, unknown>;
  warnings: string[];
  errors: string[];
};
