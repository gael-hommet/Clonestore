// B45 — Document Style Kit defaults
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  DocumentStyleKit,
  VisualIdentityConfig,
  TypographyConfig,
  ColorSystemConfig,
  PageLayoutConfig,
  HeaderConfig,
  FooterConfig,
  SignatureConfig,
  TableStyleConfig,
  LegalDocumentConfig,
  ToneStyleConfig,
  StyleKitCompletion,
} from "./types";
import type { EnterpriseEmpreinte } from "../empreinte/types";
import type { PierreEmpreinte } from "../../pierre/empreinte/types";

export const DOCUMENT_STYLE_KIT_VERSION = 1;

export const DEFAULT_FORBIDDEN_PHRASES = [
  "Voici un modèle",
  "voici un modèle",
  "[Votre nom]",
  "[Nom de l'entreprise]",
  "à adapter selon votre situation",
  "à compléter",
  "je vous conseille juridiquement",
  "décision définitive",
  "conseil juridique",
  "[À compléter]",
  "[insérer]",
];

export function buildDefaultVisualIdentity(): VisualIdentityConfig {
  return {
    brand_mark_text: null,
    brand_asset_id: null,
    brand_asset_url: null,
    brand_asset_alt: null,
    show_brand_mark: false,
    brand_notes: null,
  };
}

export function buildDefaultTypography(): TypographyConfig {
  return {
    primary_font_family: "'Segoe UI', Arial, Helvetica, sans-serif",
    secondary_font_family: null,
    fallback_font_family: "Arial, Helvetica, sans-serif",
    base_font_size_px: 13,
    title_scale: 1.7,
    line_height: 1.75,
    heading_weight: 600,
    body_weight: 400,
  };
}

export function buildDefaultColorSystem(): ColorSystemConfig {
  return {
    primary_color_hex: "#1a1a2e",
    secondary_color_hex: "#4f6ef2",
    accent_color_hex: "#4f6ef2",
    text_color_hex: "#1a1a1a",
    muted_text_color_hex: "#6b7280",
    border_color_hex: "#e0e0e0",
    background_color_hex: "#ffffff",
    surface_color_hex: "#f9fafb",
  };
}

export function buildDefaultPageLayout(): PageLayoutConfig {
  return {
    page_size: "A4",
    orientation: "portrait",
    margin_top_mm: 20,
    margin_right_mm: 18,
    margin_bottom_mm: 20,
    margin_left_mm: 18,
    max_content_width_px: 820,
    section_spacing_px: 24,
  };
}

export function buildDefaultHeader(): HeaderConfig {
  return {
    enabled: true,
    height_mm: 20,
    show_company_name: true,
    show_brand_mark: false,
    show_document_title: true,
    show_metadata: false,
    custom_html: null,
    separator_style: "line",
  };
}

export function buildDefaultFooter(): FooterConfig {
  return {
    enabled: true,
    height_mm: 15,
    show_page_number: true,
    show_company_legal_name: true,
    show_confidentiality_note: true,
    show_generated_by: true,
    custom_html: null,
    separator_style: "line",
  };
}

export function buildDefaultSignature(): SignatureConfig {
  return {
    enabled: false,
    signature_source: "empreinte",
    default_signatory_name: null,
    default_signatory_title: null,
    default_signatory_email: null,
    signature_template: null,
    include_validation_stamp: false,
  };
}

export function buildDefaultTableStyle(): TableStyleConfig {
  return {
    header_background_hex: "#1a1a2e",
    header_text_hex: "#ffffff",
    row_border_hex: "#e0e0e0",
    alternating_rows: true,
    compact: false,
    cell_padding_px: 10,
  };
}

export function buildDefaultLegalConfig(): LegalDocumentConfig {
  return {
    confidentiality_notice:
      "Document confidentiel — usage interne exclusivement. Ne pas diffuser sans autorisation.",
    legal_footer_text: null,
    official_document_disclaimer:
      "Ce document a été préparé par Pierre à titre de brouillon opérationnel. Il ne constitue pas une décision juridique définitive et doit être validé par un professionnel RH habilité avant tout usage officiel.",
    require_human_validation_for_official: true,
    never_claim_legal_finality: true,
    dsn_disclaimer:
      "Ce document ne se substitue pas à la DSN officielle. Les données de paie doivent être validées et soumises par le logiciel de paie agréé de l'entreprise.",
    payroll_disclaimer:
      "Ce récapitulatif pré-paie est un outil de préparation interne. Il ne constitue pas un bulletin de salaire officiel et ne remplace pas les obligations légales de l'employeur.",
  };
}

export function buildDefaultToneConfig(): ToneStyleConfig {
  return {
    default_tone: "professional",
    formality_level: "professional",
    preferred_length: "standard",
    forbidden_phrases: DEFAULT_FORBIDDEN_PHRASES,
    required_phrases: [],
    vocabulary: {},
    examples: [],
  };
}

export function buildDefaultStyleKitCompletion(): StyleKitCompletion {
  return {
    score: 0,
    status: "draft",
    filled_sections: [],
    empty_sections: [
      "visual_identity",
      "typography",
      "color_system",
      "page_layout",
      "header",
      "footer",
      "signature",
      "legal",
      "tables",
      "reference_sources",
    ],
    warnings: [
      "Aucun asset visuel de marque configuré.",
      "Aucune source de référence (bulletin, attestation) importée.",
    ],
    premium_complete: false,
    can_activate: false,
  };
}

export function createDefaultDocumentStyleKit(input: {
  user_id: string;
  enterprise?: EnterpriseEmpreinte | null;
  pierre?: PierreEmpreinte | null;
}): DocumentStyleKit {
  const { user_id, enterprise, pierre } = input;
  const now = new Date().toISOString();

  const visual_identity = buildDefaultVisualIdentity();
  const typography = buildDefaultTypography();
  const color_system = buildDefaultColorSystem();
  const page_layout = buildDefaultPageLayout();
  const header = buildDefaultHeader();
  const footer = buildDefaultFooter();
  const signature = buildDefaultSignature();
  const tables = buildDefaultTableStyle();
  const legal = buildDefaultLegalConfig();
  const tone = buildDefaultToneConfig();

  // Apply B44 empreinte overrides if available
  if (enterprise?.company_identity.brand_mark) {
    visual_identity.brand_mark_text = enterprise.company_identity.brand_mark;
    visual_identity.show_brand_mark = true;
  }
  if (enterprise?.company_identity.brand_asset_url) {
    visual_identity.brand_asset_url = enterprise.company_identity.brand_asset_url;
  }
  if (enterprise?.document_preferences.legal_footer_text) {
    legal.legal_footer_text = enterprise.document_preferences.legal_footer_text;
  }
  if (enterprise?.communication.signature_template) {
    signature.signature_template = enterprise.communication.signature_template;
    signature.enabled = true;
    signature.signature_source = "empreinte";
  }
  if (pierre?.document_style.primary_color_hex) {
    color_system.primary_color_hex = pierre.document_style.primary_color_hex;
    tables.header_background_hex = pierre.document_style.primary_color_hex;
  }
  if (pierre?.document_style.secondary_color_hex) {
    color_system.secondary_color_hex = pierre.document_style.secondary_color_hex;
    color_system.accent_color_hex = pierre.document_style.secondary_color_hex;
  }
  if (pierre?.document_style.font_family) {
    typography.primary_font_family = pierre.document_style.font_family;
  }
  if (pierre?.document_style.page_margin_mm) {
    page_layout.margin_top_mm = pierre.document_style.page_margin_mm;
    page_layout.margin_right_mm = pierre.document_style.page_margin_mm;
    page_layout.margin_bottom_mm = pierre.document_style.page_margin_mm;
    page_layout.margin_left_mm = pierre.document_style.page_margin_mm;
  }
  if (pierre?.document_rules.include_legal_disclaimer && pierre.document_rules.legal_disclaimer_text) {
    legal.legal_footer_text = pierre.document_rules.legal_disclaimer_text;
  }
  if (enterprise?.communication.formal_closing) {
    signature.signature_template =
      signature.signature_template ?? enterprise.communication.formal_closing;
  }

  const kit: DocumentStyleKit = {
    id: `dsk_${user_id}`,
    user_id,
    version: DOCUMENT_STYLE_KIT_VERSION,
    status: "draft",
    visual_identity,
    typography,
    color_system,
    page_layout,
    header,
    footer,
    signature,
    tables,
    legal,
    tone,
    reference_sources: [],
    completion: buildDefaultStyleKitCompletion(),
    created_at: now,
    updated_at: now,
  };

  return kit;
}
