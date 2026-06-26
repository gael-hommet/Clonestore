// src/lib/pierre/v1/renderers.ts
// PHASE 8.3 — DocumentRenderer: real PDF + DOCX generation with NO third-party
// library (none exists in the repo). PDF is emitted as a valid PDF-1.4 (Helvetica,
// WinAnsi so French accents render); DOCX is a real OOXML ZIP (STORE entries, CRC32,
// EOCD). Deterministic given the same input → stable content_hash. Bytes are never
// stored in Postgres; they go to the FileStorageProvider.

import { createHash } from "crypto";

export type RenderTable = { headers?: string[]; rows: string[][] };
export type RenderSignature = { role: string; name?: string };
// `lines` stays for back-compat; `table`/`signatures`/`pageBreak` are additive.
export type RenderBlock = { heading?: string; lines?: string[]; table?: RenderTable; signatures?: RenderSignature[]; pageBreak?: boolean };
export type RenderInput = {
  title: string;
  subtitle?: string;
  blocks: RenderBlock[];
  footer?: string;
  reference?: string;
  watermark?: string;       // e.g. "BROUILLON" / "DRAFT" on non-final renders
  meta?: Record<string, string>;
};
export type RenderOutput = { bytes: Buffer; mime: string; extension: string; page_count: number; sha256: string };

export interface DocumentRenderer {
  readonly format: "pdf" | "docx";
  render(input: RenderInput): RenderOutput;
  validateOutput(bytes: Buffer): { ok: boolean; reason?: string };
  extractMetadata(bytes: Buffer): { size_bytes: number; format: string };
  calculateHash(bytes: Buffer): string;
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ── Text normalization (keep deterministic; map non-Latin1 to safe equivalents) ─
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/€/g, "EUR"], [/[‘’‛]/g, "'"], [/[“”]/g, '"'],
  [/[–—]/g, "-"], [/…/g, "..."], [/ /g, " "], [/œ/g, "oe"], [/Œ/g, "OE"],
];
function toLatin1Safe(s: string): string {
  let out = s;
  for (const [re, rep] of REPLACEMENTS) out = out.replace(re, rep);
  // Drop anything still outside Latin-1 to avoid broken glyphs.
  return out.replace(/[^\x00-\xFF]/g, "?");
}

// ── PDF renderer ─────────────────────────────────────────────────────────────
function pdfEscape(s: string): string {
  return toLatin1Safe(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]/g, " ");
}

// Soft-wrap a long paragraph to a max character width so text never runs off the page.
const WRAP = 92;
function wrapText(text: string, width = WRAP): string[] {
  if (text.length <= width) return [text];
  const words = text.split(/\s+/);
  const out: string[] = []; let cur = "";
  for (const w of words) {
    if (cur.length + w.length + 1 > width) { if (cur) out.push(cur); cur = w.length > width ? w.slice(0, width) : w; }
    else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}
function tableLines(t: RenderTable): string[] {
  const cols = Math.max(t.headers?.length ?? 0, ...t.rows.map((r) => r.length), 1);
  const widths: number[] = [];
  for (let c = 0; c < cols; c++) {
    const cells = [t.headers?.[c] ?? "", ...t.rows.map((r) => r[c] ?? "")];
    widths[c] = Math.min(40, Math.max(...cells.map((x) => String(x).length), 3));
  }
  const fmt = (cells: string[]) => cells.map((x, c) => String(x ?? "").slice(0, widths[c]).padEnd(widths[c])).join("  |  ");
  const out: string[] = [];
  if (t.headers) { out.push(fmt(t.headers)); out.push(widths.map((w) => "-".repeat(w)).join("--+--")); }
  for (const r of t.rows) out.push(fmt(r));
  return out;
}

type LineItem = { text: string; size: number; brk?: boolean };
function flatten(input: RenderInput): LineItem[] {
  const items: LineItem[] = [];
  if (input.watermark) items.push({ text: `— ${input.watermark} —`, size: 12 });
  items.push({ text: input.title, size: 16 });
  if (input.reference) items.push({ text: input.reference, size: 9 });
  if (input.subtitle) items.push({ text: input.subtitle, size: 11 });
  items.push({ text: "", size: 11 });
  for (const b of input.blocks) {
    if (b.pageBreak) { (items[items.length] = { text: "", size: 11, brk: true }); }
    if (b.heading) items.push({ text: b.heading, size: 13 });
    for (const l of b.lines ?? []) for (const w of wrapText(l)) items.push({ text: w, size: 11 });
    if (b.table) for (const tl of tableLines(b.table)) items.push({ text: tl, size: 10 });
    if (b.signatures) for (const s of b.signatures) {
      items.push({ text: "", size: 11 });
      items.push({ text: `${s.role}${s.name ? ` — ${s.name}` : ""}`, size: 11 });
      items.push({ text: "Signature : ______________________________    Date : ______________", size: 10 });
    }
    items.push({ text: "", size: 11 });
  }
  return items;
}
function paginate(input: RenderInput): string[][] {
  const items = flatten(input);
  const perPage = 38;
  const pages: string[][] = [];
  let cur: LineItem[] = [];
  const flush = () => { if (cur.length) { pages.push(cur.map((x) => `${x.size}|${x.text}`)); cur = []; } };
  for (const it of items) {
    if (it.brk && cur.length) flush();
    cur.push(it);
    if (cur.length >= perPage) flush();
  }
  flush();
  if (pages.length === 0) pages.push([`16|${input.title}`]);
  return pages;
}

export const PdfRenderer: DocumentRenderer = {
  format: "pdf",
  render(input: RenderInput): RenderOutput {
    const pages = paginate(input);
    const objects: string[] = [];
    // Object indices: 1 Catalog, 2 Pages, 3 Font, then per page: content + page.
    const fontObj = 3;
    const pageObjs: number[] = [];
    const contentObjs: number[] = [];
    let nextObj = 4;
    for (let p = 0; p < pages.length; p++) { contentObjs.push(nextObj++); pageObjs.push(nextObj++); }

    objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objects[2] = `<< /Type /Pages /Kids [${pageObjs.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`;
    objects[fontObj] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;

    for (let p = 0; p < pages.length; p++) {
      let y = 790;
      let stream = "";
      for (const entry of pages[p]) {
        const sep = entry.indexOf("|");
        const size = Number(entry.slice(0, sep));
        const text = entry.slice(sep + 1);
        if (text.length > 0) stream += `BT /F1 ${size} Tf 56 ${y} Td (${pdfEscape(text)}) Tj ET\n`;
        y -= size + 7;
      }
      if (input.footer) stream += `BT /F1 8 Tf 56 40 Td (${pdfEscape(`${input.footer}  ·  p.${p + 1}/${pages.length}`)}) Tj ET\n`;
      const streamBuf = Buffer.from(stream, "latin1");
      objects[contentObjs[p]] = `<< /Length ${streamBuf.length} >>\nstream\n${stream}endstream`;
      objects[pageObjs[p]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObjs[p]} 0 R >>`;
    }

    // Assemble with a real xref table.
    const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    let body = "";
    const offsets: number[] = [];
    const total = nextObj - 1;
    for (let i = 1; i <= total; i++) {
      offsets[i] = header.length + body.length;
      body += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefStart = header.length + body.length;
    let xref = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= total; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    const trailer = `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    const bytes = Buffer.from(header + body + xref + trailer, "latin1");
    return { bytes, mime: "application/pdf", extension: "pdf", page_count: pages.length, sha256: sha256(bytes) };
  },
  validateOutput(bytes) {
    const head = bytes.subarray(0, 8).toString("latin1");
    const tail = bytes.subarray(Math.max(0, bytes.length - 6)).toString("latin1");
    if (!head.startsWith("%PDF-")) return { ok: false, reason: "missing %PDF header" };
    if (!tail.includes("%%EOF")) return { ok: false, reason: "missing %%EOF" };
    return { ok: true };
  },
  extractMetadata(bytes) { return { size_bytes: bytes.length, format: "pdf" }; },
  calculateHash: sha256,
};

// ── DOCX renderer (real OOXML zip, no library) ───────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
export function zipStore(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); // method STORE, fixed date
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(e.data.length, 18); local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, name, e.data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(e.data.length, 20); cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(name.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    centrals.push(cd, name);
    offset += local.length + name.length + e.data.length;
  }
  const central = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 18);
  return Buffer.concat([...locals, central, eocd]);
}
function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const DocxRenderer: DocumentRenderer = {
  format: "docx",
  render(input: RenderInput): RenderOutput {
    const para = (text: string, opts: { bold?: boolean; size?: number } = {}) => {
      const sz = opts.size ? `<w:sz w:val="${opts.size * 2}"/>` : "";
      const b = opts.bold ? "<w:b/>" : "";
      return `<w:p><w:pPr><w:rPr>${b}${sz}</w:rPr></w:pPr><w:r><w:rPr>${b}${sz}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
    };
    const pageBreak = () => `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    const cell = (text: string, bold = false) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p><w:r><w:rPr>${bold ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p></w:tc>`;
    const tableXml = (t: RenderTable) => {
      const rows: string[] = [];
      if (t.headers) rows.push(`<w:tr>${t.headers.map((c) => cell(c, true)).join("")}</w:tr>`);
      for (const r of t.rows) rows.push(`<w:tr>${r.map((c) => cell(c ?? "")).join("")}</w:tr>`);
      return `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr>${rows.join("")}</w:tbl>`;
    };
    const body: string[] = [];
    if (input.watermark) body.push(para(`— ${input.watermark} —`, { bold: true, size: 12 }));
    body.push(para(input.title, { bold: true, size: 16 }));
    if (input.reference) body.push(para(input.reference, { size: 9 }));
    if (input.subtitle) body.push(para(input.subtitle, { size: 11 }));
    for (const blk of input.blocks) {
      if (blk.pageBreak) body.push(pageBreak());
      if (blk.heading) body.push(para(blk.heading, { bold: true, size: 13 }));
      for (const l of blk.lines ?? []) body.push(para(l, { size: 11 }));
      if (blk.table) body.push(tableXml(blk.table));
      if (blk.signatures) for (const s of blk.signatures) {
        body.push(para(`${s.role}${s.name ? ` — ${s.name}` : ""}`, { size: 11 }));
        body.push(para("Signature : ______________________________    Date : ______________", { size: 10 }));
      }
    }
    if (input.footer) body.push(para(input.footer, { size: 8 }));
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    const bytes = zipStore([
      { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
      { name: "_rels/.rels", data: Buffer.from(rels, "utf8") },
      { name: "word/document.xml", data: Buffer.from(documentXml, "utf8") },
    ]);
    return { bytes, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx", page_count: 1, sha256: sha256(bytes) };
  },
  validateOutput(bytes) {
    if (bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50) return { ok: false, reason: "not a zip (PK header)" };
    // EOCD present near the end.
    let found = false;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) { if (bytes.readUInt32LE(i) === 0x06054b50) { found = true; break; } }
    return found ? { ok: true } : { ok: false, reason: "missing EOCD" };
  },
  extractMetadata(bytes) { return { size_bytes: bytes.length, format: "docx" }; },
  calculateHash: sha256,
};

export function getRenderer(format: "pdf" | "docx"): DocumentRenderer {
  return format === "docx" ? DocxRenderer : PdfRenderer;
}
