#!/usr/bin/env node
// E1.1 — RECENT SOURCE CHANGES (read-only forensics).
// Lists every source file under src/ + supabase/ modified within the last N minutes (default 20).
// Used to detect a still-active concurrent workstream, including paths outside the partner snapshot
// perimeter. Prints paths + mtimes only — never file contents, never secrets.
//
// Usage: node scripts/e1-1-recent-changes.mjs [minutes]

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const minutes = Number(process.argv[2] ?? 20);
const cutoff = Date.now() - minutes * 60 * 1000;
const SKIP = new Set(["node_modules", ".next", ".git", ".next-p942"]);
const hits = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && /\.(ts|tsx|sql|mjs|json)$/.test(e.name)) {
      const s = statSync(p);
      if (s.mtimeMs > cutoff) {
        hits.push({ mtime: s.mtime.toISOString(), path: relative(process.cwd(), p).split("\\").join("/"), size: s.size });
      }
    }
  }
}

for (const root of ["src", "supabase", "scripts"]) walk(root);
hits.sort((a, b) => a.mtime.localeCompare(b.mtime));

console.log(`Source files modified in the last ${minutes} min (now=${new Date().toISOString()}):`);
if (!hits.length) console.log("  none");
for (const h of hits) console.log(`  ${h.mtime}  ${h.path}`);
console.log(JSON.stringify({ scannedAtIso: new Date().toISOString(), windowMinutes: minutes, count: hits.length, hits }, null, 2));
