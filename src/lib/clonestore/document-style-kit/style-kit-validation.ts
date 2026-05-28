// B45 — Document Style Kit validation and completion scoring
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { DocumentStyleKit, StyleKitCompletion, DocumentStyleKitStatus } from "./types";
import { normalizeHexColor } from "./sanitize";

// ── Section scorers ───────────────────────────────────────────────────────────

function scoreVisualIdentity(kit: DocumentStyleKit): number {
  const vi = kit.visual_identity;
  let score = 0;
  if (vi.brand_mark_text || vi.brand_asset_url) score += 60;
  if (vi.show_brand_mark) score += 20;
  if (vi.brand_asset_alt) score += 20;
  return score;
}

function scoreTypography(kit: DocumentStyleKit): number {
  const t = kit.typography;
  let score = 0;
  if (t.primary_font_family && t.primary_font_family !== "'Segoe UI', Arial, Helvetica, sans-serif") score += 50;
  else if (t.primary_font_family) score += 20;
  if (t.base_font_size_px >= 11 && t.base_font_size_px <= 16) score += 30;
  if (t.line_height >= 1.4 && t.line_height <= 2.0) score += 20;
  return score;
}

function scoreColorSystem(kit: DocumentStyleKit): number {
  const cs = kit.color_system;
  let score = 0;
  const isDefault = cs.primary_color_hex === "#1A1A2E";
  if (!isDefault) score += 60;
  else score += 20;
  if (normalizeHexColor(cs.secondary_color_hex, "") !== "") score += 20;
  if (normalizeHexColor(cs.accent_color_hex, "") !== "") score += 20;
  return score;
}

function scorePageLayout(kit: DocumentStyleKit): number {
  const pl = kit.page_layout;
  let score = 40;
  if (pl.margin_top_mm >= 15 && pl.margin_top_mm <= 30) score += 20;
  if (pl.margin_right_mm >= 15 && pl.margin_right_mm <= 25) score += 20;
  if (pl.page_size === "A4" || pl.page_size === "Letter") score += 20;
  return score;
}

function scoreHeader(kit: DocumentStyleKit): number {
  if (!kit.header.enabled) return 20;
  let score = 50;
  if (kit.header.show_company_name) score += 20;
  if (kit.header.show_document_title) score += 20;
  if (kit.header.custom_html) score += 10;
  return score;
}

function scoreFooter(kit: DocumentStyleKit): number {
  if (!kit.footer.enabled) return 20;
  let score = 50;
  if (kit.footer.show_confidentiality_note) score += 20;
  if (kit.footer.show_page_number) score += 20;
  if (kit.footer.custom_html) score += 10;
  return score;
}

function scoreSignature(kit: DocumentStyleKit): number {
  if (!kit.signature.enabled) return 0;
  let score = 40;
  if (kit.signature.signature_template) score += 40;
  if (kit.signature.default_signatory_name) score += 20;
  return score;
}

function scoreLegal(kit: DocumentStyleKit): number {
  let score = 0;
  if (kit.legal.confidentiality_notice) score += 30;
  if (kit.legal.official_document_disclaimer) score += 30;
  if (kit.legal.never_claim_legal_finality) score += 20;
  if (kit.legal.dsn_disclaimer) score += 10;
  if (kit.legal.payroll_disclaimer) score += 10;
  return score;
}

function scoreTables(kit: DocumentStyleKit): number {
  let score = 40;
  const t = kit.tables;
  if (normalizeHexColor(t.header_background_hex, "") !== "#1A1A2E") score += 30;
  else score += 10;
  if (t.alternating_rows) score += 15;
  if (t.cell_padding_px >= 6 && t.cell_padding_px <= 16) score += 15;
  return score;
}

function scoreReferenceSources(kit: DocumentStyleKit): number {
  const n = kit.reference_sources.length;
  if (n === 0) return 0;
  if (n >= 5) return 100;
  return Math.round((n / 5) * 100);
}

// ── Section weights ───────────────────────────────────────────────────────────

const WEIGHTS: Record<string, number> = {
  color_system: 15,
  page_layout: 15,
  header: 10,
  footer: 10,
  legal: 15,
  typography: 10,
  visual_identity: 10,
  signature: 5,
  tables: 5,
  reference_sources: 5,
};

// ── Compute completion ────────────────────────────────────────────────────────

export function computeStyleKitCompletion(kit: DocumentStyleKit): StyleKitCompletion {
  const sections: Record<string, number> = {
    visual_identity: scoreVisualIdentity(kit),
    typography: scoreTypography(kit),
    color_system: scoreColorSystem(kit),
    page_layout: scorePageLayout(kit),
    header: scoreHeader(kit),
    footer: scoreFooter(kit),
    signature: scoreSignature(kit),
    legal: scoreLegal(kit),
    tables: scoreTables(kit),
    reference_sources: scoreReferenceSources(kit),
  };

  let weighted = 0;
  for (const [section, weight] of Object.entries(WEIGHTS)) {
    weighted += (sections[section] / 100) * weight;
  }
  const score = Math.round(Math.min(100, Math.max(0, weighted)));

  const filled_sections: string[] = [];
  const empty_sections: string[] = [];
  for (const [name, s] of Object.entries(sections)) {
    if (s >= 30) filled_sections.push(name);
    else empty_sections.push(name);
  }

  const warnings: string[] = [];
  if (!kit.visual_identity.brand_mark_text && !kit.visual_identity.brand_asset_url) {
    warnings.push("Aucun asset visuel de marque configuré.");
  }
  if (!kit.header.custom_html && !kit.header.show_company_name) {
    warnings.push("En-tête sans nom d'entreprise.");
  }
  if (!kit.signature.enabled) {
    warnings.push("Aucun bloc de signature configuré.");
  }
  if (kit.reference_sources.length === 0) {
    warnings.push("Aucune source de référence (bulletin, attestation) importée.");
  }
  if (!kit.legal.legal_footer_text) {
    warnings.push("Aucun texte de pied de page légal configuré.");
  }

  const premium_complete = score >= 70 && kit.reference_sources.length >= 2;
  const can_activate = score >= 40;

  let status: DocumentStyleKitStatus;
  if (score === 0) status = "draft";
  else if (score < 30) status = "incomplete";
  else if (score < 60) status = "ready";
  else if (score < 85) status = "active";
  else status = "active";

  return {
    score,
    status,
    filled_sections,
    empty_sections,
    warnings,
    premium_complete,
    can_activate,
  };
}

// ── Validate ──────────────────────────────────────────────────────────────────

export interface StyleKitValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface StyleKitValidationResult {
  valid: boolean;
  issues: StyleKitValidationIssue[];
  error_count: number;
  warning_count: number;
}

export function validateDocumentStyleKit(kit: DocumentStyleKit): StyleKitValidationResult {
  const issues: StyleKitValidationIssue[] = [];

  // Legal requirements
  if (!kit.legal.never_claim_legal_finality) {
    issues.push({
      field: "legal.never_claim_legal_finality",
      message: "Le style kit doit avoir never_claim_legal_finality=true.",
      severity: "error",
    });
  }
  if (!kit.legal.confidentiality_notice) {
    issues.push({
      field: "legal.confidentiality_notice",
      message: "Mention de confidentialité manquante.",
      severity: "warning",
    });
  }
  if (!kit.legal.official_document_disclaimer) {
    issues.push({
      field: "legal.official_document_disclaimer",
      message: "Disclaimer document officiel manquant.",
      severity: "warning",
    });
  }

  // Color validation
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  const colorFields: Array<[string, string]> = [
    ["color_system.primary_color_hex", kit.color_system.primary_color_hex],
    ["color_system.text_color_hex", kit.color_system.text_color_hex],
    ["color_system.background_color_hex", kit.color_system.background_color_hex],
  ];
  for (const [field, val] of colorFields) {
    if (!HEX.test(val)) {
      issues.push({ field, message: `Couleur invalide: ${val}`, severity: "error" });
    }
  }

  // Font
  if (!kit.typography.primary_font_family) {
    issues.push({
      field: "typography.primary_font_family",
      message: "Police principale non définie.",
      severity: "warning",
    });
  }

  // Page layout sanity
  if (kit.page_layout.margin_top_mm < 5 || kit.page_layout.margin_top_mm > 50) {
    issues.push({
      field: "page_layout.margin_top_mm",
      message: `Marge haut invalide: ${kit.page_layout.margin_top_mm}mm. Attendu: 5–50mm.`,
      severity: "warning",
    });
  }

  // Visual identity warning
  if (!kit.visual_identity.brand_mark_text && !kit.visual_identity.brand_asset_url) {
    issues.push({
      field: "visual_identity",
      message: "Aucune identité visuelle de marque configurée.",
      severity: "info",
    });
  }

  const error_count = issues.filter((i) => i.severity === "error").length;
  const warning_count = issues.filter((i) => i.severity === "warning").length;

  return {
    valid: error_count === 0,
    issues,
    error_count,
    warning_count,
  };
}

export function assertStyleKitSafe(kit: DocumentStyleKit): { safe: boolean; reason: string | null } {
  if (!kit.legal.never_claim_legal_finality) {
    return { safe: false, reason: "never_claim_legal_finality must be true" };
  }
  if (!kit.legal.confidentiality_notice) {
    return { safe: false, reason: "confidentiality_notice missing" };
  }
  return { safe: true, reason: null };
}
