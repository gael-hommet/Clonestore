import { describe, it, expect } from "vitest";
import { sanitizeImageBuffer, prepareImagesForModel } from "../image-sanitizer";

// Construit un PNG structurellement valide avec un chunk tEXt (métadonnée) à retirer.
function png(width: number, height: number, withText = true): Uint8Array {
  const chunk = (type: string, data: number[]) => {
    const len = data.length;
    return [(len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
  };
  const ihdr = chunk("IHDR", [(width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255, (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255, 8, 6, 0, 0, 0]);
  const text = withText ? chunk("tEXt", [...[..."Comment"].map((c) => c.charCodeAt(0)), 0, ...[..."GPS:48.85"].map((c) => c.charCodeAt(0))]) : [];
  const idat = chunk("IDAT", [1]);
  const iend = chunk("IEND", []);
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, ...text, ...idat, ...iend]);
}

// Construit un JPEG avec un segment APP1 (EXIF) à retirer.
function jpeg(): Uint8Array {
  const app1 = [0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0x64, 0x03, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1];
  const sos = [0xff, 0xda, 0x00, 0x08, 0x01, 1, 0, 0, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9];
  return new Uint8Array([0xff, 0xd8, ...app1, ...sof0, ...sos]);
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const has = (b: Uint8Array, s: string) => Buffer.from(b).toString("latin1").includes(s);

describe("P9.4.1 image sanitizer — magic bytes, dimensions, bombs", () => {
  it("vérifie les magic bytes (rejette un faux)", () => {
    expect(sanitizeImageBuffer(new Uint8Array([1, 2, 3, 4, 5])).ok).toBe(false);
    expect(sanitizeImageBuffer(png(10, 10)).format).toBe("png");
    expect(sanitizeImageBuffer(jpeg()).format).toBe("jpeg");
  });
  it("lit les dimensions réelles depuis l'en-tête", () => {
    const r = sanitizeImageBuffer(png(320, 240));
    expect(r.width).toBe(320); expect(r.height).toBe(240);
    const j = sanitizeImageBuffer(jpeg());
    expect(j.width).toBe(100); expect(j.height).toBe(100);
  });
  it("refuse une decompression bomb (dimensions absurdes)", () => {
    const r = sanitizeImageBuffer(png(20000, 20000));
    expect(r.ok).toBe(false); expect(r.reason).toBe("decompression_bomb");
  });
});

describe("P9.4.1 image sanitizer — RETIRE réellement les métadonnées", () => {
  it("PNG : le chunk tEXt (contenant GPS) est retiré ; l'image reste un PNG valide", () => {
    const original = png(50, 50, true);
    expect(has(original, "GPS:48.85")).toBe(true); // présent dans l'original
    const r = sanitizeImageBuffer(original);
    expect(r.ok).toBe(true);
    expect(r.strippedChunks).toContain("tEXt");
    expect(has(r.sanitized!, "GPS:48.85")).toBe(false); // RETIRÉ
    expect(r.sanitized!.length).toBeLessThan(original.length);
    // toujours un PNG (signature conservée) + IHDR/IEND
    expect(has(r.sanitized!, "IHDR")).toBe(true);
    expect(has(r.sanitized!, "IEND")).toBe(true);
  });
  it("JPEG : le segment APP1 (EXIF) est retiré", () => {
    const original = jpeg();
    expect(has(original, "Exif")).toBe(true);
    const r = sanitizeImageBuffer(original);
    expect(r.ok).toBe(true);
    expect(has(r.sanitized!, "Exif")).toBe(false); // EXIF RETIRÉ
    expect(r.strippedChunks.length).toBeGreaterThan(0);
  });
});

describe("P9.4.1 image sanitizer — prepareImagesForModel (ce qui part au modèle est sanitisé)", () => {
  it("l'image envoyée au modèle n'a plus les métadonnées ; rapport honnête (pas de resize pixel)", async () => {
    const dataUrl = `data:image/png;base64,${b64(png(64, 64, true))}`;
    const prepared = await prepareImagesForModel([dataUrl]);
    expect(prepared.dataUrls.length).toBe(1);
    const outBytes = new Uint8Array(Buffer.from(prepared.dataUrls[0].split("base64,")[1], "base64"));
    expect(has(outBytes, "GPS:48.85")).toBe(false); // ce qui part au modèle est nettoyé
    expect(prepared.report.metadataStripped).toBe(true);
    expect(prepared.report.magicVerified).toBe(true);
    expect(prepared.report.pixelResize).toBe(false); // honnête : pas de resize pixel local
    expect(prepared.meta[0].sanitizedHash).toMatch(/^fnv1a_/);
  });
});
