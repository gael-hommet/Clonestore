// src/lib/cloneos/files/extraction.ts
// B34 — File text extraction. Pure, no async.
// text/CSV: real extraction. PDF/DOCX/XLSX: mock (no heavy libs required).

import type { FileKind, FileExtractionResult } from "./types";
import type { FileConfig } from "./config";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DATE_PATTERN = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})\b/g;
const AMOUNT_PATTERN = /\d[\d\s]*[,\.]\d{2}\s*(?:€|EUR|euros?)|(?:€|EUR)\s*\d[\d\s]*[,\.]\d{2}/gi;

function extractDates(text: string): string[] {
  const matches = text.match(DATE_PATTERN) ?? [];
  return [...new Set(matches)].slice(0, 20);
}

function extractAmounts(text: string): string[] {
  const matches = text.match(AMOUNT_PATTERN) ?? [];
  return [...new Set(matches.map((m) => m.trim()))].slice(0, 20);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function buildPreview(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}

// ── text/plain ────────────────────────────────────────────────────────────────

export function extractTextFromPlain(content: string, previewChars: number): FileExtractionResult {
  const text = content.trim();
  if (!text) {
    return {
      ok: false,
      text: null,
      preview: null,
      page_count: null,
      word_count: 0,
      table_count: null,
      detected_dates: [],
      detected_people: [],
      detected_companies: [],
      detected_amounts: [],
      warnings: ["Fichier texte vide."],
      error: null,
    };
  }

  return {
    ok: true,
    text,
    preview: buildPreview(text, previewChars),
    page_count: null,
    word_count: countWords(text),
    table_count: null,
    detected_dates: extractDates(text),
    detected_people: [],
    detected_companies: [],
    detected_amounts: extractAmounts(text),
    warnings: [],
    error: null,
  };
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export function extractTextFromCsv(content: string, previewChars: number): FileExtractionResult {
  const lines = content.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return {
      ok: false, text: null, preview: null, page_count: null, word_count: 0,
      table_count: null, detected_dates: [], detected_people: [], detected_companies: [],
      detected_amounts: [], warnings: ["Fichier CSV vide."], error: null,
    };
  }

  const headers = lines[0].split(/[,;|\t]/).map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const rowCount = lines.length - 1;

  const summary = `CSV: ${headers.length} colonnes, ${rowCount} lignes\nColonnes: ${headers.join(", ")}\n\n${lines.slice(0, 10).join("\n")}`;
  const text = lines.join("\n");

  return {
    ok: true,
    text: buildPreview(text, 50_000),
    preview: buildPreview(summary, previewChars),
    page_count: null,
    word_count: rowCount,
    table_count: 1,
    detected_dates: extractDates(text),
    detected_people: [],
    detected_companies: [],
    detected_amounts: extractAmounts(text),
    warnings: rowCount > 10000 ? [`CSV volumineux: ${rowCount} lignes.`] : [],
    error: null,
  };
}

// ── Mock extraction (PDF, DOCX, etc.) ─────────────────────────────────────────

export function extractTextMock(kind: FileKind, filename: string, sizeBytes: number): FileExtractionResult {
  const kindLabel: Record<FileKind, string> = {
    pdf: "PDF",
    docx: "Word (DOCX)",
    doc: "Word (DOC)",
    xlsx: "Excel (XLSX)",
    csv: "CSV",
    image: "Image",
    text: "Texte",
    email_attachment: "Pièce jointe email",
    unknown: "fichier inconnu",
  };

  const label = kindLabel[kind] ?? kind;
  const sizeKb = Math.round(sizeBytes / 1024);

  return {
    ok: true,
    text: null,
    preview: `[Extraction ${label} simulée — fichier: ${filename}, taille: ${sizeKb} Ko. Extraction réelle nécessite des librairies supplémentaires.]`,
    page_count: null,
    word_count: null,
    table_count: null,
    detected_dates: [],
    detected_people: [],
    detected_companies: [],
    detected_amounts: [],
    warnings: [`Extraction ${label} en mode mock — texte complet non disponible.`],
    error: null,
  };
}

// ── Image extraction ──────────────────────────────────────────────────────────

function extractTextFromImage(filename: string, sizeBytes: number): FileExtractionResult {
  return {
    ok: true,
    text: null,
    preview: `[Image reçue: ${filename}, ${Math.round(sizeBytes / 1024)} Ko — OCR non disponible en mode mock.]`,
    page_count: null,
    word_count: null,
    table_count: null,
    detected_dates: [],
    detected_people: [],
    detected_companies: [],
    detected_amounts: [],
    warnings: ["Extraction de texte depuis image (OCR) non disponible en mode mock."],
    error: null,
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function extractFileText(
  kind: FileKind,
  content: string | Buffer,
  filename: string,
  config: FileConfig,
): FileExtractionResult {
  const sizeBytes = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, "utf8");
  const previewChars = config.text_preview_chars;

  try {
    if (kind === "text") {
      const text = Buffer.isBuffer(content) ? content.toString("utf8") : content;
      const result = extractTextFromPlain(text, previewChars);
      if (!config.log_extracted_text) {
        return { ...result, text: null };
      }
      return result;
    }

    if (kind === "csv") {
      const text = Buffer.isBuffer(content) ? content.toString("utf8") : content;
      const result = extractTextFromCsv(text, previewChars);
      if (!config.log_extracted_text) {
        return { ...result, text: null };
      }
      return result;
    }

    if (kind === "image") {
      return extractTextFromImage(filename, sizeBytes);
    }

    // pdf, docx, doc, xlsx, email_attachment, unknown → mock extraction
    return extractTextMock(kind, filename, sizeBytes);
  } catch (err) {
    return {
      ok: false,
      text: null,
      preview: null,
      page_count: null,
      word_count: null,
      table_count: null,
      detected_dates: [],
      detected_people: [],
      detected_companies: [],
      detected_amounts: [],
      warnings: [],
      error: err instanceof Error ? err.message : "Erreur d'extraction inconnue.",
    };
  }
}
