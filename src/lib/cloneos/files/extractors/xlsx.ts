// src/lib/cloneos/files/extractors/xlsx.ts
// B37 — XLSX text extraction using xlsx (SheetJS, dynamic import, server-side only).
// Extracts sheet names, cell values, and produces a text summary.

import type { FileExtractionResult } from "../types";

function buildPreview(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars) + "…";
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

export async function extractTextFromXlsx(
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
      error: "Buffer XLSX vide.",
    };
  }

  try {
    const XLSX = await import("xlsx");

    const workbook = XLSX.read(content, { type: "buffer", cellDates: true });

    const sheetNames: string[] = workbook.SheetNames ?? [];
    const tableCount = sheetNames.length;

    if (tableCount === 0) {
      return {
        ok: true,
        text: null,
        preview: "[XLSX sans feuille de calcul.]",
        page_count: null,
        word_count: 0,
        table_count: 0,
        detected_dates: [],
        detected_people: [],
        detected_companies: [],
        detected_amounts: [],
        warnings: ["XLSX sans feuille détectée."],
        error: null,
      };
    }

    // Extract text from each sheet (limit to first 5 sheets, first 200 rows each)
    const sheetTexts: string[] = [];

    for (const sheetName of sheetNames.slice(0, 5)) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      }) as unknown[][];

      const sheetLines = rows
        .slice(0, 200)
        .map((row) =>
          row
            .map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : ""))
            .filter((c) => c.length > 0)
            .join(" | "),
        )
        .filter((line) => line.length > 0);

      if (sheetLines.length > 0) {
        sheetTexts.push(`=== Feuille: ${sheetName} (${rows.length} lignes) ===\n${sheetLines.join("\n")}`);
      }
    }

    const fullText = sheetTexts.join("\n\n");
    const summary = `XLSX: ${tableCount} feuille(s): ${sheetNames.join(", ")}\n\n${buildPreview(fullText, 2000)}`;

    return {
      ok: true,
      text: options.logText ? fullText : null,
      preview: buildPreview(summary, options.previewChars),
      page_count: null,
      word_count: countWords(fullText),
      table_count: tableCount,
      detected_dates: [],
      detected_people: [],
      detected_companies: [],
      detected_amounts: [],
      warnings: tableCount > 5 ? [`XLSX: ${tableCount} feuilles, seules les 5 premières extraites.`] : [],
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
      warnings: isImportError ? ["xlsx non installé — extraction XLSX indisponible."] : [],
      error: isImportError ? "xlsx non disponible." : `Erreur extraction XLSX: ${msg}`,
    };
  }
}
