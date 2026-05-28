// B44 — PierreEmpreinte document style preparation
// Derives document rendering config from PierreEmpreinte.
// Compatible with B45 Document Style Kit prep.
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { PierreEmpreinte } from "./types";
import type { EnterpriseEmpreinte } from "../../clonestore/empreinte/types";

export interface PierreDocumentRenderConfig {
  tone: string;
  language: string;
  format: string;
  include_company_header: boolean;
  include_legal_disclaimer: boolean;
  legal_disclaimer_text: string | null;
  always_require_human_for_types: string[];
  font_family: string | null;
  primary_color_hex: string | null;
  secondary_color_hex: string | null;
  header_template_id: string | null;
  footer_template_id: string | null;
  watermark_text: string | null;
  page_margin_mm: number;
  use_company_brand_mark: boolean;
  company_name: string | null;
  legal_footer_text: string | null;
  always_include_signature: boolean;
  signature_template: string | null;
}

export function buildPierreDocumentRenderConfig(params: {
  pierre: PierreEmpreinte | null;
  enterprise: EnterpriseEmpreinte | null;
}): PierreDocumentRenderConfig {
  const { pierre, enterprise } = params;

  const companyName =
    enterprise?.company_identity.trade_name ??
    enterprise?.company_identity.legal_name ??
    null;

  const documentLanguage =
    pierre?.document_rules.document_language ??
    enterprise?.document_preferences.document_language ??
    "fr";

  const format =
    enterprise?.document_preferences.preferred_format ?? "markdown";

  const tone =
    pierre?.document_rules.default_tone ??
    enterprise?.communication.default_tone ??
    "formal";

  return {
    tone,
    language: documentLanguage,
    format,
    include_company_header: pierre?.document_rules.include_company_header ?? false,
    include_legal_disclaimer: pierre?.document_rules.include_legal_disclaimer ?? false,
    legal_disclaimer_text: pierre?.document_rules.legal_disclaimer_text ?? null,
    always_require_human_for_types: pierre?.document_rules.always_require_human_for_types ?? [
      "hr_contract_draft", "hr_amendment_draft", "sensitive_case_note",
    ],
    font_family: pierre?.document_style.font_family ?? null,
    primary_color_hex: pierre?.document_style.primary_color_hex ?? null,
    secondary_color_hex: pierre?.document_style.secondary_color_hex ?? null,
    header_template_id: pierre?.document_style.header_template_id ?? null,
    footer_template_id: pierre?.document_style.footer_template_id ?? null,
    watermark_text: pierre?.document_style.watermark_text ?? null,
    page_margin_mm: pierre?.document_style.page_margin_mm ?? 20,
    use_company_brand_mark: pierre?.document_style.use_company_brand_mark ?? false,
    company_name: companyName,
    legal_footer_text: enterprise?.document_preferences.legal_footer_text ?? null,
    always_include_signature: enterprise?.document_preferences.always_include_signature ?? false,
    signature_template: enterprise?.communication.signature_template ?? null,
  };
}

export function buildDocumentVariablesFromEmpreinte(params: {
  pierre: PierreEmpreinte | null;
  enterprise: EnterpriseEmpreinte | null;
}): Record<string, unknown> {
  const config = buildPierreDocumentRenderConfig(params);
  const { enterprise } = params;

  return {
    company_name: config.company_name,
    company_legal_name: enterprise?.company_identity.legal_name ?? null,
    company_sector: enterprise?.company_identity.sector ?? null,
    company_country: enterprise?.company_identity.country_code ?? null,
    hr_contact_email: enterprise?.company_identity.hr_contact_email ?? null,
    hr_contact_name: enterprise?.company_identity.hr_contact_name ?? null,
    document_tone: config.tone,
    document_language: config.language,
    document_format: config.format,
    formal_closing: enterprise?.communication.formal_closing ?? null,
    greeting_style: enterprise?.communication.greeting_style ?? null,
    signature_template: config.signature_template,
    legal_footer_text: config.legal_footer_text,
    primary_color: config.primary_color_hex,
    font_family: config.font_family,
  };
}
