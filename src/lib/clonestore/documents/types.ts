// src/lib/clonestore/documents/types.ts
// Platform-wide CloneStore document system — Bloc 27
// Pure types: no Next.js, no Supabase, no async, no side effects.

export type CloneDocumentAudience =
  | "internal"
  | "employee"
  | "candidate"
  | "manager"
  | "executive"
  | "external_partner";

export type CloneDocumentFormat =
  | "text"
  | "markdown"
  | "html"
  | "pdf_ready_html";

export type CloneDocumentRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type CloneDocumentValidationMode =
  | "none"
  | "recommended"
  | "required"
  | "human_only";

export type CloneDocumentTemplateScope =
  | "platform_default"
  | "company_custom"
  | "employee_ai_custom";

export type CloneDocumentTone =
  | "formal"
  | "warm"
  | "direct"
  | "executive"
  | "legal_careful"
  | "candidate_friendly"
  | "neutral";

export type CloneDocumentBlockType =
  | "header"
  | "title"
  | "subtitle"
  | "paragraph"
  | "bullet_list"
  | "numbered_list"
  | "table"
  | "signature"
  | "legal_notice"
  | "footer"
  | "separator"
  | "callout"
  | "variable";

export type CloneDocumentVariable = {
  key: string;
  label: string;
  required: boolean;
  description: string;
  fallback: string | null;
  sensitive: boolean;
};

export type CloneDocumentBlock = {
  id: string;
  type: CloneDocumentBlockType;
  label: string;
  content: string;
  optional: boolean;
  variables: string[];
  risk_level: CloneDocumentRiskLevel;
};

export type CloneDocumentTheme = {
  name: string;
  primary_color: string;
  accent_color: string;
  text_color: string;
  background_color: string;
  font_family: string;
  border_radius: string;
  density: "compact" | "comfortable" | "spacious";
};

export type CloneDocumentSignature = {
  name: string | null;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  legal_footer: string | null;
};

export type CloneDocumentTemplate = {
  id: string;
  version: string;
  scope: CloneDocumentTemplateScope;
  agent_slug: string | null;
  document_type: string;
  title: string;
  description: string;
  audience: CloneDocumentAudience;
  default_format: CloneDocumentFormat;
  tone: CloneDocumentTone;
  risk_level: CloneDocumentRiskLevel;
  validation_mode: CloneDocumentValidationMode;
  variables: CloneDocumentVariable[];
  blocks: CloneDocumentBlock[];
  theme: CloneDocumentTheme;
  signature: CloneDocumentSignature | null;
  tags: string[];
  created_at: string | null;
  updated_at: string | null;
};

export type CloneDocumentRenderInput = {
  template: CloneDocumentTemplate;
  variables: Record<string, unknown>;
  format?: CloneDocumentFormat;
  company_profile?: Record<string, unknown> | null;
  employee_profile?: Record<string, unknown> | null;
  mission_context?: Record<string, unknown> | null;
  ai_content?: Record<string, unknown> | string | null;
};

export type CloneDocumentMissingVariable = {
  key: string;
  label: string;
  required: boolean;
  reason: string;
};

export type CloneDocumentValidationIssue = {
  level: "info" | "warning" | "error" | "critical";
  code: string;
  label: string;
  message: string;
  block_id?: string | null;
  variable_key?: string | null;
};

export type CloneDocumentRenderResult = {
  ok: boolean;
  template_id: string;
  document_type: string;
  format: CloneDocumentFormat;
  title: string;
  content_text: string;
  content_markdown: string;
  content_html: string;
  content_pdf_ready_html: string;
  missing_variables: CloneDocumentMissingVariable[];
  validation_issues: CloneDocumentValidationIssue[];
  risk_level: CloneDocumentRiskLevel;
  validation_mode: CloneDocumentValidationMode;
  requires_human_validation: boolean;
  quality_score: number;
  warnings: string[];
};

export type CloneDocumentTemplateIndex = {
  templates: CloneDocumentTemplate[];
  by_type: Record<string, CloneDocumentTemplate[]>;
  totals: {
    templates: number;
    platform_default: number;
    company_custom: number;
    employee_ai_custom: number;
  };
};
