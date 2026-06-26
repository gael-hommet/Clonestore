// src/lib/pierre/v1/__tests__/zip-inspect.test.ts
// PHASE 8.3-B §4 — real ZIP/DOCX inspection: STORE + DEFLATE docx, plain zip,
// zip bomb, macro, corrupt, path traversal, empty.

import { describe, it, expect } from "vitest";
import { deflateRawSync } from "zlib";
import { inspectDocx, isValidDocx, listZip } from "../zip-inspect";
import { detectMime } from "../file-mime";
import { DocxRenderer } from "../renderers";

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf: Buffer): number { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function buildZip(entries: Array<{ name: string; data: Buffer }>, deflate = false): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8"); const crc = crc32(e.data);
    const method = deflate ? 8 : 0; const stored = deflate ? deflateRawSync(e.data) : e.data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(stored.length, 18); local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, name, stored);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8); cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0x21, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(stored.length, 20); cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(name.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    centrals.push(cd, name);
    offset += local.length + name.length + stored.length;
  }
  const central = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 18);
  return Buffer.concat([...locals, central, eocd]);
}
const CT = Buffer.from(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
const DOCXML = Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>`);

describe("PHASE 8.3-B §4 — ZIP/DOCX inspection", () => {
  it("accepts a STORE docx (our renderer)", () => {
    const docx = DocxRenderer.render({ title: "T", blocks: [{ lines: ["x"] }] }).bytes;
    expect(isValidDocx(docx)).toBe(true);
    expect(detectMime(docx).mime).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("accepts a real DEFLATE docx", () => {
    const docx = buildZip([{ name: "[Content_Types].xml", data: CT }, { name: "word/document.xml", data: DOCXML }], true);
    const insp = inspectDocx(docx);
    expect(insp.ok).toBe(true);
    expect(detectMime(docx).extension).toBe("docx");
  });

  it("rejects a plain zip (not a docx)", () => {
    const zip = buildZip([{ name: "notes.txt", data: Buffer.from("hello") }]);
    expect(isValidDocx(zip)).toBe(false);
    expect(detectMime(zip).mime).toBe("application/zip");
  });

  it("rejects a macro-enabled package", () => {
    const docm = buildZip([{ name: "[Content_Types].xml", data: CT }, { name: "word/document.xml", data: DOCXML }, { name: "word/vbaProject.bin", data: Buffer.from([0, 1, 2]) }]);
    expect(inspectDocx(docm).reason).toBe("office_macro");
  });

  it("rejects a zip bomb (ratio guard)", () => {
    const bomb = buildZip([{ name: "word/document.xml", data: Buffer.alloc(5 * 1024 * 1024, 0) }], true);
    expect(inspectDocx(bomb).reason).toMatch(/zip_bomb/);
  });

  it("rejects a path-traversal entry", () => {
    const evil = buildZip([{ name: "../../evil.xml", data: Buffer.from("x") }]);
    expect(() => listZip(evil)).toThrowError(/path_traversal/);
    expect(inspectDocx(evil).reason).toBe("path_traversal_entry");
  });

  it("rejects corrupt + empty inputs", () => {
    expect(inspectDocx(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])).ok).toBe(false); // corrupt
    expect(inspectDocx(Buffer.alloc(0)).ok).toBe(false); // empty
    expect(inspectDocx(buildZip([])).ok).toBe(false); // valid empty zip, not a docx
  });
});
