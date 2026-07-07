import { describe, it, expect, vi, afterEach } from "vitest";
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

// sharp réel (fourni par la dépendance directe épinglée 0.34.4). `any` assumé côté test.
type SharpFactory = (input?: unknown, opts?: unknown) => { [k: string]: (...a: unknown[]) => unknown };
async function loadSharp(): Promise<SharpFactory> {
  const mod = await import("sharp");
  return (mod as { default?: unknown }).default as unknown as SharpFactory;
}
const outUrlBytes = (u: string) => new Uint8Array(Buffer.from(u.split("base64,")[1], "base64"));

afterEach(() => vi.unstubAllEnvs());

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

describe("P9.4.1 image sanitizer — RETIRE réellement les métadonnées (bas niveau)", () => {
  it("PNG : le chunk tEXt (GPS) est retiré ; PNG valide", () => {
    const original = png(50, 50, true);
    expect(has(original, "GPS:48.85")).toBe(true);
    const r = sanitizeImageBuffer(original);
    expect(r.ok).toBe(true);
    expect(r.strippedChunks).toContain("tEXt");
    expect(has(r.sanitized!, "GPS:48.85")).toBe(false);
    expect(has(r.sanitized!, "IHDR")).toBe(true);
    expect(has(r.sanitized!, "IEND")).toBe(true);
  });
  it("JPEG : le segment APP1 (EXIF) est retiré", () => {
    const r = sanitizeImageBuffer(jpeg());
    expect(r.ok).toBe(true);
    expect(has(r.sanitized!, "Exif")).toBe(false);
    expect(r.strippedChunks.length).toBeGreaterThan(0);
  });
});

describe("P9.4.2 r2 §9 — transformation PIXEL OBLIGATOIRE (sharp), production", () => {
  it("PNG 2000×1500 + EXIF/GPS → décodé, RESIZE ≤1024, RECOMPRESS, métadonnées retirées, original jamais envoyé", async () => {
    const sharp = await loadSharp();
    const bigWithExif = await (sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r: 10, g: 120, b: 200 } } }) as never as { withMetadata: (m: unknown) => { png: () => { toBuffer: () => Promise<Buffer> } } })
      .withMetadata({ exif: { IFD0: { Copyright: "GPS:48.8566,2.3522 SECRET" } } }).png().toBuffer();
    const inputB64 = bigWithExif.toString("base64");
    const prepared = await prepareImagesForModel([`data:image/png;base64,${inputB64}`]);
    expect(prepared.dataUrls.length).toBe(1);
    const m0 = prepared.meta[0];
    expect(m0.engine).toBe("sharp");
    expect(m0.width).toBeLessThanOrEqual(1024);
    expect(m0.height).toBeLessThanOrEqual(1024);
    expect(m0.originalWidth).toBe(2000);
    expect(m0.resized).toBe(true);
    expect(m0.sanitizedBytes).toBeLessThan(m0.originalBytes);
    const out = outUrlBytes(prepared.dataUrls[0]);
    expect(has(out, "GPS:48.8566")).toBe(false);              // EXIF/GPS retiré
    expect(Buffer.from(out).toString("base64")).not.toBe(inputB64); // l'originale n'est JAMAIS envoyée
    expect(prepared.report.pixelResize).toBe(true);
    expect(prepared.report.engine).toBe("sharp");
    expect(prepared.report.sharpRequired).toBe(true);
    expect(prepared.report.metadataStripped).toBe(true);
  });

  it("JPEG réel : décodé + recompressé (sortie JPEG valide re-décodable)", async () => {
    const sharp = await loadSharp();
    const jpg = await (sharp({ create: { width: 1400, height: 900, channels: 3, background: { r: 200, g: 30, b: 30 } } }) as never as { jpeg: () => { toBuffer: () => Promise<Buffer> } }).jpeg().toBuffer();
    const prepared = await prepareImagesForModel([`data:image/jpeg;base64,${jpg.toString("base64")}`]);
    expect(prepared.meta[0]?.engine).toBe("sharp");
    expect(prepared.meta[0].mime).toBe("image/jpeg");
    expect(prepared.meta[0].width).toBeLessThanOrEqual(1024);
    const outMd = await (sharp(outUrlBytes(prepared.dataUrls[0])) as never as { metadata: () => Promise<{ width?: number; format?: string }> }).metadata();
    expect(outMd.width).toBeLessThanOrEqual(1024);
  });

  it("WebP réel : décodé + recompressé (sortie WebP valide)", async () => {
    const sharp = await loadSharp();
    const webp = await (sharp({ create: { width: 1300, height: 700, channels: 3, background: { r: 20, g: 200, b: 90 } } }) as never as { webp: () => { toBuffer: () => Promise<Buffer> } }).webp().toBuffer();
    const prepared = await prepareImagesForModel([`data:image/webp;base64,${webp.toString("base64")}`]);
    expect(prepared.meta[0]?.engine).toBe("sharp");
    expect(prepared.meta[0].mime).toBe("image/webp");
    expect(prepared.meta[0].width).toBeLessThanOrEqual(1024);
  });

  it("ORIENTATION EXIF normalisée : un paysage orienté 90° devient portrait en sortie", async () => {
    const sharp = await loadSharp();
    // 120×60 paysage + orientation=6 (rotation 90° horaire) → après .rotate(), 60×120 portrait.
    const oriented = await (sharp({ create: { width: 120, height: 60, channels: 3, background: { r: 5, g: 5, b: 5 } } }) as never as { withMetadata: (m: unknown) => { png: () => { toBuffer: () => Promise<Buffer> } } })
      .withMetadata({ orientation: 6 }).png().toBuffer();
    const prepared = await prepareImagesForModel([`data:image/png;base64,${oriented.toString("base64")}`]);
    const m0 = prepared.meta[0];
    expect(m0.engine).toBe("sharp");
    expect((m0.height ?? 0)).toBeGreaterThan(m0.width ?? 0); // orientation appliquée puis retirée
  });

  it("MIME usurpé : déclaré image/png mais octets JPEG → sharp décode le VRAI contenu", async () => {
    const sharp = await loadSharp();
    const realJpeg = await (sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 1, g: 2, b: 3 } } }) as never as { jpeg: () => { toBuffer: () => Promise<Buffer> } }).jpeg().toBuffer();
    const prepared = await prepareImagesForModel([`data:image/png;base64,${realJpeg.toString("base64")}`]); // mime menteur
    expect(prepared.dataUrls.length).toBe(1);
    expect(prepared.meta[0].mime).toBe("image/jpeg"); // format RÉEL, pas le mime déclaré
  });

  it("fichier malformé → REFUSÉ (jamais envoyé)", async () => {
    const prepared = await prepareImagesForModel([`data:image/png;base64,${Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]).toString("base64")}`]);
    expect(prepared.dataUrls.length).toBe(0);
    expect(prepared.rejected.length).toBe(1);
  });
});

describe("P9.4.2 r2 §9 — sharp OBLIGATOIRE : indisponible/échec → REFUS (pas de dégradation silencieuse)", () => {
  it("image non décodable par sharp SANS drapeau dégradé → REFUSÉE (pas de chunk-strip)", async () => {
    // Le faux PNG (IDAT bidon) n'est pas décodable par sharp. En production, on REFUSE.
    const prepared = await prepareImagesForModel([`data:image/png;base64,${b64(png(64, 64, true))}`]);
    expect(prepared.dataUrls.length).toBe(0);
    expect(prepared.report.engine).toBe("rejected");
    expect(prepared.rejected[0]?.reason).toBe("sharp_transform_failed");
    expect(prepared.report.metadataStripped).toBe(false);
  });

  it("MODE DÉGRADÉ LOCAL/TEST (CLONECHAT_IMAGE_DEGRADED_OK=1) : chunk-strip autorisé, sans resize", async () => {
    vi.stubEnv("CLONECHAT_IMAGE_DEGRADED_OK", "1");
    const prepared = await prepareImagesForModel([`data:image/png;base64,${b64(png(64, 64, true))}`]);
    expect(prepared.dataUrls.length).toBe(1);
    expect(prepared.meta[0].engine).toBe("chunk-strip");
    expect(prepared.meta[0].resized).toBe(false);
    expect(has(outUrlBytes(prepared.dataUrls[0]), "GPS:48.85")).toBe(false); // métadonnée quand même retirée
  });
});
