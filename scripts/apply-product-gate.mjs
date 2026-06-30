// scripts/apply-product-gate.mjs
// PHASE 8.6 — one-shot codemod: convert every GATED pierre/v1 route+method from withTenant(req, ...) to
// withProductAccess(req, "<requirement>", ...) per the canonical manifest. Idempotent: a method already
// gated (no withTenant call in its body) is left untouched. Allowlisted routes are never touched.
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

const ROOT = process.cwd();
const V1_DIR = resolve(ROOT, "src/app/api/pierre/v1");
const MANIFEST = resolve(ROOT, "src/lib/pierre/v1/product-access-route-manifest.ts");

const REQUIREMENT_OF = { READ: "read", ONBOARDING: "onboarding", WRITE_STANDARD: "write_standard", WRITE_COSTLY: "write_costly", ADMIN: "admin" };
const GATED = new Set(Object.keys(REQUIREMENT_OF));

// ── parse the manifest literal → key → { METHOD: class } ──────────────────────────────
function parseManifest() {
  const txt = readFileSync(MANIFEST, "utf-8");
  const block = txt.slice(txt.indexOf("export const ROUTE_MANIFEST"));
  const map = {};
  const entryRe = /"(pierre\/v1\/[^"]+)":\s*\{([^}]*)\}/g;
  let m;
  while ((m = entryRe.exec(block))) {
    const key = m[1];
    const methods = {};
    const pairRe = /(GET|POST|PUT|PATCH|DELETE):\s*"(\w+)"/g;
    let p;
    while ((p = pairRe.exec(m[2]))) methods[p[1]] = p[2];
    map[key] = methods;
  }
  return map;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

function routeKey(file) {
  const norm = file.replace(/\\/g, "/");
  const marker = "app/api/";
  const i = norm.lastIndexOf(marker);
  return norm.slice(i + marker.length).replace(/\/route\.ts$/, "");
}

const manifest = parseManifest();
const files = walk(V1_DIR);
let changed = 0;
const report = [];

for (const file of files) {
  const key = routeKey(file);
  const methods = manifest[key];
  if (!methods) { report.push(`SKIP (not in manifest): ${key}`); continue; }
  const gatedMethods = Object.entries(methods).filter(([, c]) => GATED.has(c));
  if (gatedMethods.length === 0) continue; // allowlisted route — never touched

  let src = readFileSync(file, "utf-8");
  const before = src;

  for (const [method, cls] of gatedMethods) {
    const req = REQUIREMENT_OF[cls];
    const fnRe = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`);
    const fm = fnRe.exec(src);
    if (!fm) { report.push(`WARN: ${key} ${method} not found as exported async fn`); continue; }
    const start = fm.index;
    const nextExport = src.indexOf("\nexport ", start + 1);
    const end = nextExport === -1 ? src.length : nextExport;
    const head = src.slice(0, start);
    let body = src.slice(start, end);
    const tail = src.slice(end);
    // replace every withTenant(req,  in this method body with the gated call
    body = body.replace(/withTenant\(req,\s*/g, `withProductAccess(req, "${req}", `);
    src = head + body + tail;
  }

  // ── fix the _runtime import: add withProductAccess, drop withTenant if no longer used ──
  if (src !== before) {
    const stillUsesTenant = /withTenant\(/.test(src);
    const usesPA = /withProductAccess\(/.test(src);
    src = src.replace(/import\s*\{([^}]*)\}\s*from\s*"([^"]*_runtime)"\s*;/, (full, names, path) => {
      let list = names.split(",").map((s) => s.trim()).filter(Boolean);
      if (!stillUsesTenant) list = list.filter((n) => n !== "withTenant");
      if (usesPA && !list.includes("withProductAccess")) list.unshift("withProductAccess");
      return `import { ${list.join(", ")} } from "${path}";`;
    });
    writeFileSync(file, src, "utf-8");
    changed++;
    report.push(`GATED: ${key} → ${gatedMethods.map(([m, c]) => `${m}:${REQUIREMENT_OF[c]}`).join(", ")}`);
  }
}

console.log(report.join("\n"));
console.log(`\n${changed} files modified.`);
