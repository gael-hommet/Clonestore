// B45 — Document Style Kit types
// Per-company document style configuration built on top of B44 empreinte.
// Pure types: no Next.js, no Supabase, no async, no side effects.

export type DocumentStyleKitStatus =
  | "draft"
  | "incomplete"
  | "ready"
  | "active"
  | "needs_review"
  | "archived";

export type DocumentReferenceSourceType =
  | "payslip_sample"
  | "employment_certificate"
  | "contract_template"
  | "amendment_template"
  | "internal_note_template"
  | "HR_policy"
  | "letterhead"
  | "footer"
  | "email_signature"
  | "brand_guidelines"
  | "table_template"
  | "other";

export type DocumentOutputFormat =
  | "plain_text"
  | "markdown"
  | "html"
  | "pdf_ready_html"
  | "pdf_contract"
  | "docx_contract"
  | "spreadsheet_contract";

export type DocumentTemplateCategory =
  | "certificate"
  | "contract"
  | "amendment"
  | "onboarding"
  | "absence"
  | "prepayroll"
  | "employee_file"
  | "recruitment"
  | "internal_note"
  | "executive_report"
  | "email_attachment"
  | "other";

export type DocumentRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type DocumentValidationRequirement =
  | "none"
  | "recommended"
  | "required"
  | "required_before_send"
  | "required_before_export"
  | "blocked_without_human";

// ── Visual Identity ───────────────────────────────────────────────────────────

export interface VisualIdentityConfig {
  brand_mark_text: string | null;       // sigle textuel — NOT "logo"
  brand_asset_id: string | null;
  brand_asset_url: string | null;       // URL asset visuel — NOT "logo_url"
  brand_asset_alt: string | null;
  show_brand_mark: boolean;
  brand_notes: string | null;
}

// ── Typography ────────────────────────────────────────────────────────────────

export interface TypographyConfig {
  primary_font_family: string;
  secondary_font_family: string | null;
  fallback_font_family: string;
  base_font_size_px: number;
  title_scale: number;                  // multiplier: 1.5 = title is 1.5× base
  line_height: number;                  // e.g. 1.6
  heading_weight: number;               // 400–900
  body_weight: number;
}

// ── Color System ──────────────────────────────────────────────────────────────

export interface ColorSystemConfig {
  primary_color_hex: string;
  secondary_color_hex: string;
  accent_color_hex: string;
  text_color_hex: string;
  muted_text_color_hex: string;
  border_color_hex: string;
  background_color_hex: string;
  surface_color_hex: string;
}

// ── Page Layout ───────────────────────────────────────────────────────────────

export type PageSize = "A4" | "A3" | "Letter" | "Legal";
export type PageOrientation = "portrait" | "landscape";

export interface PageLayoutConfig {
  page_size: PageSize;
  orientation: PageOrientation;
  margin_top_mm: number;
  margin_right_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  max_content_width_px: number;
  section_spacing_px: number;
}

// ── Header / Footer ───────────────────────────────────────────────────────────

export type SeparatorStyle = "none" | "line" | "double_line" | "gradient";

export interface HeaderConfig {
  enabled: boolean;
  height_mm: number;
  show_company_name: boolean;
  show_brand_mark: boolean;
  show_document_title: boolean;
  show_metadata: boolean;
  custom_html: string | null;
  separator_style: SeparatorStyle;
}

export interface FooterConfig {
  enabled: boolean;
  height_mm: number;
  show_page_number: boolean;
  show_company_legal_name: boolean;
  show_confidentiality_note: boolean;
  show_generated_by: boolean;
  custom_html: string | null;
  separator_style: SeparatorStyle;
}

// ── Signature ─────────────────────────────────────────────────────────────────

export type SignatureSource = "empreinte" | "manual" | "none";

export interface SignatureConfig {
  enabled: boolean;
  signature_source: SignatureSource;
  default_signatory_name: string | null;
  default_signatory_title: string | null;
  default_signatory_email: string | null;
  signature_template: string | null;
  include_validation_stamp: boolean;
}

// ── Table Style ───────────────────────────────────────────────────────────────

export interface TableStyleConfig {
  header_background_hex: string;
  header_text_hex: string;
  row_border_hex: string;
  alternating_rows: boolean;
  compact: boolean;
  cell_padding_px: number;
}

// ── Legal Document Config ─────────────────────────────────────────────────────

export interface LegalDocumentConfig {
  confidentiality_notice: string;
  legal_footer_text: string | null;
  official_document_disclaimer: string;
  require_human_validation_for_official: boolean;
  never_claim_legal_finality: boolean;
  dsn_disclaimer: string;
  payroll_disclaimer: string;
}

// ── Tone Style ────────────────────────────────────────────────────────────────

export interface ToneStyleConfig {
  default_tone: string;
  formality_level: "casual" | "professional" | "formal" | "legal";
  preferred_length: "concise" | "standard" | "detailed";
  forbidden_phrases: string[];
  required_phrases: string[];
  vocabulary: Record<string, string>;
  examples: string[];
}

// ── Reference Document Source ─────────────────────────────────────────────────

export interface ReferenceDocumentSource {
  id: string;
  source_type: DocumentReferenceSourceType;
  label: string;
  file_id: string | null;
  file_name: string | null;
  mime_type: string | null;
  extracted_text_preview: string | null;
  extracted_structure: Record<string, unknown> | null;
  style_notes: string | null;
  trusted: boolean;
  uploaded_at: string | null;
}

// ── Style Kit Completion ──────────────────────────────────────────────────────

export interface StyleKitCompletion {
  score: number;                        // 0–100
  status: DocumentStyleKitStatus;
  filled_sections: string[];
  empty_sections: string[];
  warnings: string[];
  premium_complete: boolean;
  can_activate: boolean;
}

// ── Main DocumentStyleKit ─────────────────────────────────────────────────────

export interface DocumentStyleKit {
  id: string;
  user_id: string;
  version: number;
  status: DocumentStyleKitStatus;
  visual_identity: VisualIdentityConfig;
  typography: TypographyConfig;
  color_system: ColorSystemConfig;
  page_layout: PageLayoutConfig;
  header: HeaderConfig;
  footer: FooterConfig;
  signature: SignatureConfig;
  tables: TableStyleConfig;
  legal: LegalDocumentConfig;
  tone: ToneStyleConfig;
  reference_sources: ReferenceDocumentSource[];
  completion: StyleKitCompletion;
  created_at: string;
  updated_at: string;
}

// ── Document Template (B45 format) ────────────────────────────────────────────

export interface DocumentTemplateSection {
  id: string;
  title: string;
  order: number;
  required: boolean;
  content_template: string;            // {{variable}} tokens
  variable_names: string[];
  rendering_hint: string | null;
}

export interface DocumentTemplate {
  id: string;
  category: DocumentTemplateCategory;
  document_type: string;
  label: string;
  description: string;
  risk_level: DocumentRiskLevel;
  output_format: DocumentOutputFormat;
  required_variables: string[];
  optional_variables: string[];
  sections: DocumentTemplateSection[];
  default_validation_requirement: DocumentValidationRequirement;
  style_profile: string | null;
  official_document: boolean;
  active: boolean;
}

// ── Render Context ────────────────────────────────────────────────────────────

export interface DocumentRenderContext {
  style_kit: DocumentStyleKit;
  template: DocumentTemplate;
  variables: Record<string, unknown>;
  company_name: string | null;
  document_title: string;
  mission_id: string | null;
  task_id: string | null;
  generated_at: string;
}

// ── Render Result ─────────────────────────────────────────────────────────────

export interface DocumentArtifactMetadata {
  id: string;
  title: string;
  document_type: string;
  format: DocumentOutputFormat;
  created_at: string;
  user_id: string;
  mission_id: string | null;
  task_id: string | null;
  official_document: boolean;
  validation_required: boolean;
  quality_score: number;
  style_kit_id: string;
  template_id: string;
  redacted_preview: string;
}

export interface DocumentRenderResult {
  ok: boolean;
  document_id: string;
  title: string;
  document_type: string;
  format: DocumentOutputFormat;
  html: string;
  text: string;
  pdf_ready_html: string;
  missing_variables: string[];
  unresolved_tokens: string[];
  quality_score: number;
  validation_requirement: DocumentValidationRequirement;
  artifact_metadata: DocumentArtifactMetadata;
  warnings: string[];
  errors: string[];
}

// ── PDF Export Contract ───────────────────────────────────────────────────────

export interface PdfExportContract {
  pdf_ready_html: string;
  page_size: PageSize;
  orientation: PageOrientation;
  margin_top_mm: number;
  margin_right_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  recommended_filename: string;
  title: string;
  document_type: string;
  validation_required: boolean;
  ready_for_binary_pdf: boolean;
  metadata: DocumentArtifactMetadata;
  estimated_pages: number;
}

// ── Reference Source Coverage ─────────────────────────────────────────────────

export interface ReferenceSourceCoverage {
  total: number;
  has_payslip: boolean;
  has_certificate: boolean;
  has_contract: boolean;
  has_letterhead: boolean;
  has_footer: boolean;
  has_brand_guidelines: boolean;
  missing_types: DocumentReferenceSourceType[];
  premium_complete: boolean;
}

// ── Quality Gate Result ───────────────────────────────────────────────────────

export type QualityGateSeverity = "info" | "warning" | "error" | "hard_fail";

export interface QualityGateIssue {
  code: string;
  severity: QualityGateSeverity;
  message: string;
  context: string | null;
}

export interface DocumentQualityResult {
  score: number;                        // 0–100
  passed: boolean;
  issues: QualityGateIssue[];
  hard_fails: QualityGateIssue[];
  warnings: QualityGateIssue[];
  client_visible_safe: boolean;
}
