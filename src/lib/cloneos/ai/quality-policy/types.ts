// src/lib/cloneos/ai/quality-policy/types.ts
// B38D — AI Quality Policy types.
// Defines the quality/cost routing vocabulary that sits above B32 model presets.
// Pure types: no imports, no async, no env.

// ── Model tier ────────────────────────────────────────────────────────────────
// Tiers drive model selection independently of specific model IDs.
// "economy"         = GPT mini / fast — orchestration, statuts, micro-tâches
// "balanced"        = GPT fort standard — analyse RH, drafts internes
// "premium"         = modèle fort — livrables client visible (OpenAI actuellement)
// "premium_guarded" = modèle fort + cost shield + ledger + validation humaine
// "disabled"        = mock/static uniquement — 0€

export type AiModelTier =
  | "economy"
  | "balanced"
  | "premium"
  | "premium_guarded"
  | "disabled";

// ── Use-case quality class ────────────────────────────────────────────────────
// Semantic classification of what the AI call produces.

export type AiUseCaseQualityClass =
  | "orchestration"
  | "status_update"
  | "task_planning"
  | "context_summary"
  | "hr_analysis"
  | "sensitive_analysis"
  | "email_draft"
  | "document_draft"
  | "premium_document"
  | "pdf_deliverable"
  | "executive_report"
  | "public_demo"
  | "unpaid_user"
  | "internal_test";

// ── Routing decision ──────────────────────────────────────────────────────────

export type AiModelRoutingDecision = {
  use_case: string;
  quality_class: AiUseCaseQualityClass;
  model_tier: AiModelTier;
  provider: "openai" | "mock" | "static" | "anthropic";
  model_profile: string;
  requires_cost_shield: boolean;
  requires_ledger: boolean;
  requires_human_validation: boolean;
  allow_for_public_demo: boolean;
  allow_for_unpaid: boolean;
  allow_for_paid_customer: boolean;
  max_estimated_cost_cents: number;
  reason: string;
  future_provider_candidates: string[];
};

// ── Output quality level ──────────────────────────────────────────────────────
// Controls the expected presentation quality of the AI output.

export type OutputQualityLevel =
  | "basic_internal"        // Status/log — not seen by client
  | "operational"           // Structured, actionable — internal use
  | "client_visible"        // Professional, clean — client can see it
  | "premium_client_visible"// Executive-grade — dirigeant/RH premium
  | "official_document";    // Legally sensitive — human validation required

// ── Output quality contract ───────────────────────────────────────────────────

export type OutputQualityContract = {
  level: OutputQualityLevel;
  label: string;
  must_include: string[];
  must_never_include: string[];
  tone_rules: string[];
  formatting_rules: string[];
  requires_human_validation: boolean;
  premium_model_recommended: boolean;
  document_style_required_later: boolean;
};

// ── Pierre deliverable types ──────────────────────────────────────────────────

export type PierreDeliverableType =
  | "email_draft"
  | "hr_note"
  | "candidate_summary"
  | "onboarding_plan"
  | "absence_followup"
  | "prepayroll_summary"
  | "employee_file_summary"
  | "certificate_draft"
  | "contract_draft"
  | "amendment_draft"
  | "executive_report"
  | "pdf_export"
  | "spreadsheet_export";

// ── Pierre deliverable quality contract ──────────────────────────────────────

export type PierreDeliverableQualityContract = {
  deliverable_type: PierreDeliverableType;
  output_quality_level: OutputQualityLevel;
  must_include: string[];
  must_never_include: string[];
  tone_rules: string[];
  structure_rules: string[];
  formatting_rules: string[];
  validation_rules: string[];
  human_validation_required: boolean;
  premium_model_required: boolean;
  document_style_required_later: boolean;
  template_support_target_block: string | null;
};

// ── Document style kit ────────────────────────────────────────────────────────

export type DocumentStyleCapabilityStatus =
  | "not_started"
  | "placeholder_ready"
  | "contract_ready"
  | "partially_implemented"
  | "complete";

export type DocumentStyleSourceType =
  | "payslip"
  | "employment_certificate"
  | "contract"
  | "amendment"
  | "internal_memo"
  | "HR_policy"
  | "letterhead"
  | "footer"
  | "logo"
  | "brand_guidelines"
  | "spreadsheet_template"
  | "other";

export type DocumentStyleKitRequirement = {
  id: string;
  source_type: DocumentStyleSourceType;
  label: string;
  description: string;
  required_for_launch: boolean;
  target_block: "B44" | "B45";
  capability_status: DocumentStyleCapabilityStatus;
  expected_future_behavior: string;
};

// ── B38 final closure verdict ─────────────────────────────────────────────────

export type B38BlockStatus = {
  block: string;
  validated: boolean;
  test_count: number;
  notes: string;
};

export type B38FinalClosureVerdict = {
  status: "validated" | "validated_with_followups" | "blocked";
  score_0_to_100: number;
  validated_blocks: B38BlockStatus[];
  remaining_followups: string[];
  launch_critical_future_blocks: string[];
  safe_to_continue_to_b39: boolean;
  notes: string;
};
