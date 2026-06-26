// src/lib/pierre/v1/zip-inspect.ts
// PHASE 8.3-B — real ZIP reader (central directory parse + STORE/DEFLATE extract)
// with zip-bomb defenses. Used to genuinely validate DOCX (OOXML) packages instead
// of naive byte-string matching.

import { inflateRawSync } from "zlib";

export type ZipEntry = { name: string; method: number; flags: number; crc32: number; compressedSize: number; uncompressedSize: number; localHeaderOffset: number };
export type ZipListing = { entries: ZipEntry[]; totalUncompressed: number };

const MAX_ENTRIES = 256;
const MAX_TOTAL_UNCOMPRESSED = 80 * 1024 * 1024; // 80 MB
const MAX_RATIO = 200; // compressed→uncompressed ratio guard
const MAX_SINGLE_UNCOMPRESSED = 50 * 1024 * 1024;
const CRITICAL_ENTRIES = new Set(["[Content_Types].xml", "word/document.xml"]);

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf: Buffer): number { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function findEocd(buf: Buffer): number {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (i >= 0 && buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

/** Parse the central directory. Throws on malformed/over-limit archives. */
export function listZip(buf: Buffer): ZipListing {
  if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error("not_a_zip");
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error("missing_eocd");
  const count = buf.readUInt16LE(eocd + 10);
  if (count > MAX_ENTRIES) throw new Error("too_many_entries");
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdSize = buf.readUInt32LE(eocd + 12);
  if (cdOffset + cdSize > buf.length) throw new Error("central_directory_truncated");
  let cd = cdOffset;
  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  const criticalCount = new Map<string, number>();
  let totalUncompressed = 0;
  for (let i = 0; i < count; i++) {
    if (cd + 46 > buf.length || buf.readUInt32LE(cd) !== 0x02014b50) throw new Error("bad_central_directory");
    const flags = buf.readUInt16LE(cd + 8);
    const method = buf.readUInt16LE(cd + 10);
    const crc = buf.readUInt32LE(cd + 16) >>> 0;
    const compressedSize = buf.readUInt32LE(cd + 20);
    const uncompressedSize = buf.readUInt32LE(cd + 24);
    const nameLen = buf.readUInt16LE(cd + 28);
    const extraLen = buf.readUInt16LE(cd + 30);
    const commentLen = buf.readUInt16LE(cd + 32);
    const localHeaderOffset = buf.readUInt32LE(cd + 42);
    if (cd + 46 + nameLen > buf.length) throw new Error("bad_central_directory");
    const name = buf.subarray(cd + 46, cd + 46 + nameLen).toString("utf8");
    // Unsupported / dangerous features.
    if (flags & 0x1) throw new Error("encrypted_zip");
    if (flags & 0x8) throw new Error("data_descriptor_unsupported");
    if (flags & 0x40) throw new Error("strong_encryption");
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) throw new Error("zip64_unsupported");
    if (name.includes("..") || name.startsWith("/") || name.startsWith("\\") || /^[a-zA-Z]:/.test(name)) throw new Error("path_traversal_entry");
    if (/[‪-‮​-‏⁦-⁩]/.test(name)) throw new Error("deceptive_unicode_name");
    const norm = name.normalize("NFC").toLowerCase();
    if (seen.has(norm)) throw new Error("duplicate_entry_name");
    seen.add(norm);
    if (CRITICAL_ENTRIES.has(name)) { const n = (criticalCount.get(name) ?? 0) + 1; if (n > 1) throw new Error("duplicate_critical_entry"); criticalCount.set(name, n); }
    if (localHeaderOffset + 30 > buf.length) throw new Error("local_header_out_of_bounds");
    if (uncompressedSize > MAX_SINGLE_UNCOMPRESSED) throw new Error("entry_too_large");
    if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_RATIO && uncompressedSize > 1024 * 1024) throw new Error("zip_bomb_ratio");
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) throw new Error("zip_bomb_total");
    entries.push({ name, method, flags, crc32: crc, compressedSize, uncompressedSize, localHeaderOffset });
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return { entries, totalUncompressed };
}

/** Extract a single entry's bytes (STORE or DEFLATE), bounded. */
export function extractEntry(buf: Buffer, entry: ZipEntry): Buffer {
  const off = entry.localHeaderOffset;
  if (off + 30 > buf.length || buf.readUInt32LE(off) !== 0x04034b50) throw new Error("bad_local_header");
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  // Bounds: the compressed data must lie fully inside the buffer.
  if (dataStart + entry.compressedSize > buf.length) throw new Error("compressed_data_out_of_bounds");
  const data = buf.subarray(dataStart, dataStart + entry.compressedSize);
  let out: Buffer;
  if (entry.method === 0) out = Buffer.from(data); // STORE
  else if (entry.method === 8) out = inflateRawSync(data, { maxOutputLength: MAX_SINGLE_UNCOMPRESSED });
  else throw new Error("unsupported_compression");
  // Real decompressed size must equal the declared size, and the CRC32 must match.
  if (out.length !== entry.uncompressedSize) throw new Error("uncompressed_size_mismatch");
  if (crc32(out) !== entry.crc32) throw new Error("crc_mismatch");
  return out;
}

export type DocxInspection = { isDocx: boolean; ok: boolean; reason?: string };

/** Genuinely validate an OOXML wordprocessing package. */
export function inspectDocx(buf: Buffer): DocxInspection {
  let listing: ZipListing;
  try { listing = listZip(buf); } catch (e) { return { isDocx: false, ok: false, reason: e instanceof Error ? e.message : "zip_error" }; }
  const names = new Set(listing.entries.map((e) => e.name));
  if (names.has("vbaProject.bin") || listing.entries.some((e) => e.name.endsWith("vbaProject.bin"))) return { isDocx: true, ok: false, reason: "office_macro" };
  if (!names.has("[Content_Types].xml")) return { isDocx: false, ok: false, reason: "missing_content_types" };
  if (!names.has("word/document.xml")) return { isDocx: false, ok: false, reason: "missing_word_document" };
  // Validate the two required parts actually decompress to plausible XML.
  try {
    const ct = listing.entries.find((e) => e.name === "[Content_Types].xml")!;
    const ctXml = extractEntry(buf, ct).toString("utf8");
    if (!ctXml.includes("wordprocessingml.document")) return { isDocx: true, ok: false, reason: "content_types_not_wordml" };
    const dv = listing.entries.find((e) => e.name === "word/document.xml")!;
    const docXml = extractEntry(buf, dv).toString("utf8");
    if (!/<w:document[\s>]/.test(docXml)) return { isDocx: true, ok: false, reason: "document_xml_invalid" };
  } catch (e) { return { isDocx: true, ok: false, reason: e instanceof Error ? e.message : "extract_error" }; }
  return { isDocx: true, ok: true };
}

/** True only for a structurally valid, macro-free wordprocessing package. */
export function isValidDocx(buf: Buffer): boolean {
  const r = inspectDocx(buf);
  return r.isDocx && r.ok;
}
