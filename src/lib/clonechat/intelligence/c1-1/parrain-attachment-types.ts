// src/lib/clonechat/intelligence/c1-1/parrain-attachment-types.ts
// C1.1 — Pièces jointes : contrats + matrice de support HONNÊTE. Un format sans parseur
// installé et testé n'est JAMAIS annoncé comme pris en charge. PPTX : non pris en charge
// (aucun parseur approuvé dans le repo). Les images passent par le pipeline multimodal
// existant (aucune seconde pile OpenAI).

export const ATTACHMENT_SUPPORT_STATUSES = [
  "fully_parsed",
  "text_extracted",
  "structured_partial",
  "image_only",
  "metadata_only",
  "unsupported",
  "parse_failed",
  "manual_review_required",
] as const;
export type AttachmentSupportStatus = (typeof ATTACHMENT_SUPPORT_STATUSES)[number];

export type AttachmentFormat = "pdf" | "docx" | "xlsx" | "csv" | "txt" | "md" | "png" | "jpeg" | "webp" | "pptx" | "unknown";

/** Matrice de support HONNÊTE — dérivée des parseurs réellement installés (package.json). */
export const ATTACHMENT_SUPPORT_MATRIX: Readonly<Record<AttachmentFormat, { readonly expected: AttachmentSupportStatus; readonly parser: string | null; readonly note: string }>> = Object.freeze({
  pdf: { expected: "text_extracted", parser: "pdf-parse", note: "Texte natif extrait avec références de pages ; pas d'OCR automatique — les pages image passent par le pipeline visuel, marquées basse confiance." },
  docx: { expected: "text_extracted", parser: "mammoth", note: "Paragraphes et titres extraits ; tableaux aplatis en texte avec références de sections." },
  xlsx: { expected: "structured_partial", parser: "xlsx", note: "Valeurs affichées uniquement — AUCUNE formule exécutée ; références feuille/ligne/colonne conservées ; grandes tables bornées et résumées." },
  csv: { expected: "fully_parsed", parser: "native", note: "Lignes/colonnes bornées ; valeurs brutes uniquement." },
  txt: { expected: "fully_parsed", parser: "native", note: "Texte brut borné." },
  md: { expected: "fully_parsed", parser: "native", note: "Markdown lu comme texte structuré léger." },
  png: { expected: "image_only", parser: "pipeline multimodal existant (sharp + vision)", note: "Compréhension visuelle via le pipeline sanitisé existant — jamais de texte invisible prétendu lu." },
  jpeg: { expected: "image_only", parser: "pipeline multimodal existant (sharp + vision)", note: "Idem PNG." },
  webp: { expected: "image_only", parser: "pipeline multimodal existant (sharp + vision)", note: "Idem PNG." },
  pptx: { expected: "unsupported", parser: null, note: "Aucun parseur PPTX approuvé installé — refus honnête." },
  unknown: { expected: "unsupported", parser: null, note: "Format non reconnu — refus honnête, jamais de contenu inventé." },
});

export interface ParrainAttachment {
  readonly attachmentId: string;
  readonly companyId: string;
  readonly conversationId: string | null;
  readonly uploadedBy: string | null;
  readonly filename: string;
  readonly declaredMime: string;
  readonly detectedMime: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly supportStatus: AttachmentSupportStatus;
  readonly format: AttachmentFormat;
  readonly pageCount: number | null;
  readonly sheetCount: number | null;
  readonly extractedTextLength: number;
  readonly parserVersion: string;
  readonly sanitized: boolean;
  readonly warnings: readonly string[];
  readonly createdAt: string;
}

export interface ParrainAttachmentChunk {
  readonly attachmentId: string;
  /** Référence de provenance : page N / feuille S ligne R / section T. */
  readonly ref: string;
  readonly text: string;
  readonly table: readonly (readonly string[])[] | null;
  readonly contentHash: string;
  readonly citationLabel: string;
  readonly visibility: "COMPANY_SCOPED";
  readonly extractionConfidence: "high" | "medium" | "low";
}

export interface AttachmentIngestionResult {
  readonly attachment: ParrainAttachment;
  readonly chunks: readonly ParrainAttachmentChunk[];
  readonly honestSummary: string;
}

/** Requête d'ingestion (le companyId vient du serveur, jamais du client). */
export interface AttachmentIngestionInput {
  readonly filename: string;
  readonly declaredMime: string;
  readonly bytes: Uint8Array;
  readonly companyId: string;
  readonly conversationId: string | null;
  readonly uploadedBy: string | null;
  readonly at: string;
}
