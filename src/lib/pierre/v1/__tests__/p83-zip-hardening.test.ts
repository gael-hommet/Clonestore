// src/lib/pierre/v1/__tests__/p83-zip-hardening.test.ts
// PHASE 8.3-B2 §5 — ZIP/DOCX final hardening: CRC32, declared-size, bounds,
// encrypted, ZIP64, data descriptor, duplicate critical entries.

import { describe, it, expect } from "vitest";
import { deflateRawSync } from "zlib";
import { listZip, inspectDocx, extractEntry, isValidDocx } from "../zip-inspect";

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Buffer): number { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

type Ent = { name: string; data: Buffer; deflate?: boolean; flags?: number; crc?: number; usize?: number; csize?: number };
function buildZip(entries: Ent[]): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const crc = e.crc ?? crc32(e.data);
    const method = e.deflate ? 8 : 0;
    const stored = e.deflate ? deflateRawSync(e.data) : e.data;
    const csize = e.csize ?? stored.length;
    const usize = e.usize ?? e.data.length;
    const flags = e.flags ?? 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(csize >>> 0, 18); local.writeUInt32LE(usize >>> 0, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, name, stored);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(flags, 8); cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0x21, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(csize >>> 0, 20); cd.writeUInt32LE(usize >>> 0, 24);
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
const DOC = Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>`);
const docxEntries = (over: Partial<Ent> = {}): Ent[] => [{ name: "[Content_Types].xml", data: CT }, { name: "word/document.xml", data: DOC, ...over }];

describe("§5 ZIP/DOCX hardening", () => {
  it("valid STORE and DEFLATE docx pass (CRC + size validated on extract)", () => {
    expect(isValidDocx(buildZip(docxEntries()))).toBe(true);
    expect(isValidDocx(buildZip(docxEntries({ deflate: true })))).toBe(true);
  });

  it("rejects an invalid CRC32", () => {
    expect(inspectDocx(buildZip(docxEntries({ crc: 0xdeadbeef }))).reason).toBe("crc_mismatch");
  });

  it("rejects a wrong declared uncompressed size", () => {
    expect(inspectDocx(buildZip(docxEntries({ usize: 999999 }))).reason).toBe("uncompressed_size_mismatch");
  });

  it("rejects a compressed size beyond the buffer", () => {
    expect(inspectDocx(buildZip(docxEntries({ csize: 5_000_000 }))).reason).toMatch(/out_of_bounds|truncated|bad_/);
  });

  it("rejects an encrypted zip", () => {
    expect(() => listZip(buildZip(docxEntries({ flags: 0x1 })))).toThrowError(/encrypted_zip/);
  });

  it("rejects a data descriptor (unsupported)", () => {
    expect(() => listZip(buildZip(docxEntries({ flags: 0x8 })))).toThrowError(/data_descriptor_unsupported/);
  });

  it("rejects ZIP64 sentinel sizes", () => {
    expect(() => listZip(buildZip(docxEntries({ csize: 0xffffffff })))).toThrowError(/zip64_unsupported/);
  });

  it("rejects duplicate critical entries", () => {
    const dup: Ent[] = [{ name: "[Content_Types].xml", data: CT }, { name: "word/document.xml", data: DOC }, { name: "word/document.xml", data: DOC }];
    expect(() => listZip(buildZip(dup))).toThrowError(/duplicate_(critical_entry|entry_name)/);
  });

  it("rejects duplicate (normalized) entry names", () => {
    const dup: Ent[] = [{ name: "a.xml", data: CT }, { name: "A.XML", data: DOC }];
    expect(() => listZip(buildZip(dup))).toThrowError(/duplicate_entry_name/);
  });

  it("extractEntry validates CRC + size for a genuine entry", () => {
    const z = buildZip(docxEntries());
    const list = listZip(z);
    const docEntry = list.entries.find((e) => e.name === "word/document.xml")!;
    expect(extractEntry(z, docEntry).equals(DOC)).toBe(true);
  });
});
