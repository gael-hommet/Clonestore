// B45 — Document Style Kit reference sources
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  ReferenceDocumentSource,
  DocumentReferenceSourceType,
  ReferenceSourceCoverage,
} from "./types";

const MIME_TO_SOURCE_TYPE: Record<string, DocumentReferenceSourceType> = {
  "application/pdf": "other",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "contract_template",
  "application/msword": "contract_template",
  "image/png": "letterhead",
  "image/jpeg": "letterhead",
  "image/svg+xml": "brand_guidelines",
  "text/plain": "internal_note_template",
  "text/csv": "table_template",
  "application/vnd.ms-excel": "table_template",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "table_template",
};

// ── Build from file metadata ──────────────────────────────────────────────────

export function buildReferenceSourceFromFileMetadata(params: {
  file_id: string;
  file_name: string;
  mime_type: string | null;
  extracted_text_preview?: string | null;
  label?: string | null;
  trusted?: boolean;
}): ReferenceDocumentSource {
  const { file_id, file_name, mime_type, extracted_text_preview, label, trusted } = params;
  const source_type = classifyReferenceSource(file_name, mime_type);
  const now = new Date().toISOString();

  return {
    id: `ref_${file_id}`,
    source_type,
    label: label ?? file_name,
    file_id,
    file_name,
    mime_type: mime_type ?? null,
    extracted_text_preview: extracted_text_preview
      ? extracted_text_preview.slice(0, 500)
      : null,
    extracted_structure: null,
    style_notes: null,
    trusted: trusted ?? false,
    uploaded_at: now,
  };
}

// ── Classify source type ──────────────────────────────────────────────────────

export function classifyReferenceSource(
  fileName: string,
  mimeType: string | null,
): DocumentReferenceSourceType {
  const lower = (fileName ?? "").toLowerCase();

  // By filename keyword
  if (lower.includes("bulletin") || lower.includes("fiche_paie") || lower.includes("payslip")) {
    return "payslip_sample";
  }
  if (lower.includes("attestation") || lower.includes("certificate")) {
    return "employment_certificate";
  }
  if (lower.includes("contrat") || lower.includes("contract")) {
    return "contract_template";
  }
  if (lower.includes("avenant") || lower.includes("amendment")) {
    return "amendment_template";
  }
  if (lower.includes("note_interne") || lower.includes("internal_note")) {
    return "internal_note_template";
  }
  if (lower.includes("politique") || lower.includes("policy") || lower.includes("rh_")) {
    return "HR_policy";
  }
  if (lower.includes("entete") || lower.includes("letterhead") || lower.includes("papier_a_en_tete")) {
    return "letterhead";
  }
  if (lower.includes("pied_de_page") || lower.includes("footer")) {
    return "footer";
  }
  if (lower.includes("signature")) {
    return "email_signature";
  }
  if (lower.includes("brand") || lower.includes("charte") || lower.includes("identite")) {
    return "brand_guidelines";
  }
  if (lower.includes("tableau") || lower.includes("table") || lower.includes("grille")) {
    return "table_template";
  }

  // By mime type
  if (mimeType && MIME_TO_SOURCE_TYPE[mimeType]) {
    return MIME_TO_SOURCE_TYPE[mimeType];
  }

  return "other";
}

// ── Summarize reference sources ───────────────────────────────────────────────

export function summarizeReferenceSources(
  sources: ReferenceDocumentSource[],
): Record<DocumentReferenceSourceType, number> {
  const counts: Record<string, number> = {};
  for (const src of sources) {
    counts[src.source_type] = (counts[src.source_type] ?? 0) + 1;
  }
  return counts as Record<DocumentReferenceSourceType, number>;
}

// ── Compute coverage ──────────────────────────────────────────────────────────

const ALL_SOURCE_TYPES: DocumentReferenceSourceType[] = [
  "payslip_sample",
  "employment_certificate",
  "contract_template",
  "amendment_template",
  "internal_note_template",
  "HR_policy",
  "letterhead",
  "footer",
  "email_signature",
  "brand_guidelines",
  "table_template",
  "other",
];

export function computeReferenceSourceCoverage(
  sources: ReferenceDocumentSource[],
): ReferenceSourceCoverage {
  const types = new Set(sources.map((s) => s.source_type));
  const missing_types = ALL_SOURCE_TYPES.filter(
    (t) => t !== "other" && !types.has(t),
  ) as DocumentReferenceSourceType[];

  const has_payslip = types.has("payslip_sample");
  const has_certificate = types.has("employment_certificate");
  const has_contract = types.has("contract_template");
  const has_letterhead = types.has("letterhead");
  const has_footer = types.has("footer");
  const has_brand_guidelines = types.has("brand_guidelines");

  const premium_complete =
    has_payslip && has_certificate && has_contract && has_letterhead;

  return {
    total: sources.length,
    has_payslip,
    has_certificate,
    has_contract,
    has_letterhead,
    has_footer,
    has_brand_guidelines,
    missing_types,
    premium_complete,
  };
}

// ── Map B44 document prep to style sources ────────────────────────────────────

export function mapB44DocumentPrepToStyleSources(params: {
  brand_asset_url?: string | null;
  brand_asset_alt?: string | null;
  legal_footer_text?: string | null;
  signature_template?: string | null;
  user_id: string;
}): ReferenceDocumentSource[] {
  const sources: ReferenceDocumentSource[] = [];
  const now = new Date().toISOString();

  if (params.brand_asset_url) {
    sources.push({
      id: `ref_brand_${params.user_id}`,
      source_type: "brand_guidelines",
      label: "Asset visuel de marque (B44)",
      file_id: null,
      file_name: null,
      mime_type: null,
      extracted_text_preview: params.brand_asset_alt ?? null,
      extracted_structure: { brand_asset_url: params.brand_asset_url },
      style_notes: "Importé automatiquement depuis l'empreinte entreprise B44.",
      trusted: true,
      uploaded_at: now,
    });
  }

  if (params.signature_template) {
    sources.push({
      id: `ref_signature_${params.user_id}`,
      source_type: "email_signature",
      label: "Modèle de signature (B44)",
      file_id: null,
      file_name: null,
      mime_type: null,
      extracted_text_preview: params.signature_template.slice(0, 200),
      extracted_structure: { signature_template: params.signature_template },
      style_notes: "Importé automatiquement depuis l'empreinte entreprise B44.",
      trusted: true,
      uploaded_at: now,
    });
  }

  if (params.legal_footer_text) {
    sources.push({
      id: `ref_footer_${params.user_id}`,
      source_type: "footer",
      label: "Pied de page légal (B44)",
      file_id: null,
      file_name: null,
      mime_type: null,
      extracted_text_preview: params.legal_footer_text.slice(0, 200),
      extracted_structure: { legal_footer_text: params.legal_footer_text },
      style_notes: "Importé automatiquement depuis l'empreinte entreprise B44.",
      trusted: true,
      uploaded_at: now,
    });
  }

  return sources;
}
