#!/usr/bin/env node
// PHASE 8.3-B2F §2 — historical-data preflight RUNNER (read-only).
// Runs the canonical preflight (src/lib/pierre/v1/data-integrity-preflight.ts) against:
//   • a real database when DATABASE_URL is set (node-postgres), or
//   • a fresh PGlite with all pierre_v* migrations applied (smoke: a clean schema → clean).
// It NEVER writes. Exit 0 only when status === "clean"; non-zero when a blocker exists.
// Output is structured JSON carrying only technical IDs (no PII).
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { runDataIntegrityPreflight } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/data-integrity-preflight.ts")).href);

async function pgliteExecutor() {
  const { PGlite } = await import("@electric-sql/pglite");
  const MIG = resolve(ROOT, "supabase/migrations");
  const files = readdirSync(MIG).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
  const pg = await PGlite.create();
  for (const f of files) await pg.exec(readFileSync(resolve(MIG, f), "utf-8"));
  return { db: { async query(text, params) { const r = await pg.query(text, params ? [...params] : undefined); return { rows: r.rows }; } }, label: `pglite(${files.length} migrations)`, close: () => pg.close() };
}

async function pgExecutor(url) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  return { db: { async query(text, params) { return pool.query(text, params); } }, label: "postgres(DATABASE_URL)", close: () => pool.end() };
}

const url = process.env.PIERRE_PREFLIGHT_DATABASE_URL || process.env.DATABASE_URL;
const { db, label, close } = url ? await pgExecutor(url) : await pgliteExecutor();
console.log(`\n══ PHASE 8.3-B2F §2 — Historical-data preflight (read-only) — target: ${label} ══\n`);
const result = await runDataIntegrityPreflight(db, new Date().toISOString());
await close();

for (const c of result.checks) {
  const mark = c.skipped ? "•" : c.ok ? "✅" : (c.severity === "blocker" ? "⛔" : "⚠️ ");
  const tail = c.skipped ? "(skipped: table/column absent)" : c.ok ? "" : `count=${c.count} sample=${c.sample_ids.slice(0, 5).join(",")}`;
  console.log(`  ${mark} [${c.severity}] ${c.key} ${tail}`);
}
console.log("\n" + JSON.stringify({ status: result.status, checked_at: result.checked_at, counts: result.counts,
  blockers: result.blockers.map((b) => ({ key: b.key, count: b.count })),
  warnings: result.warnings.map((w) => ({ key: w.key, count: w.count })) }, null, 2));
console.log("\n RÉSULTAT : " + (result.status === "clean" ? "CLEAN — les contraintes B2F peuvent être appliquées." : "BLOCKED — résoudre les blockers avant d'appliquer les contraintes.") + "\n");
process.exit(result.status === "clean" ? 0 : 1);
