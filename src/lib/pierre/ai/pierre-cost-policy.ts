// src/lib/pierre/ai/pierre-cost-policy.ts
// B38A — Pierre-specific AI cost policy. Maps Pierre use cases to shield requests.
// Anthropic disabled for all Pierre use cases until B38B+.
// OpenAI-only for now.

import type { AiCostShieldRequest, AiCommercialAccessLevel, AiCostShieldProvider } from "../../cloneos/ai/cost-shield/types";
import type { CloneAIUseCase } from "../../cloneos/ai/types";

// ── Use-case metadata ─────────────────────────────────────────────────────────

type PierreUseCasePolicy = {
  provider: AiCostShieldProvider;
  model: string;
  min_access_level: AiCommercialAccessLevel;
  is_client_visible: boolean;
  requires_premium_model: boolean;
  input_token_estimate: number;
  max_output_tokens: number;
  requires_approval_if_sensitive: boolean;
  description: string;
};

const PIERRE_USE_CASE_POLICIES: Record<string, PierreUseCasePolicy> = {
  // ── Mission interpretation ─────────────────────────────────────────────────
  "pierre.mission.interpret": {
    provider: "openai",
    model: "gpt-4.1",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 800,
    max_output_tokens: 1024,
    requires_approval_if_sensitive: false,
    description: "Interprets HR mission intent — OpenAI only, paid customers",
  },
  "pierre.brain.final_interpret": {
    provider: "openai",
    model: "gpt-4.1",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 1200,
    max_output_tokens: 2048,
    requires_approval_if_sensitive: false,
    description: "Brain final interpretation — OpenAI, paid customers",
  },

  // ── Task planning ──────────────────────────────────────────────────────────
  "pierre.tasks.plan": {
    provider: "openai",
    model: "gpt-4.1",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 1000,
    max_output_tokens: 2048,
    requires_approval_if_sensitive: false,
    description: "Plans HR tasks — OpenAI, paid customers",
  },
  "pierre.brain.task_plan": {
    provider: "openai",
    model: "gpt-4.1",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 1000,
    max_output_tokens: 2048,
    requires_approval_if_sensitive: false,
    description: "Brain task plan — OpenAI, paid customers",
  },

  // ── Document generation (client-visible — requires premium budget) ──────────
  "pierre.document.generate": {
    provider: "openai", // Anthropic disabled — OpenAI fallback for now
    model: "gpt-4.1",
    min_access_level: "paid_customer",
    is_client_visible: true,
    requires_premium_model: false, // Premium would be Opus, but Anthropic disabled
    input_token_estimate: 2000,
    max_output_tokens: 4096,
    requires_approval_if_sensitive: false,
    description: "HR document generation — client-visible, OpenAI, paid customers",
  },
  "pierre.pdf.generate": {
    provider: "openai",
    model: "gpt-4.1",
    min_access_level: "paid_customer",
    is_client_visible: true,
    requires_premium_model: false,
    input_token_estimate: 2000,
    max_output_tokens: 4096,
    requires_approval_if_sensitive: false,
    description: "PDF content generation — client-visible, paid customers",
  },
  "pierre.document.draft": {
    provider: "openai",
    model: "gpt-4.1",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 1500,
    max_output_tokens: 3000,
    requires_approval_if_sensitive: false,
    description: "Document draft — paid customers",
  },
  "pierre.document.review": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 2000,
    max_output_tokens: 1024,
    requires_approval_if_sensitive: false,
    description: "Document review — paid customers",
  },
  "pierre.hr_letter.generate": {
    provider: "openai",
    model: "gpt-4.1",
    min_access_level: "paid_customer",
    is_client_visible: true,
    requires_premium_model: false,
    input_token_estimate: 1500,
    max_output_tokens: 3000,
    requires_approval_if_sensitive: true, // Sensitive HR letters need approval
    description: "HR letter — client-visible, sensitive, approval required for risky cases",
  },

  // ── Advanced generation (fiches, reports) ─────────────────────────────────
  "pierre.client_fiche.generate": {
    provider: "openai",
    model: "gpt-4.1",
    min_access_level: "paid_customer",
    is_client_visible: true,
    requires_premium_model: false,
    input_token_estimate: 3000,
    max_output_tokens: 4096,
    requires_approval_if_sensitive: false,
    description: "Client fiche generation — paid customers",
  },
  "pierre.final_report.generate": {
    provider: "openai",
    model: "gpt-4.1",
    min_access_level: "internal_admin",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 4000,
    max_output_tokens: 4096,
    requires_approval_if_sensitive: false,
    description: "Final reports — internal admin only",
  },
  "pierre.spreadsheet.generate": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: true,
    requires_premium_model: false,
    input_token_estimate: 1000,
    max_output_tokens: 2048,
    requires_approval_if_sensitive: false,
    description: "Spreadsheet generation — paid customers",
  },

  // ── Risk & analysis ────────────────────────────────────────────────────────
  "pierre.risk.precheck": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 800,
    max_output_tokens: 512,
    requires_approval_if_sensitive: false,
    description: "Risk pre-check — fast, paid customers",
  },
  "pierre.risk.sensitive": {
    provider: "openai", // Anthropic disabled — OpenAI as fallback
    model: "gpt-4.1",
    min_access_level: "internal_admin",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 3000,
    max_output_tokens: 2048,
    requires_approval_if_sensitive: true, // Always requires approval for sensitive cases
    description: "Sensitive risk analysis — internal admin + approval required",
  },

  // ── Status updates (cheap, frequent) ──────────────────────────────────────
  "pierre.brain.missing_info": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 500,
    max_output_tokens: 512,
    requires_approval_if_sensitive: false,
    description: "Missing info detection — fast, cheap",
  },
  "pierre.brain.risk_review": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 600,
    max_output_tokens: 512,
    requires_approval_if_sensitive: false,
    description: "Brain risk review — fast",
  },
  "pierre.brain.answer": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 400,
    max_output_tokens: 256,
    requires_approval_if_sensitive: false,
    description: "Brain answer — micro task",
  },
  "pierre.brain.quality_gate": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 800,
    max_output_tokens: 512,
    requires_approval_if_sensitive: false,
    description: "Quality gate check — paid customers",
  },

  // ── Employee file ──────────────────────────────────────────────────────────
  "pierre.employee_file.summarize": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 2000,
    max_output_tokens: 1024,
    requires_approval_if_sensitive: false,
    description: "Employee file summary — paid customers",
  },
  "pierre.customer_success.summarize": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "internal_admin",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 2000,
    max_output_tokens: 1024,
    requires_approval_if_sensitive: false,
    description: "Customer success summary — internal admin",
  },

  // ── Public demo (always static) ────────────────────────────────────────────
  "platform.chat.answer": {
    provider: "mock",
    model: "mock",
    min_access_level: "public_demo",
    is_client_visible: true,
    requires_premium_model: false,
    input_token_estimate: 0,
    max_output_tokens: 0,
    requires_approval_if_sensitive: false,
    description: "Platform chat — static/mock only, public demo OK",
  },
  "platform.routing.classify": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 200,
    max_output_tokens: 64,
    requires_approval_if_sensitive: false,
    description: "Routing classify — micro task",
  },
  "platform.generic.structured": {
    provider: "openai",
    model: "gpt-4.1-mini",
    min_access_level: "paid_customer",
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 500,
    max_output_tokens: 512,
    requires_approval_if_sensitive: false,
    description: "Generic structured output — paid customers",
  },
};

// ── Access level ordering ─────────────────────────────────────────────────────

const ACCESS_LEVEL_ORDER: AiCommercialAccessLevel[] = [
  "anonymous",
  "public_demo",
  "logged_unpaid",
  "qualified_prospect",
  "trial_limited",
  "paid_customer",
  "internal_admin",
];

function meetsMinAccessLevel(
  actual: AiCommercialAccessLevel,
  minimum: AiCommercialAccessLevel,
): boolean {
  return ACCESS_LEVEL_ORDER.indexOf(actual) >= ACCESS_LEVEL_ORDER.indexOf(minimum);
}

// ── Shield request builder ────────────────────────────────────────────────────

export function buildPierreShieldRequest(params: {
  useCase: CloneAIUseCase | string;
  companyId: string | null;
  userId: string | null;
  accessLevel: AiCommercialAccessLevel;
  missionId?: string | null;
  taskId?: string | null;
  employeeSlug?: string | null;
  isDemo?: boolean;
  isPublic?: boolean;
  isSensitiveCase?: boolean;
  metadata?: Record<string, unknown>;
}): AiCostShieldRequest {
  const policy = PIERRE_USE_CASE_POLICIES[params.useCase] ?? {
    provider: "openai" as AiCostShieldProvider,
    model: "gpt-4.1",
    min_access_level: "paid_customer" as AiCommercialAccessLevel,
    is_client_visible: false,
    requires_premium_model: false,
    input_token_estimate: 1000,
    max_output_tokens: 2048,
    requires_approval_if_sensitive: false,
    description: "Unknown use case — conservative defaults",
  };

  const isDemo = params.isDemo ?? false;
  const isPublic = params.isPublic ?? false;

  // Downgrade to mock provider if access level doesn't meet minimum
  const meetsLevel = meetsMinAccessLevel(params.accessLevel, policy.min_access_level);
  const effectiveProvider: AiCostShieldProvider = meetsLevel ? policy.provider : "mock";

  return {
    company_id: params.companyId,
    user_id: params.userId,
    agent_slug: "pierre",
    employee_slug: params.employeeSlug ?? null,
    mission_id: params.missionId ?? null,
    task_id: params.taskId ?? null,
    access_level: params.accessLevel,
    provider: effectiveProvider,
    model: meetsLevel ? policy.model : "mock",
    use_case: params.useCase,
    input_token_estimate: policy.input_token_estimate,
    max_output_tokens: policy.max_output_tokens,
    estimated_cost_cents: 0, // Will be computed by shield
    is_client_visible: policy.is_client_visible,
    is_demo: isDemo,
    is_public: isPublic,
    is_paid_customer: params.accessLevel === "paid_customer" || params.accessLevel === "internal_admin",
    requires_premium_model: policy.requires_premium_model,
    requested_at: new Date().toISOString(),
    metadata: {
      ...(params.metadata ?? {}),
      use_case_policy: policy.description,
      requires_approval_if_sensitive: policy.requires_approval_if_sensitive && (params.isSensitiveCase ?? false),
    },
  };
}

// ── Demo/public helpers ───────────────────────────────────────────────────────

export function isDemoUseCase(useCase: string): boolean {
  const policy = PIERRE_USE_CASE_POLICIES[useCase];
  if (!policy) return false;
  return policy.provider === "mock" || policy.min_access_level === "public_demo";
}

export function getPierreUseCasePolicy(useCase: string): PierreUseCasePolicy | null {
  return PIERRE_USE_CASE_POLICIES[useCase] ?? null;
}

export function requiresApprovalForSensitiveCase(useCase: string): boolean {
  return PIERRE_USE_CASE_POLICIES[useCase]?.requires_approval_if_sensitive ?? false;
}

export function isAnthropicUseCase(_useCase: string): false {
  // Anthropic is disabled for ALL Pierre use cases in B38A.
  // All use cases are mapped to OpenAI or mock.
  return false;
}
