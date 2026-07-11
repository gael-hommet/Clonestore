#!/usr/bin/env node
// scripts/clonechat-build-site-index.mjs
// C1.1 — Génère .c1-1-index/site-index.json à partir des VRAIES pages Next
// (src/app/**/page.tsx) : aucune route inventée. Chaque entrée porte la route dérivée
// du système de fichiers, le titre de metadata s'il existe, et le hash du fichier
// source (fraîcheur). Aucun démon : exécution à la demande.

import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const APP = resolve(ROOT, "src/app");
const norm = (p) => p.split(sep).join("/");

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "pfnv_" + h.toString(16).padStart(8, "0");
}

function walkPages(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (name === "api" || name === "__tests__") continue;
      walkPages(full, out);
    } else if (name === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

/** Route dérivée du chemin fichier : les groupes (x) sont ignorés, [slug] conservé. */
function routeOf(pageFile) {
  const rel = norm(relative(APP, pageFile)).replace(/\/page\.tsx$/, "");
  const segments = rel.split("/").filter((s) => s.length > 0 && !/^\(.*\)$/.test(s));
  return "/" + segments.join("/");
}

function metaTitle(source) {
  const m = source.match(/title:\s*["'`]([^"'`]{2,120})["'`]/);
  return m ? m[1] : null;
}
function metaDescription(source) {
  const m = source.match(/description:\s*["'`]([^"'`]{2,200})["'`]/);
  return m ? m[1] : null;
}
function headings(source) {
  return [...source.matchAll(/<h[12][^>]*>\s*([^<{][^<]{2,90})</g)].map((m) => m[1].trim()).slice(0, 3);
}

const pages = walkPages(APP)
  .map((file) => {
    const source = readFileSync(file, "utf8");
    const route = routeOf(file) || "/";
    return {
      route,
      dynamicParams: [...route.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]),
      title: metaTitle(source),
      description: metaDescription(source),
      headings: headings(source),
      sourcePath: norm(relative(ROOT, file)),
      sourceHash: fnv1a(source),
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const manifest = {
  generatedAt: new Date().toISOString(),
  pageCount: pages.length,
  // Hash d'arbre : change dès qu'une page apparaît, disparaît ou change de contenu.
  sourceTreeHash: fnv1a(pages.map((p) => `${p.route}:${p.sourceHash}`).join("\n")),
  pages,
};

const outDir = resolve(ROOT, ".c1-1-index");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "site-index.json"), JSON.stringify(manifest, null, 2));

console.log(`[c1.1] site index: ${pages.length} pages réelles · tree=${manifest.sourceTreeHash} (aucune route inventée)`);
