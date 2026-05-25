// src/lib/cloneos/files/__tests__/files-b37-real-extraction.test.ts
// B37 — Real extraction tests: text/CSV (always real), XLSX (if package available),
// PDF/DOCX graceful fallback, preview limits, word_count, log-text flag.
// No real files on disk. No real API calls. Fully self-contained.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  extractTextFromPlain,
  extractTextFromCsv,
  extractFileTextAsync,
} from "../extraction";
import { extractTextFromPdf } from "../extractors/pdf";
import { extractTextFromDocx } from "../extractors/docx";
import { extractTextFromXlsx } from "../extractors/xlsx";
import { getFileConfig } from "../config";

// ── 1. Plain text extraction ──────────────────────────────────────────────────

describe("extractTextFromPlain", () => {
  it("empty content returns ok=false", () => {
    const result = extractTextFromPlain("", 4000);
    expect(result.ok).toBe(false);
    expect(result.word_count).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("real text content returns ok=true with correct word_count", () => {
    const content = "Bonjour Alice. Votre contrat démarre le 01/06/2026. Salaire: 3 500,00 €.";
    const result = extractTextFromPlain(content, 4000);
    expect(result.ok).toBe(true);
    expect(result.word_count).toBeGreaterThan(5);
    expect(result.error).toBeNull();
  });

  it("preview is capped at previewChars", () => {
    const content = "A".repeat(500);
    const result = extractTextFromPlain(content, 100);
    expect(result.preview).not.toBeNull();
    expect((result.preview as string).length).toBeLessThanOrEqual(105); // 100 chars + "…"
    expect(result.preview).toContain("…");
  });

  it("detects dates and amounts in content", () => {
    const content = "Date: 15/06/2026 — montant: 1 200,50 € TTC.";
    const result = extractTextFromPlain(content, 4000);
    expect(result.detected_dates.length).toBeGreaterThan(0);
    expect(result.detected_amounts.length).toBeGreaterThan(0);
  });
});

// ── 2. CSV extraction ─────────────────────────────────────────────────────────

describe("extractTextFromCsv", () => {
  it("valid CSV returns ok=true with table_count=1", () => {
    const csv = "Nom,Prénom,Salaire\nAlice,Dupont,45000\nBob,Martin,52000\n";
    const result = extractTextFromCsv(csv, 4000);
    expect(result.ok).toBe(true);
    expect(result.table_count).toBe(1);
    expect(result.error).toBeNull();
  });

  it("empty CSV returns ok=false", () => {
    const result = extractTextFromCsv("", 4000);
    expect(result.ok).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("word_count = number of data rows (not header)", () => {
    const csv = "Nom,Salaire\nAlice,1000\nBob,2000\nCarole,3000\n";
    const result = extractTextFromCsv(csv, 4000);
    expect(result.word_count).toBe(3); // 3 data rows
  });
});

// ── 3. Async routing ──────────────────────────────────────────────────────────

describe("extractFileTextAsync — routing", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("routes 'text' kind to plain extraction", async () => {
    vi.stubEnv("FILE_LOG_EXTRACTED_TEXT", "true");
    const cfg = getFileConfig();
    const result = await extractFileTextAsync("text", "Bonjour le monde", "test.txt", cfg);
    expect(result.ok).toBe(true);
    expect(result.word_count).toBeGreaterThan(0);
  });

  it("routes 'csv' kind to csv extraction", async () => {
    vi.stubEnv("FILE_LOG_EXTRACTED_TEXT", "true");
    const cfg = getFileConfig();
    const csv = "Col1,Col2\nval1,val2\nval3,val4\n";
    const result = await extractFileTextAsync("csv", csv, "data.csv", cfg);
    expect(result.ok).toBe(true);
    expect(result.table_count).toBe(1);
  });

  it("FILE_LOG_EXTRACTED_TEXT=false → text field is null", async () => {
    vi.stubEnv("FILE_LOG_EXTRACTED_TEXT", "false");
    const cfg = getFileConfig();
    const result = await extractFileTextAsync("text", "Contenu sensible RH", "doc.txt", cfg);
    expect(result.ok).toBe(true);
    expect(result.text).toBeNull(); // privacy: text not logged
    expect(result.preview).not.toBeNull(); // preview still available
  });

  it("'unknown' kind falls through to mock (no throw)", async () => {
    const cfg = getFileConfig();
    const result = await extractFileTextAsync("unknown", Buffer.from("anything"), "file.bin", cfg);
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("warnings");
  });
});

// ── 4. Buffer validation (no package needed) ──────────────────────────────────

describe("extractTextFromPdf — empty buffer guard", () => {
  it("empty buffer returns ok=false with error message", async () => {
    const result = await extractTextFromPdf(Buffer.alloc(0), { previewChars: 4000, logText: false });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("PDF");
  });
});

describe("extractTextFromDocx — empty buffer guard", () => {
  it("empty buffer returns ok=false with error message", async () => {
    const result = await extractTextFromDocx(Buffer.alloc(0), { previewChars: 4000, logText: false });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("DOCX");
  });
});

describe("extractTextFromXlsx — empty buffer guard", () => {
  it("empty buffer returns ok=false with error message", async () => {
    const result = await extractTextFromXlsx(Buffer.alloc(0), { previewChars: 4000, logText: false });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("XLSX");
  });
});

// ── 5. Graceful error handling (no throw on bad input) ────────────────────────

describe("extractTextFromPdf — invalid buffer graceful error", () => {
  it("invalid PDF bytes return ok=false without throwing", async () => {
    const invalidBuffer = Buffer.from("this is not a real PDF document");
    const result = await extractTextFromPdf(invalidBuffer, { previewChars: 4000, logText: false });
    // Must not throw — either parse error or import error
    expect(result).toHaveProperty("ok", false);
    expect(result.error).not.toBeNull();
    expect(result.warnings).toBeInstanceOf(Array);
  });
});

// ── 6. XLSX real extraction (conditional on xlsx package) ────────────────────

describe("extractTextFromXlsx — real workbook extraction", () => {
  it("extracts sheet names, rows, and table_count from in-memory workbook", async () => {
    let XLSX: typeof import("xlsx") | null = null;
    try {
      XLSX = await import("xlsx");
    } catch {
      // xlsx package not installed in this environment — skip real extraction test
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nom", "Poste", "Salaire"],
      ["Alice Dupont", "DRH", "75000"],
      ["Bob Martin", "Ingénieur", "62000"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Employés");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = await extractTextFromXlsx(buffer, { previewChars: 4000, logText: true });
    expect(result.ok).toBe(true);
    expect(result.table_count).toBe(1);
    expect(result.preview).toContain("Employés");
    expect(result.text).toContain("Alice");
  });

  it("multi-sheet workbook: table_count reflects sheet count", async () => {
    let XLSX: typeof import("xlsx") | null = null;
    try {
      XLSX = await import("xlsx");
    } catch {
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([["A", "B"], ["1", "2"]]);
    const ws2 = XLSX.utils.aoa_to_sheet([["X", "Y"], ["3", "4"]]);
    XLSX.utils.book_append_sheet(wb, ws1, "Feuille1");
    XLSX.utils.book_append_sheet(wb, ws2, "Feuille2");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = await extractTextFromXlsx(buffer, { previewChars: 4000, logText: false });
    expect(result.ok).toBe(true);
    expect(result.table_count).toBe(2);
    expect(result.text).toBeNull(); // logText=false
  });
});
