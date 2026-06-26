// src/lib/pierre/v1/contract-template-compiler.ts
// PHASE 8.3-B2G-R1.3 — compile the PUBLISHED template body into the contract's business
// content. The clauses actually rendered come from `pierre_rt_document_template_versions.body`
// + its declared field_schema, NOT from hardcoded strings. A safe mini-markup is supported
// (headings, paragraphs, tables, page breaks); only DECLARED + RESOLVED variables are
// substituted; an unknown variable fails closed; values are kept as plain text (the renderers
// escape them, so no HTML/XML injection is possible).

import type { StrictGenerationContext } from "./generation-context";
import type { ContractClause, ContractTable } from "./contract-render-model";

export type TemplateField = { field_key: string; source_path?: string; required?: boolean };
export type CompiledBlock = { heading?: string; paragraphs?: string[]; table?: ContractTable; pageBreak?: boolean };
export type CompiledTemplate = { blocks: CompiledBlock[]; clauses: ContractClause[]; tables: ContractTable[]; used_fields: string[]; unknown_fields: string[] };

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/**
 * Compile a template body against a strict generation context. Returns the structured blocks
 * plus the list of unknown variables (which the caller MUST treat as a hard block).
 *
 * Mini-markup (line oriented):
 *   `# Heading`            → a clause heading (starts a new clause)
 *   `[[PAGEBREAK]]`        → a page break
 *   `| a | b |` (>=2 rows) → a simple table (first row = headers)
 *   blank line             → paragraph separator
 *   anything else          → a paragraph line of the current clause
 * `{{path}}` is replaced ONLY when `path` is declared in field_schema AND present in the
 * context; otherwise it is recorded as an unknown/forbidden field.
 */
export function compileContractTemplate(body: string | null, fieldSchema: TemplateField[] | null | undefined, context: StrictGenerationContext): CompiledTemplate {
  const declared = new Set((fieldSchema ?? []).map((f) => f.source_path ?? f.field_key));
  const used = new Set<string>();
  const unknown = new Set<string>();

  const substitute = (line: string): string => line.replace(PLACEHOLDER, (_m, path: string) => {
    if (!declared.has(path) || !Object.prototype.hasOwnProperty.call(context.values, path)) { unknown.add(path); return `{{${path}}}`; }
    const val = context.values[path];
    if (val === null || val === undefined || val === "") { return "—"; }
    used.add(path);
    // keep as plain text; the renderers escape it (no markup injection possible)
    return String(val);
  });

  const blocks: CompiledBlock[] = [];
  const clauses: ContractClause[] = [];
  const tables: ContractTable[] = [];
  let curHeading: string | undefined; let curParas: string[] = [];
  let tableBuf: string[][] = [];

  const flushClause = () => {
    if (curParas.length || curHeading) { clauses.push({ heading: curHeading ?? "", paragraphs: curParas.slice() }); blocks.push({ heading: curHeading, paragraphs: curParas.slice() }); }
    curParas = [];
  };
  const flushTable = () => {
    if (tableBuf.length) {
      const t: ContractTable = { headers: tableBuf[0], rows: tableBuf.slice(1) };
      tables.push(t); blocks.push({ table: t });
      tableBuf = [];
    }
  };

  const lines = (body ?? "").split(/\r?\n/);
  for (const raw of lines) {
    const line = substitute(raw);
    const trimmed = line.trim();
    const isTableRow = /^\|.*\|$/.test(trimmed);
    if (!isTableRow && tableBuf.length) flushTable();
    if (trimmed === "[[PAGEBREAK]]") { flushClause(); blocks.push({ pageBreak: true }); continue; }
    if (trimmed.startsWith("# ")) { flushClause(); curHeading = trimmed.slice(2).trim(); continue; }
    if (isTableRow) { tableBuf.push(trimmed.slice(1, -1).split("|").map((c) => c.trim())); continue; }
    if (trimmed === "") { if (curParas.length) { /* paragraph boundary */ } continue; }
    curParas.push(trimmed);
  }
  flushTable();
  flushClause();

  return { blocks, clauses, tables, used_fields: Array.from(used), unknown_fields: Array.from(unknown) };
}
