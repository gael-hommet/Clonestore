#!/usr/bin/env node
// scripts/clonechat-verify-knowledge-freshness.mjs
// C1.1 — Vérifie la fraîcheur des index GÉNÉRÉS (site, code) contre les sources réelles.
// Un index dont le hash d'arbre source a changé est PÉRIMÉ (sortie code 1 en mode --strict).
// Les registres canoniques légers (routes, capacités, T1/T2, pricing) sont dérivés en
// LIVE par le runtime : ils ne peuvent pas devenir périmés. Aucun démon.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const strict = process.argv.includes("--strict");
const norm = (p) => p.split(sep).join("/");

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "pfnv_" + h.toString(16).padStart(8, "0");
}

// EXCLUDES / ALLOWLIST / SECRET_PATTERNS doivent rester STRICTEMENT identiques à
// scripts/clonechat-build-code-index.mjs, sinon les hash d'arbre divergent à tort.
const EXCLUDES = [/\.env/i, /node_modules/, /\.next/, /(^|[\\/])dist[\\/]/, /\.p\d+[\w.-]*-proofs/, /\.c1(-1)?-proofs/, /\.c1-1-index/, /uploads?/i, /secret|credential|private-?key/i, /\.(png|jpg|jpeg|webp|ico|pdf|zip|db|sqlite|lock)$/i];
const ALLOWLIST = ["src/lib/clonechat", "src/lib/clonestore", "src/lib/pierre/v1", "src/app/api/assistant", "src/app/api/pierre", "src/components", "scripts"];
const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9]/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /SUPABASE_SERVICE_ROLE\s*=/i,
  /OPENAI_API_KEY\s*=\s*["'][^"']{10,}/i,
];

function walk(dir, filter, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    const rel = norm(relative(ROOT, full));
    if (EXCLUDES.some((rx) => rx.test(rel))) continue;
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, filter, out);
    else if (filter(name, rel)) out.push(full);
  }
  return out;
}

const results = [];

// ── Index site ────────────────────────────────────────────────────────────────
const sitePath = resolve(ROOT, ".c1-1-index/site-index.json");
if (!existsSync(sitePath)) {
  results.push({ index: "site-index", status: "MISSING", reason: "jamais généré (fail-closed : traité comme périmé)" });
} else {
  const manifest = JSON.parse(readFileSync(sitePath, "utf8"));
  const APP = resolve(ROOT, "src/app");
  const pages = walk(APP, (name, rel) => name === "page.tsx" && !rel.includes("/api/"));
  const seed = pages
    .map((f) => {
      const rel = norm(relative(APP, f)).replace(/\/page\.tsx$/, "");
      const segments = rel.split("/").filter((s) => s.length > 0 && !/^\(.*\)$/.test(s));
      return { route: "/" + segments.join("/") || "/", hash: fnv1a(readFileSync(f, "utf8")) };
    })
    .sort((a, b) => a.route.localeCompare(b.route))
    .map((p) => `${p.route}:${p.hash}`)
    .join("\n");
  const live = fnv1a(seed);
  results.push({
    index: "site-index",
    status: live === manifest.sourceTreeHash ? "CURRENT" : "STALE",
    reason: live === manifest.sourceTreeHash ? "identique aux pages réelles" : "les pages du site ont changé depuis la génération",
    recorded: manifest.sourceTreeHash,
    live,
  });
}

// ── Index code ────────────────────────────────────────────────────────────────
const codePath = resolve(ROOT, ".c1-1-index/code-index.json");
if (!existsSync(codePath)) {
  results.push({ index: "code-index", status: "MISSING", reason: "jamais généré (fail-closed : traité comme périmé)" });
} else {
  const manifest = JSON.parse(readFileSync(codePath, "utf8"));
  const files = walk(resolve(ROOT, "src"), (name, rel) => /\.(ts|tsx|mjs)$/.test(name) && ALLOWLIST.some((p) => rel.startsWith(p)))
    .concat(walk(resolve(ROOT, "scripts"), (name, rel) => /\.(ts|tsx|mjs)$/.test(name) && ALLOWLIST.some((p) => rel.startsWith(p))));
  let seed = "";
  for (const f of files.sort()) {
    const src = readFileSync(f, "utf8");
    if (SECRET_PATTERNS.some((rx) => rx.test(src))) continue;
    seed += `${norm(relative(ROOT, f))}:${fnv1a(src)}\n`;
  }
  const live = fnv1a(seed);
  results.push({
    index: "code-index",
    status: live === manifest.sourceTreeHash ? "CURRENT" : "STALE",
    reason: live === manifest.sourceTreeHash ? "identique à l'arbre source autorisé" : "le code a changé depuis la génération",
    recorded: manifest.sourceTreeHash,
    live,
  });
}

// ── Registres canoniques : dérivés live, jamais périmés ───────────────────────
results.push({ index: "route-registry", status: "LIVE_DERIVED", reason: "lu à la demande depuis src/lib/nav/route-registry.ts" });
results.push({ index: "capability-registry", status: "LIVE_DERIVED", reason: "lu à la demande depuis HR_CAPABILITIES" });
results.push({ index: "t1/t2-registries", status: "LIVE_DERIVED", reason: "lus à la demande depuis les registres T1/T2" });
results.push({ index: "pricing-resolver", status: "LIVE_DERIVED", reason: "résolu à la demande depuis country-pricing.ts" });

const stale = results.filter((r) => r.status === "STALE" || r.status === "MISSING");
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results, staleCount: stale.length }, null, 2));

if (strict && stale.length > 0) {
  console.error(`[c1.1] ${stale.length} index périmé(s)/absent(s) : ${stale.map((s) => s.index).join(", ")}`);
  process.exit(1);
}
