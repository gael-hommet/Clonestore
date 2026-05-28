// B47 — Legal & Commercial Guardrails — Types
// Pure: no Supabase, no Next, no async, no side effects. No throw.
// À faire valider par conseil juridique avant lancement public.
// Conformité juridique finale non prétendue.

export type LegalRiskLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type CommercialClaimCategory =
  | "productivity"
  | "cost_saving"
  | "automation"
  | "replacement"
  | "compliance"
  | "legal"
  | "payroll"
  | "hr_decision"
  | "security"
  | "data_protection"
  | "ai_capability"
  | "pricing"
  | "demo_trial";

export type ClaimDecision =
  | "allowed"
  | "allowed_with_disclaimer"
  | "needs_human_review"
  | "forbidden";

export type LegalCommercialClaim = {
  id: string;
  category: CommercialClaimCategory;
  claim: string;
  decision: ClaimDecision;
  risk_level: LegalRiskLevel;
  required_disclaimer_ids: string[];
  forbidden_reason: string | null;
  safe_rewrite: string | null;
  notes: string | null;
};

export type DisclaimerType =
  | "product_limit"
  | "legal_limit"
  | "hr_responsibility"
  | "payroll_limit"
  | "document_validation"
  | "ai_limit"
  | "data_protection"
  | "demo_limit"
  | "pricing_limit"
  | "human_validation";

export type DisclaimerSeverity = "info" | "warning" | "required";

export type Disclaimer = {
  id: string;
  type: DisclaimerType;
  short_text: string;
  full_text: string;
  required_contexts: OutputContext["surface"][];
  severity: DisclaimerSeverity;
  customer_visible: boolean;
  internal_only: boolean;
};

export type OutputContext = {
  surface: "marketing" | "cockpit" | "email" | "document" | "pdf" | "support" | "demo" | "pricing";
  domain: "hr" | "payroll" | "legal" | "recruitment" | "absence" | "document" | "general";
  is_sensitive: boolean;
  is_official_document: boolean;
  is_public_claim: boolean;
  is_demo: boolean;
  is_paid_customer: boolean;
};

export type OutputGuardrailResult = {
  ok: boolean;
  decision: ClaimDecision;
  risk_level: LegalRiskLevel;
  forbidden_phrases_found: string[];
  missing_required_disclaimers: string[];
  required_human_validation: boolean;
  safe_rewrite: string | null;
  warnings: string[];
  errors: string[];
};

export type MarketingGuardrailResult = {
  ok: boolean;
  forbidden_phrases_found: string[];
  warnings: string[];
  safe_rewrite: string | null;
  allowed_positioning: string[];
};

export type PricingPolicy = {
  monthly_price_eur: number;
  currency: string;
  founder_pricing_enabled: boolean;
  founder_pricing_description: string;
  free_trial_enabled: boolean;
  free_trial_days: number;
  free_demo_enabled: boolean;
  refund_policy_note: string;
  cancellation_policy_note: string;
  legal_review_required: boolean;
};

export type DemoCapabilityKey =
  | "real_email_send"
  | "official_document_export"
  | "real_ai_generation"
  | "real_mission_execution"
  | "customer_data_storage"
  | "sensitive_hr_decision"
  | "paid_automation"
  | "cockpit_access"
  | "cloneadn_context"
  | "pdf_export"
  | "clonetrace"
  | "real_budget_consumption";

export type AcceptanceChecklistItem = {
  id: string;
  category: string;
  description: string;
  status: "required" | "recommended" | "optional";
  legal_review_needed: boolean;
  blocking_b48: boolean;
};

export type LegalCommercialReadiness = {
  score: number;
  ok: boolean;
  blocking_items: string[];
  warnings: string[];
};

export type LegalCommercialVerdict = {
  status: "validated_with_followups" | "blocked";
  score_0_to_100: number;
  safe_to_continue_to_b48: boolean;
  legal_review_required: boolean;
  launch_blockers: string[];
  warnings: string[];
  covered_policies: string[];
  followups: string[];
};
