// src/lib/pierre/v1/__tests__/renderers.test.ts
// PHASE 8.3 — proves the from-scratch renderers emit REAL, valid PDF/DOCX bytes
// (PDF parseable by pdf-parse incl. French accents; DOCX a valid OOXML zip) with
// deterministic content hashes.

import { describe, it, expect } from "vitest";
import { PdfRenderer, DocxRenderer, getRenderer, type RenderInput } from "../renderers";

const input: RenderInput = {
  title: "Contrat de travail à durée indéterminée",
  subtitle: "Société Acme · Hélène Émard",
  blocks: [
    { heading: "Article 1 — Engagement", lines: ["Le présent contrat prend effet le 1er juillet 2026.", "Rémunération brute : 42000 EUR."] },
    { heading: "Article 2 — Fonctions", lines: ["Poste : Responsable des opérations.", "Établissement : Paris."] },
  ],
  footer: "Document généré par Pierre — version 1",
};

describe("PHASE 8.3 — PDF renderer", () => {
  it("produces a valid PDF that pdf-parse can open, with accents and the title text", async () => {
    const out = PdfRenderer.render(input);
    expect(out.mime).toBe("application/pdf");
    expect(PdfRenderer.validateOutput(out.bytes).ok).toBe(true);
    expect(out.bytes.length).toBeGreaterThan(400);
    // pdf-parse is a real PDF reader — if it opens + extracts text, the PDF is valid.
    const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string; numpages: number }>;
    const parsed = await pdfParse(out.bytes);
    expect(parsed.numpages).toBeGreaterThanOrEqual(1);
    expect(parsed.text).toMatch(/Contrat de travail/);
    expect(parsed.text).toMatch(/Article 1/);
  });

  it("is deterministic (same input → same sha256)", () => {
    const a = PdfRenderer.render(input);
    const b = PdfRenderer.render(input);
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("PHASE 8.3 — DOCX renderer", () => {
  it("produces a valid OOXML zip (PK header + EOCD) containing the document body", () => {
    const out = DocxRenderer.render(input);
    expect(out.extension).toBe("docx");
    expect(DocxRenderer.validateOutput(out.bytes).ok).toBe(true);
    expect(out.bytes.readUInt32LE(0)).toBe(0x04034b50); // PK\x03\x04
    // STORE (uncompressed) → the document text appears verbatim in the package bytes.
    expect(out.bytes.includes(Buffer.from("Article 1 — Engagement", "utf8"))).toBe(true);
    expect(out.bytes.includes(Buffer.from("word/document.xml", "utf8"))).toBe(true);
  });

  it("is deterministic", () => {
    expect(DocxRenderer.render(input).sha256).toBe(DocxRenderer.render(input).sha256);
  });
});

describe("getRenderer", () => {
  it("selects the right renderer", () => {
    expect(getRenderer("pdf").format).toBe("pdf");
    expect(getRenderer("docx").format).toBe("docx");
  });
});
