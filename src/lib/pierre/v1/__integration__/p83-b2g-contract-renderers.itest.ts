// src/lib/pierre/v1/__integration__/p83-b2g-contract-renderers.itest.ts
// PHASE 8.3-B2G §3 — real PDF + DOCX from ONE canonical model; distinct, coherent hashes.

import { describe, it, expect } from "vitest";
import pdfParse from "pdf-parse";
import { buildContractRenderModel, renderContractPdf, renderContractDocx, canonicalContractHash } from "../contract-render-model";
import { compileContractTemplate } from "../contract-template-compiler";
import { getContractPolicy } from "../contract-policies";
import { inspectDocx } from "../zip-inspect";
import type { StrictGenerationContext } from "../generation-context";

function ctx(over: Record<string, string | null> = {}): StrictGenerationContext {
  return {
    document_type: "employment_contract", employee_id: "e", site_id: null, contract_id: "c",
    values: { "company.legal_name": "Acme & Co", "employee.first_name": "Élise", "employee.last_name": "Müller", "employee.role_title": "Cheffe de projet", "employment.start_date": "2026-01-01", "employment.end_date": "2026-12-31", "employment.weekly_hours": "35", ...over },
    sensitive_fields: [], custom_field_keys: [], rejected_overrides: [],
  };
}
const TEMPLATE_BODY = "# Article 1 — Parties\nContrat entre Acme & Co et {{employee.first_name}} {{employee.last_name}}.\n# Article 2 — Fonctions\nPoste : {{employee.role_title}}, à compter du {{employment.start_date}}.";
const SCHEMA = [
  { field_key: "employee.first_name", source_path: "employee.first_name" },
  { field_key: "employee.last_name", source_path: "employee.last_name" },
  { field_key: "employee.role_title", source_path: "employee.role_title" },
  { field_key: "employment.start_date", source_path: "employment.start_date" },
];
const compiledFor = (c = ctx(), body = TEMPLATE_BODY) => compileContractTemplate(body, SCHEMA, c);
const model = (final = true) => buildContractRenderModel({ policy: getContractPolicy("CDD")!, context: ctx(), compiled: compiledFor(), reference: "REF-1", version: 1, is_final: final, generated_at: "2026-06-21T00:00:00.000Z" });

describe("§3 contract renderers", () => {
  it("PDF is real, parseable, multi-page for long content, no truncation", async () => {
    const longCtx = ctx({ "employee.role_title": "X".repeat(20) });
    const longBody = TEMPLATE_BODY + "\n# Article long\n" + Array.from({ length: 90 }, (_, i) => `Paragraphe ${i + 1} du contrat, suffisamment long pour vérifier le wrapping et la pagination réelle du moteur PDF sans bibliothèque tierce.`).join("\n");
    const m = buildContractRenderModel({ policy: getContractPolicy("CDD")!, context: longCtx, compiled: compiledFor(longCtx, longBody), reference: "REF-1", version: 1, is_final: true, generated_at: "2026-06-21" });
    const pdf = renderContractPdf(m);
    expect(pdf.page_count).toBeGreaterThan(1);
    const parsed = await pdfParse(pdf.bytes);
    expect(parsed.numpages).toBe(pdf.page_count);
    expect(parsed.text).toContain("Paragraphe 90");
    expect(pdf.bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("DOCX is a valid OOXML zip with a real table and escaped special characters, no macro", () => {
    const docx = renderContractDocx(model());
    const ins = inspectDocx(docx.bytes);
    expect(ins.ok).toBe(true);
    const xml = docx.bytes.toString("latin1");
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("Acme &amp; Co");           // XML-escaped ampersand
    expect(xml).not.toContain("vbaProject");           // no macro
    expect(xml).not.toMatch(/<w:hyperlink[^>]*r:id/);  // no external link relationship
  });

  it("draft renders carry a BROUILLON marker; final renders do not", () => {
    const draftXml = renderContractDocx(model(false)).bytes.toString("latin1");
    const finalXml = renderContractDocx(model(true)).bytes.toString("latin1");
    expect(draftXml).toContain("BROUILLON");
    expect(finalXml).not.toContain("BROUILLON");
  });

  it("the SAME canonical content drives both formats; the three hashes are distinct and coherent", () => {
    const m = model();
    const canonical = canonicalContractHash(m);
    const pdf = renderContractPdf(m), docx = renderContractDocx(m);
    // PDF and DOCX both carry the same business facts
    const pdfText = pdf.bytes.toString("latin1");
    expect(docx.bytes.toString("latin1")).toContain("Cheffe de projet");
    expect(pdfText).toContain("Cheffe de projet");
    // three distinct binary/business hashes
    expect(new Set([canonical, pdf.sha256, docx.sha256]).size).toBe(3);
    // canonical hash is stable across draft/final (presentation-independent)
    expect(canonicalContractHash(model(true))).toBe(canonicalContractHash(model(false)));
    // but the PDF bytes differ between draft and final (watermark)
    expect(renderContractPdf(model(true)).sha256).not.toBe(renderContractPdf(model(false)).sha256);
  });
});
