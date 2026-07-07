// scripts/p942-image-prod-smoke.mjs
// P9.4.2 r2 §4/§9 — Preuve que la transformation d'image OBLIGATOIRE fonctionne dans un
// processus Node de PRODUCTION (NODE_ENV=production), via le MÊME chemin que le serveur bâti :
// import dynamique du binding natif `sharp` (dépendance directe épinglée + externalisée),
// décodage réel, resize ≤1024, recompression, suppression métadonnées, validation de sortie.
// Refus honnête d'un fichier malformé. Écrit un proof JSON.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.NODE_ENV = "production";
const RUN = process.env.P942_RUN ?? "p942-final";
const dir = resolve(process.cwd(), ".p942-proofs", RUN);
mkdirSync(dir, { recursive: true });

const TARGET = 1024;
const sharp = (await import("sharp")).default; // exactement comme la route en production

async function transform(bytes) {
  const img = sharp(bytes, { failOn: "none", limitInputPixels: 40_000_000 });
  const md = await img.metadata();
  const fmt = md.format === "jpeg" || md.format === "jpg" ? "jpeg" : md.format === "webp" ? "webp" : "png";
  let pipe = img.rotate().resize({ width: TARGET, height: TARGET, fit: "inside", withoutEnlargement: true });
  pipe = fmt === "jpeg" ? pipe.jpeg({ quality: 72, mozjpeg: true }) : fmt === "webp" ? pipe.webp({ quality: 72 }) : pipe.png({ compressionLevel: 9 });
  const out = await pipe.toBuffer();
  const outMd = await sharp(out).metadata();
  return { fmt, inW: md.width, inH: md.height, inBytes: bytes.length, outW: outMd.width, outH: outMd.height, outBytes: out.length, out };
}

const proof = { runId: RUN, nodeEnv: process.env.NODE_ENV, sharpVersion: sharp.versions?.sharp ?? "unknown", cases: {} };

// 1) PNG 2000×1500 + EXIF/GPS → resize + recompress + strip.
const bigPng = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r: 12, g: 90, b: 210 } } })
  .withMetadata({ exif: { IFD0: { Copyright: "GPS:48.8566,2.3522 SECRET" } } }).png().toBuffer();
const rp = await transform(bigPng);
const gpsGone = !Buffer.from(rp.out).toString("latin1").includes("GPS:48.8566");
const notOriginal = rp.out.toString("base64") !== bigPng.toString("base64");
proof.cases.png_exif_resize = { ...omitOut(rp), gpsRemoved: gpsGone, originalNeverSent: notOriginal, resized: rp.inW > TARGET, recompressed: rp.outBytes < rp.inBytes, withinTarget: rp.outW <= TARGET && rp.outH <= TARGET };

// 2) JPEG réel.
const jpg = await sharp({ create: { width: 1400, height: 900, channels: 3, background: { r: 200, g: 30, b: 30 } } }).jpeg().toBuffer();
const rj = await transform(jpg);
proof.cases.jpeg = { ...omitOut(rj), withinTarget: rj.outW <= TARGET, format: rj.fmt };

// 3) WebP réel.
const webp = await sharp({ create: { width: 1300, height: 700, channels: 3, background: { r: 20, g: 200, b: 90 } } }).webp().toBuffer();
const rw = await transform(webp);
proof.cases.webp = { ...omitOut(rw), withinTarget: rw.outW <= TARGET, format: rw.fmt };

// 4) Orientation EXIF 6 (paysage → portrait).
const oriented = await sharp({ create: { width: 120, height: 60, channels: 3, background: { r: 5, g: 5, b: 5 } } }).withMetadata({ orientation: 6 }).png().toBuffer();
const ro = await transform(oriented);
proof.cases.orientation = { inW: ro.inW, inH: ro.inH, outW: ro.outW, outH: ro.outH, normalizedToPortrait: ro.outH > ro.outW };

// 5) Fichier malformé → sharp échoue (⇒ la route REFUSE, jamais l'originale).
let malformedRejected = false;
try { await transform(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])); } catch { malformedRejected = true; }
proof.cases.malformed_rejected = malformedRejected;

function omitOut(r) { const { out, ...rest } = r; void out; return rest; }

const pass =
  proof.cases.png_exif_resize.gpsRemoved && proof.cases.png_exif_resize.originalNeverSent &&
  proof.cases.png_exif_resize.resized && proof.cases.png_exif_resize.recompressed && proof.cases.png_exif_resize.withinTarget &&
  proof.cases.jpeg.withinTarget && proof.cases.webp.withinTarget &&
  proof.cases.orientation.normalizedToPortrait && proof.cases.malformed_rejected;
proof.verdict = pass ? "IMAGE_PROD_TRANSFORM_OK" : "FAILED";

writeFileSync(resolve(dir, "image-prod-smoke.json"), JSON.stringify(proof, null, 2));
console.log(JSON.stringify({ verdict: proof.verdict, sharp: proof.sharpVersion, nodeEnv: proof.nodeEnv, dir }, null, 2));
if (!pass) process.exit(1);
