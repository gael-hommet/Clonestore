#!/usr/bin/env node
// scripts/clonechat-build-code-index.mjs
// C1.1 — Génère .c1-1-index/code-index.json : manifeste BORNÉ de symboles exportés,
// FOUNDER_INTERNAL uniquement. Allowlist stricte ; exclusions dures (.env, secrets,
// node_modules, .next, uploads, binaires, dossiers de preuves). Résumés de symboles
// uniquement — JAMAIS de dump de fichier source. Hash d'arbre pour la fraîcheur.
// Aucun démon : exécution à la demande.

import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";

const ROOT = process.cwd();

const ALLOWLIST = [
  "src/lib/clonechat",
  "src/lib/clonestore",
  "src/lib/pierre/v1",
  "src/app/api/assistant",
  "src/app/api/pierre",
  "src/components",
  "scripts",
];

const EXCLUDES = [
  /\.env/i,
  /node_modules/,
  /\.next/,
  /(^|[\\/])dist[\\/]/,
  /\.p\d+[\w.-]*-proofs/,
  /\.c1(-1)?-proofs/,
  /\.c1-1-index/,
  /uploads?/i,
  /secret|credential|private-?key/i,
  /\.(png|jpg|jpeg|webp|ico|pdf|zip|db|sqlite|lock)$/i,
];

// Motifs de secret : un fichier qui en contient est IGNORÉ (jamais résumé, jamais indexé).
const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9]/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /SUPABASE_SERVICE_ROLE\s*=/i,
  /OPENAI_API_KEY\s*=\s*["'][^"']{10,}/i,
];

const norm = (p) => p.split(sep).join("/");
const allowed = (rel) => {
  const r = norm(rel);
  if (EXCLUDES.some((rx) => rx.test(r))) return false;
  return ALLOWLIST.some((prefix) => r.startsWith(prefix));
};

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "pfnv_" + h.toString(16).padStart(8, "0");
}

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (EXCLUDES.some((rx) => rx.test(norm(rel)))) continue;
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(name) && allowed(rel)) out.push(rel);
  }
  return out;
}

const KIND_RX =
  /^export\s+(?:async\s+)?(function|const|interface|type|class)\s+([A-Za-z_$][\w$]*)/;

/** Résumé : première ligne de commentaire au-dessus du symbole, sinon la signature tronquée. */
function summarize(lines, index, symbolName) {
  for (let i = index - 1; i >= Math.max(0, index - 4); i -= 1) {
    const l = lines[i].trim();
    if (l.startsWith("//") || l.startsWith("*") || l.startsWith("/**")) {
      const text = l.replace(/^\/\*\*?|^\*+\/?|^\/\//g, "").trim();
      if (text.length > 8) return text.slice(0, 200);
    }
  }
  return `${symbolName} — ${lines[index].trim().slice(0, 140)}`;
}

function phaseMarkers(source) {
  const found = new Set();
  for (const m of source.matchAll(/\b(P8(?:\.\d+)?|P9(?:\.\d+)?|P1[0-6](?:\.\d+)?|T1|T2|C1(?:\.1)?)\b/g)) found.add(m[1]);
  return [...found].slice(0, 6);
}

function importsOf(source) {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]).slice(0, 10);
}

// Ordre DÉTERMINISTE (chemins absolus triés) : le hash d'arbre doit être reproductible
// à l'identique par scripts/clonechat-verify-knowledge-freshness.mjs.
const files = walk(resolve(ROOT, "src"))
  .concat(walk(resolve(ROOT, "scripts")))
  .map((rel) => resolve(ROOT, rel))
  .sort()
  .map((abs) => relative(ROOT, abs));
const symbols = [];
let treeSeed = "";
let skippedSecret = 0;

for (const rel of files) {
  let source;
  try { source = readFileSync(resolve(ROOT, rel), "utf8"); } catch { continue; }
  if (SECRET_PATTERNS.some((rx) => rx.test(source))) { skippedSecret += 1; continue; }
  treeSeed += `${norm(rel)}:${fnv1a(source)}\n`;

  const lines = source.split(/\r?\n/);
  const isTest = /__tests__|\.test\.|\.itest\./.test(rel);
  const relatedTest = isTest ? [] : files.filter((f) => f.includes("__tests__") && f.includes(rel.split(sep).slice(0, -1).join("/"))).slice(0, 2).map(norm);

  for (let i = 0; i < lines.length && symbols.length < 4000; i += 1) {
    const m = KIND_RX.exec(lines[i]);
    if (!m) continue;
    const [, rawKind, symbolName] = m;
    const kind = isTest ? "test" : rawKind === "const" && /\(/.test(lines[i]) ? "function" : rawKind;
    symbols.push({
      symbolId: fnv1a(`${norm(rel)}#${symbolName}`),
      symbolName,
      kind,
      filePath: norm(rel),
      exported: true,
      lineStart: i + 1,
      lineEnd: null,
      summary: summarize(lines, i, symbolName),
      imports: importsOf(source),
      relatedTests: relatedTest,
      phaseMarkers: phaseMarkers(source),
      contentHash: fnv1a(lines[i]),
      visibility: "FOUNDER_INTERNAL",
    });
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  allowlistHash: fnv1a(ALLOWLIST.join("|")),
  sourceTreeHash: fnv1a(treeSeed),
  symbols,
};

const outDir = resolve(ROOT, ".c1-1-index");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "code-index.json"), JSON.stringify(manifest, null, 2));

console.log(
  `[c1.1] code index: ${symbols.length} symboles · ${files.length} fichiers autorisés · ${skippedSecret} fichier(s) ignoré(s) (secret) · tree=${manifest.sourceTreeHash}`,
);
