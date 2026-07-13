#!/usr/bin/env node
// E1.1 — compare two or more perimeter snapshots. Read-only.
// Usage: node scripts/e1-1-compare-snapshots.mjs <a.json> <b.json> [c.json ...]

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = process.argv.slice(2);
if (files.length < 2) { console.error("need >= 2 snapshots"); process.exit(2); }

const snaps = files.map((f) => ({ file: f, ...JSON.parse(readFileSync(resolve(process.cwd(), f), "utf8")) }));

let allEqual = true;
const diffReport = [];

for (let i = 1; i < snaps.length; i++) {
  const a = snaps[i - 1], b = snaps[i];
  const contentEqual = a.perimeterDigest === b.perimeterDigest;
  const mtimeEqual = a.mtimeDigest === b.mtimeDigest;
  const am = new Map(a.entries.map((e) => [e.path, e]));
  const bm = new Map(b.entries.map((e) => [e.path, e]));
  const diffs = [];
  for (const [p, e] of bm) {
    const o = am.get(p);
    if (!o) diffs.push({ kind: "ADDED", path: p });
    else if (o.sha256 !== e.sha256) diffs.push({ kind: "CHANGED", path: p });
    else if (o.mtimeMs !== e.mtimeMs) diffs.push({ kind: "TOUCHED", path: p });
  }
  for (const [p] of am) if (!bm.has(p)) diffs.push({ kind: "REMOVED", path: p });
  if (!contentEqual || !mtimeEqual || diffs.length) allEqual = false;
  diffReport.push({
    pair: `${a.file} -> ${b.file}`,
    takenAt: [a.takenAtIso, b.takenAtIso],
    fileCount: [a.fileCount, b.fileCount],
    contentEqual, mtimeEqual, diffs,
  });
  console.log(`${a.file} -> ${b.file}`);
  console.log(`  content=${contentEqual} mtime=${mtimeEqual} diffs=${diffs.length ? JSON.stringify(diffs) : "NONE"}`);
}

console.log(`\nALL_EQUAL=${allEqual}`);
console.log(JSON.stringify({ allEqual, snapshots: snaps.map((s) => ({ file: s.file, takenAtIso: s.takenAtIso, fileCount: s.fileCount, perimeterDigest: s.perimeterDigest, mtimeDigest: s.mtimeDigest })), comparisons: diffReport }, null, 2));
process.exit(allEqual ? 0 : 1);
