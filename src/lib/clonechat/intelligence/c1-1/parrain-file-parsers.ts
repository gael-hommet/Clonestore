// src/lib/clonechat/intelligence/c1-1/parrain-file-parsers.ts
// C1.1 — Parseurs de fichiers RÉELLEMENT installés : pdf-parse (PDF texte natif),
// mammoth (DOCX paragraphes/tableaux), xlsx (valeurs affichées, JAMAIS de formule
// exécutée), CSV/TXT/MD natifs. Imports DYNAMIQUES (serveur uniquement, jamais dans un
// bundle client). Tout échec → parse_failed honnête, jamais de contenu fabriqué.

import { ATTACHMENT_LIMITS, neutralizeLinks, withExtractionTimeout } from "./parrain-attachment-policy";
import type { AttachmentFormat, AttachmentSupportStatus } from "./parrain-attachment-types";

export interface ParsedChunkRaw {
  readonly ref: string;
  readonly text: string;
  readonly table: readonly (readonly string[])[] | null;
  readonly confidence: "high" | "medium" | "low";
}

export interface ParseOutcome {
  readonly supportStatus: AttachmentSupportStatus;
  readonly chunks: readonly ParsedChunkRaw[];
  readonly pageCount: number | null;
  readonly sheetCount: number | null;
  readonly warnings: readonly string[];
  readonly parserVersion: string;
}

const failed = (warning: string, parserVersion: string): ParseOutcome =>
  Object.freeze({ supportStatus: "parse_failed", chunks: [], pageCount: null, sheetCount: null, warnings: [warning], parserVersion });

function boundText(text: string, warnings: string[]): string {
  if (text.length > ATTACHMENT_LIMITS.maxExtractedChars) {
    warnings.push(`Texte extrait tronqué à ${ATTACHMENT_LIMITS.maxExtractedChars} caractères (protection anti-bombe).`);
    return text.slice(0, ATTACHMENT_LIMITS.maxExtractedChars);
  }
  return text;
}

function paragraphChunks(text: string, refPrefix: string, confidence: "high" | "medium" | "low"): ParsedChunkRaw[] {
  const chunks: ParsedChunkRaw[] = [];
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
  let buffer = "";
  let section = 1;
  for (const p of paragraphs) {
    if (buffer.length + p.length > ATTACHMENT_LIMITS.maxChunkChars && buffer.length > 0) {
      chunks.push({ ref: `${refPrefix} §${section}`, text: neutralizeLinks(buffer), table: null, confidence });
      buffer = "";
      section += 1;
      if (chunks.length >= ATTACHMENT_LIMITS.maxChunksPerAttachment) break;
    }
    buffer = buffer ? `${buffer}\n${p}` : p;
  }
  if (buffer && chunks.length < ATTACHMENT_LIMITS.maxChunksPerAttachment) {
    chunks.push({ ref: `${refPrefix} §${section}`, text: neutralizeLinks(buffer), table: null, confidence });
  }
  return chunks;
}

// ── PDF : texte natif d'abord, références de pages conservées, pas d'OCR auto ──
export async function parsePdf(bytes: Uint8Array): Promise<ParseOutcome> {
  const version = "pdf-parse@1.x";
  try {
    const mod = await import("pdf-parse");
    const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text: string; numpages: number }> }).default ?? (mod as unknown as (b: Buffer) => Promise<{ text: string; numpages: number }>);
    const warnings: string[] = [];
    const result = await withExtractionTimeout(pdfParse(Buffer.from(bytes)));
    if (result.numpages > ATTACHMENT_LIMITS.maxPdfPages) {
      warnings.push(`PDF de ${result.numpages} pages — seules les ${ATTACHMENT_LIMITS.maxPdfPages} premières sont considérées.`);
    }
    const text = boundText(result.text ?? "", warnings);
    if (text.trim().length === 0) {
      return Object.freeze({
        supportStatus: "image_only" as const,
        chunks: [],
        pageCount: result.numpages,
        sheetCount: null,
        warnings: [...warnings, "Aucun texte natif détecté (PDF scanné ?) — analyse visuelle possible via capture d'écran, marquée basse confiance."],
        parserVersion: version,
      });
    }
    // pdf-parse concatène le texte ; on approxime les références de pages par répartition.
    const pages = Math.min(result.numpages, ATTACHMENT_LIMITS.maxPdfPages);
    const perPage = Math.ceil(text.length / Math.max(1, pages));
    const chunks: ParsedChunkRaw[] = [];
    for (let p = 0; p < pages && chunks.length < ATTACHMENT_LIMITS.maxChunksPerAttachment; p += 1) {
      const slice = text.slice(p * perPage, (p + 1) * perPage).trim();
      if (slice) chunks.push({ ref: `page ${p + 1}`, text: neutralizeLinks(slice.slice(0, ATTACHMENT_LIMITS.maxChunkChars)), table: null, confidence: "high" });
    }
    return Object.freeze({ supportStatus: "text_extracted" as const, chunks, pageCount: result.numpages, sheetCount: null, warnings, parserVersion: version });
  } catch {
    return failed("Extraction PDF impossible (fichier corrompu, protégé ou délai dépassé).", version);
  }
}

// ── DOCX : paragraphes/titres via mammoth (aucune macro, jamais exécuté) ───────
export async function parseDocx(bytes: Uint8Array): Promise<ParseOutcome> {
  const version = "mammoth@1.x";
  try {
    const mammoth = (await import("mammoth")) as unknown as {
      extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages: readonly unknown[] }>;
    };
    const warnings: string[] = [];
    const result = await withExtractionTimeout(mammoth.extractRawText({ buffer: Buffer.from(bytes) }));
    const text = boundText(result.value ?? "", warnings);
    if (text.trim().length === 0) return failed("Document DOCX sans texte extractible.", version);
    return Object.freeze({
      supportStatus: "text_extracted" as const,
      chunks: paragraphChunks(text, "section", "high"),
      pageCount: null,
      sheetCount: null,
      warnings,
      parserVersion: version,
    });
  } catch {
    return failed("Extraction DOCX impossible (fichier corrompu ou délai dépassé).", version);
  }
}

// ── XLSX : valeurs AFFICHÉES uniquement — jamais de formule exécutée ───────────
export async function parseXlsx(bytes: Uint8Array): Promise<ParseOutcome> {
  const version = "xlsx@0.18";
  try {
    const XLSX = await import("xlsx");
    const warnings: string[] = [];
    const wb = await withExtractionTimeout(
      Promise.resolve(XLSX.read(bytes, { type: "array", cellFormula: false, cellHTML: false, dense: false })),
    );
    const sheetNames = wb.SheetNames.slice(0, ATTACHMENT_LIMITS.maxSheets);
    if (wb.SheetNames.length > sheetNames.length) warnings.push(`Classeur de ${wb.SheetNames.length} feuilles — bornées à ${sheetNames.length}.`);
    const chunks: ParsedChunkRaw[] = [];
    let totalCells = 0;
    for (const name of sheetNames) {
      const sheet = wb.Sheets[name];
      // raw:false → valeurs telles qu'affichées (les formules ne sont JAMAIS recalculées :
      // on lit la valeur en cache ; cellFormula:false ne charge même pas la formule).
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" }) as string[][];
      const bounded = rows.slice(0, ATTACHMENT_LIMITS.maxRowsPerSheet);
      if (rows.length > bounded.length) warnings.push(`Feuille « ${name} » : ${rows.length} lignes — bornées à ${bounded.length}.`);
      const table: string[][] = [];
      for (let r = 0; r < bounded.length; r += 1) {
        const row = (bounded[r] ?? []).map((c) => String(c ?? "").slice(0, 120));
        totalCells += row.length;
        if (totalCells > ATTACHMENT_LIMITS.maxCellsTotal) {
          warnings.push("Budget de cellules atteint — le reste du classeur n'est pas envoyé au modèle mais reste référencé.");
          break;
        }
        table.push(row);
      }
      const preview = table.slice(0, 12).map((row, i) => `L${i + 1}: ${row.filter(Boolean).join(" | ")}`).join("\n");
      chunks.push({
        ref: `feuille « ${name} »`,
        text: neutralizeLinks(`Feuille « ${name} » — ${table.length} lignes lues (valeurs affichées, aucune formule exécutée).\n${preview}`).slice(0, ATTACHMENT_LIMITS.maxChunkChars),
        table,
        confidence: "high",
      });
      if (chunks.length >= ATTACHMENT_LIMITS.maxChunksPerAttachment) break;
    }
    if (chunks.length === 0) return failed("Classeur vide ou illisible.", version);
    return Object.freeze({ supportStatus: "structured_partial" as const, chunks, pageCount: null, sheetCount: wb.SheetNames.length, warnings, parserVersion: version });
  } catch {
    return failed("Extraction XLSX impossible (fichier corrompu ou délai dépassé).", version);
  }
}

// ── CSV : natif, borné, valeurs brutes ────────────────────────────────────────
export function parseCsv(bytes: Uint8Array): ParseOutcome {
  const version = "native-csv";
  try {
    const warnings: string[] = [];
    const text = boundText(new TextDecoder("utf-8", { fatal: false }).decode(bytes), warnings);
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    const bounded = lines.slice(0, ATTACHMENT_LIMITS.maxRowsPerSheet);
    if (lines.length > bounded.length) warnings.push(`CSV de ${lines.length} lignes — bornées à ${bounded.length}.`);
    const sep = (bounded[0]?.includes(";") ? ";" : ",");
    const table = bounded.map((l) => l.split(sep).map((c) => c.trim().slice(0, 120)).slice(0, 50));
    const preview = table.slice(0, 15).map((row, i) => `L${i + 1}: ${row.join(" | ")}`).join("\n");
    return Object.freeze({
      supportStatus: "fully_parsed" as const,
      chunks: [{ ref: `lignes 1–${table.length}`, text: neutralizeLinks(preview).slice(0, ATTACHMENT_LIMITS.maxChunkChars), table, confidence: "high" as const }],
      pageCount: null,
      sheetCount: 1,
      warnings,
      parserVersion: version,
    });
  } catch {
    return failed("Lecture CSV impossible.", version);
  }
}

// ── TXT / MD : natif ──────────────────────────────────────────────────────────
export function parsePlainText(bytes: Uint8Array, format: "txt" | "md"): ParseOutcome {
  const version = "native-text";
  try {
    const warnings: string[] = [];
    const text = boundText(new TextDecoder("utf-8", { fatal: false }).decode(bytes), warnings);
    if (text.trim().length === 0) return failed("Fichier texte vide.", version);
    return Object.freeze({
      supportStatus: "fully_parsed" as const,
      chunks: paragraphChunks(text, format === "md" ? "section" : "bloc", "high"),
      pageCount: null,
      sheetCount: null,
      warnings,
      parserVersion: version,
    });
  } catch {
    return failed("Lecture texte impossible.", version);
  }
}

/** Dispatch par format ACCEPTÉ par la politique (les images vont au pipeline visuel). */
export async function parseByFormat(format: AttachmentFormat, bytes: Uint8Array): Promise<ParseOutcome> {
  switch (format) {
    case "pdf": return parsePdf(bytes);
    case "docx": return parseDocx(bytes);
    case "xlsx": return parseXlsx(bytes);
    case "csv": return parseCsv(bytes);
    case "txt": return parsePlainText(bytes, "txt");
    case "md": return parsePlainText(bytes, "md");
    case "png":
    case "jpeg":
    case "webp":
      return Object.freeze({ supportStatus: "image_only" as const, chunks: [], pageCount: null, sheetCount: null, warnings: ["Image : compréhension via le pipeline visuel sanitisé existant."], parserVersion: "multimodal-pipeline" });
    default:
      return Object.freeze({ supportStatus: "unsupported" as const, chunks: [], pageCount: null, sheetCount: null, warnings: ["Format non pris en charge — aucun contenu analysé."], parserVersion: "none" });
  }
}
