// src/lib/cloneos/files/extractors/docx.ts
// B37 — DOCX text extraction using mammoth (dynamic import, server-side only).
// Falls back gracefully if package unavailable or buffer invalid.

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

export async function extractTextFromDocx(
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
      error: "Buffer DOCX vide.",
    };
  }

  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: content });

    const rawText: string = result.value ?? "";
    const messages = result.messages ?? [];

    const warnings: string[] = messages
      .filter((m: { type: string; message: string }) => m.type === "warning")
      .map((m: { type: string; message: string }) => `mammoth: ${m.message}`)
      .slice(0, 5);

    if (!rawText.trim()) {
      return {
        ok: true,
        text: null,
        preview: "[DOCX vide ou sans contenu texte extractible.]",
        page_count: null,
        word_count: 0,
        table_count: null,
        detected_dates: [],
        detected_people: [],
        detected_companies: [],
        detected_amounts: [],
        warnings: ["DOCX sans texte extractible."],
        error: null,
      };
    }

    const preview = buildPreview(rawText, options.previewChars);

    return {
      ok: true,
      text: options.logText ? rawText : null,
      preview,
      page_count: null,
      word_count: countWords(rawText),
      table_count: null,
      detected_dates: extractDates(rawText),
      detected_people: [],
      detected_companies: [],
      detected_amounts: extractAmounts(rawText),
      warnings,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
      warnings: isImportError ? ["mammoth non installé — extraction DOCX indisponible."] : [],
      error: isImportError ? "mammoth non disponible." : `Erreur extraction DOCX: ${msg}`,
    };
  }
}
