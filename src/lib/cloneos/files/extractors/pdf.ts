// src/lib/cloneos/files/extractors/pdf.ts
// B37 — PDF text extraction using pdf-parse (dynamic import, server-side only).
// Falls back to mock if package unavailable or extraction fails.
// No OCR — scanned PDFs without embedded text return warning.

import type { FileExtractionResult } from "../types";

const DATE_PATTERN = /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{2}[/.-]\d{2})\b/g;
const AMOUNT_PATTERN = /\d[\d\s]*[,.]\d{2}\s*(?:€|EUR|euros?)|(?:€|EUR)\s*\d[\d\s]*[,.]\d{2}/gi;

function extractDates(text: string): string[] {
  return [...new Set(text.match(DATE_PATTERN) ?? [])].slice(0, 20);
}

function extractAmounts(text: string): string[] {
  return [...new Set((text.match(AMOUNT_PATTERN) ?? []).map((m) => m.trim()))].slice(0, 20);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function buildPreview(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars) + "…";
}

export async function extractTextFromPdf(
  content: Buffer,
  options: { previewChars: number; logText: boolean },
): Promise<FileExtractionResult> {
  if (!content || content.length === 0) {
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
      error: "Buffer PDF vide.",
    };
  }

  try {
    // Dynamic import — server-side only, avoids build issues
    const pdfParse = await import("pdf-parse").then((m) => m.default ?? m);
    const data = await pdfParse(content);

    const rawText: string = data.text ?? "";
    const pageCount: number = data.numpages ?? null;

    if (!rawText.trim()) {
      return {
        ok: true,
        text: null,
        preview: `[PDF ${pageCount ?? "?"} page(s) — aucun texte extrait. Probable PDF scanné sans couche texte.]`,
        page_count: pageCount,
        word_count: 0,
        table_count: null,
        detected_dates: [],
        detected_people: [],
        detected_companies: [],
        detected_amounts: [],
        warnings: ["PDF sans texte extractible — OCR requis pour les documents scannés."],
        error: null,
      };
    }

    const preview = buildPreview(rawText, options.previewChars);

    return {
      ok: true,
      text: options.logText ? rawText : null,
      preview,
      page_count: pageCount,
      word_count: countWords(rawText),
      table_count: null,
      detected_dates: extractDates(rawText),
      detected_people: [],
      detected_companies: [],
      detected_amounts: extractAmounts(rawText),
      warnings: [],
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If package not installed, fall through to mock-style result
    const isImportError = msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND") || msg.includes("MODULE_NOT_FOUND");

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
      warnings: isImportError ? ["pdf-parse non installé — extraction PDF indisponible."] : [],
      error: isImportError ? "pdf-parse non disponible." : `Erreur extraction PDF: ${msg}`,
    };
  }
}
