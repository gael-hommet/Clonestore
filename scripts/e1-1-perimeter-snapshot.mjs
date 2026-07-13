#!/usr/bin/env node
// E1.1 — PARTNER-PERIMETER SNAPSHOT (read-only).
// Captures path + size + mtimeMs + SHA-256 for the partner/migration/lockfile perimeter so that
// repository FREEZE can be PROVEN by comparing successive snapshots. Writes nothing but the snapshot
// file it is asked to write. Never prints a secret (only paths/sizes/hashes of source files).
//
// Usage: node scripts/e1-1-perimeter-snapshot.mjs <outFile>

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join, relative, dirname } from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();

// PERIMETER GAP FIXED (E1.1 continuation): the first pass omitted `src/app/api/cron`, which is
// exactly where the concurrent workstream wrote (the partner PAYOUT CRON lives there, not under
// `src/app/api/partners`). Three identical snapshots inside a too-narrow perimeter would have
// produced a FALSE "frozen" conclusion. Any path that can change partner BEHAVIOUR belongs here.
// WIDENED AGAIN (final freeze): the perimeter must cover every path that can change partner
// behaviour, the migration surfaces, and the build/type configuration that a green depends on.
const DIRS = [
  "src/lib/partner-program",
  "src/app/api/partners",
  "src/app/api/cron",        // ← partner payout cron (the file the concurrent workstream rewrote)
  "src/app/partenaires",
  "src/components/partenaires",
  "supabase/migrations",
  "supabase/migrations-p941",
];
const FILES = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "vercel.json",
  "vitest.config.ts",
  "vitest.integration.config.ts",
];

function walk(dir, out) {
  const abs = resolve(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const p = join(abs, entry.name);
    if (entry.isDirectory()) walk(relative(ROOT, p), out);
    else if (entry.isFile()) out.push(relative(ROOT, p).split("\\").join("/"));
  }
  return out;
}

const paths = [];
for (const d of DIRS) walk(d, paths);
for (const f of FILES) if (existsSync(resolve(ROOT, f))) paths.push(f);
paths.sort();

const entries = paths.map((p) => {
  const abs = resolve(ROOT, p);
  const st = statSync(abs);
  const sha256 = createHash("sha256").update(readFileSync(abs)).digest("hex");
  return { path: p, size: st.size, mtimeMs: Math.round(st.mtimeMs), sha256 };
});

// A single digest over the whole perimeter — the thing we compare between snapshots.
const perimeterDigest = createHash("sha256")
  .update(entries.map((e) => `${e.path}:${e.size}:${e.sha256}`).join("\n"))
  .digest("hex");

const snapshot = {
  takenAtIso: new Date().toISOString(),
  root: "clonestore",
  dirs: DIRS,
  files: FILES,
  fileCount: entries.length,
  // Content digest ignores mtime (a touch without a content change is not a code move).
  perimeterDigest,
  // mtime digest detects even a touch.
  mtimeDigest: createHash("sha256").update(entries.map((e) => `${e.path}:${e.mtimeMs}`).join("\n")).digest("hex"),
  entries,
};

const out = process.argv[2];
if (!out) {
  console.log(JSON.stringify({ fileCount: snapshot.fileCount, perimeterDigest, mtimeDigest: snapshot.mtimeDigest }, null, 2));
  process.exit(0);
}
const outAbs = resolve(ROOT, out);
mkdirSync(dirname(outAbs), { recursive: true });
writeFileSync(outAbs, JSON.stringify(snapshot, null, 2), "utf8");
console.log(`snapshot -> ${out}`);
console.log(`files=${snapshot.fileCount} perimeterDigest=${perimeterDigest.slice(0, 16)}… mtimeDigest=${snapshot.mtimeDigest.slice(0, 16)}…`);
