// B45 — Document Style Kit normalizer / merge
// Pure: no async, no Supabase, no Next.js, no side effects.

import type { DocumentStyleKit } from "./types";
import { createDefaultDocumentStyleKit } from "./defaults";
import { sanitizeStyleKitInput, normalizeHexColor } from "./sanitize";
import { computeStyleKitCompletion } from "./style-kit-validation";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

// ── Normalize ─────────────────────────────────────────────────────────────────

export function normalizeDocumentStyleKit(
  raw: unknown,
  userId: string,
): DocumentStyleKit {
  const now = new Date().toISOString();
  const defaults = createDefaultDocumentStyleKit({ user_id: userId });

  if (!isObject(raw)) {
    defaults.completion = computeStyleKitCompletion(defaults);
    return defaults;
  }

  const kit: DocumentStyleKit = { ...defaults };

  if (isString(raw.id)) kit.id = raw.id;
  kit.user_id = userId; // Never from client
  if (isNumber(raw.version)) kit.version = raw.version;

  // visual_identity
  if (isObject(raw.visual_identity)) {
    const vi = raw.visual_identity;
    kit.visual_identity = {
      brand_mark_text: isString(vi.brand_mark_text) ? vi.brand_mark_text.slice(0, 200) : defaults.visual_identity.brand_mark_text,
      brand_asset_id: isString(vi.brand_asset_id) ? vi.brand_asset_id : defaults.visual_identity.brand_asset_id,
      brand_asset_url: isString(vi.brand_asset_url) ? vi.brand_asset_url : defaults.visual_identity.brand_asset_url,
      brand_asset_alt: isString(vi.brand_asset_alt) ? vi.brand_asset_alt.slice(0, 200) : defaults.visual_identity.brand_asset_alt,
      show_brand_mark: isBoolean(vi.show_brand_mark) ? vi.show_brand_mark : defaults.visual_identity.show_brand_mark,
      brand_notes: isString(vi.brand_notes) ? vi.brand_notes.slice(0, 500) : null,
    };
  }

  // typography
  if (isObject(raw.typography)) {
    const t = raw.typography;
    kit.typography = {
      primary_font_family: isString(t.primary_font_family) ? t.primary_font_family.slice(0, 200) : defaults.typography.primary_font_family,
      secondary_font_family: isString(t.secondary_font_family) ? t.secondary_font_family.slice(0, 200) : null,
      fallback_font_family: isString(t.fallback_font_family) ? t.fallback_font_family.slice(0, 200) : defaults.typography.fallback_font_family,
      base_font_size_px: isNumber(t.base_font_size_px) ? Math.max(8, Math.min(24, t.base_font_size_px)) : defaults.typography.base_font_size_px,
      title_scale: isNumber(t.title_scale) ? Math.max(1, Math.min(3, t.title_scale)) : defaults.typography.title_scale,
      line_height: isNumber(t.line_height) ? Math.max(1, Math.min(3, t.line_height)) : defaults.typography.line_height,
      heading_weight: isNumber(t.heading_weight) ? Math.max(100, Math.min(900, t.heading_weight)) : defaults.typography.heading_weight,
      body_weight: isNumber(t.body_weight) ? Math.max(100, Math.min(900, t.body_weight)) : defaults.typography.body_weight,
    };
  }

  // color_system
  if (isObject(raw.color_system)) {
    const cs = raw.color_system;
    const d = defaults.color_system;
    kit.color_system = {
      primary_color_hex: normalizeHexColor(cs.primary_color_hex, d.primary_color_hex),
      secondary_color_hex: normalizeHexColor(cs.secondary_color_hex, d.secondary_color_hex),
      accent_color_hex: normalizeHexColor(cs.accent_color_hex, d.accent_color_hex),
      text_color_hex: normalizeHexColor(cs.text_color_hex, d.text_color_hex),
      muted_text_color_hex: normalizeHexColor(cs.muted_text_color_hex, d.muted_text_color_hex),
      border_color_hex: normalizeHexColor(cs.border_color_hex, d.border_color_hex),
      background_color_hex: normalizeHexColor(cs.background_color_hex, d.background_color_hex),
      surface_color_hex: normalizeHexColor(cs.surface_color_hex, d.surface_color_hex),
    };
  }

  // legal
  if (isObject(raw.legal)) {
    const l = raw.legal;
    kit.legal = {
      confidentiality_notice: isString(l.confidentiality_notice) ? l.confidentiality_notice.slice(0, 1000) : defaults.legal.confidentiality_notice,
      legal_footer_text: isString(l.legal_footer_text) ? l.legal_footer_text.slice(0, 2000) : null,
      official_document_disclaimer: isString(l.official_document_disclaimer) ? l.official_document_disclaimer.slice(0, 1000) : defaults.legal.official_document_disclaimer,
      require_human_validation_for_official: isBoolean(l.require_human_validation_for_official) ? l.require_human_validation_for_official : true,
      never_claim_legal_finality: true, // Always enforced
      dsn_disclaimer: isString(l.dsn_disclaimer) ? l.dsn_disclaimer.slice(0, 1000) : defaults.legal.dsn_disclaimer,
      payroll_disclaimer: isString(l.payroll_disclaimer) ? l.payroll_disclaimer.slice(0, 1000) : defaults.legal.payroll_disclaimer,
    };
  }

  if (isString(raw.created_at)) kit.created_at = raw.created_at;
  kit.updated_at = now;

  kit.completion = computeStyleKitCompletion(kit);
  kit.status = kit.completion.status;

  return kit;
}

// ── Merge patch ───────────────────────────────────────────────────────────────

export function mergeDocumentStyleKitPatch(
  base: DocumentStyleKit,
  patch: Record<string, unknown>,
): DocumentStyleKit {
  const now = new Date().toISOString();
  const sanitized = sanitizeStyleKitInput(patch);

  const updated: DocumentStyleKit = { ...base, updated_at: now };

  if (isObject(sanitized.visual_identity)) {
    updated.visual_identity = { ...base.visual_identity, ...sanitized.visual_identity };
  }
  if (isObject(sanitized.typography)) {
    updated.typography = { ...base.typography, ...sanitized.typography };
  }
  if (isObject(sanitized.color_system)) {
    updated.color_system = { ...base.color_system, ...sanitized.color_system };
  }
  if (isObject(sanitized.page_layout)) {
    updated.page_layout = { ...base.page_layout, ...sanitized.page_layout };
  }
  if (isObject(sanitized.header)) {
    updated.header = { ...base.header, ...sanitized.header };
  }
  if (isObject(sanitized.footer)) {
    updated.footer = { ...base.footer, ...sanitized.footer };
  }
  if (isObject(sanitized.signature)) {
    updated.signature = { ...base.signature, ...sanitized.signature };
  }
  if (isObject(sanitized.tables)) {
    updated.tables = { ...base.tables, ...sanitized.tables };
  }
  if (isObject(sanitized.legal)) {
    const mergedLegal = { ...base.legal, ...sanitized.legal };
    mergedLegal.never_claim_legal_finality = true; // Always enforced
    updated.legal = mergedLegal;
  }
  if (isObject(sanitized.tone)) {
    updated.tone = { ...base.tone, ...sanitized.tone };
  }

  updated.completion = computeStyleKitCompletion(updated);
  updated.status = updated.completion.status;

  return updated;
}
