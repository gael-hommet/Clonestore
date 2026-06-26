#!/usr/bin/env node
// scripts/db/migrate.mjs
// PHASE 8.1 — programmatic migration runner.
//
// Applies the Pierre v1 runtime migration(s) to a real Postgres:
//   - default: a file-backed local PGlite database at ./.pglite-data (db:test:*),
//   - or, with --pg, to DATABASE_URL via node-postgres (staging/prod, manual).
//
// This replaces the manual "paste into Supabase SQL Editor" step for local/test.
// It does NOT prove production: applying to your real Supabase project is still a
// deliberate operator action (npm run db:migrate:pg with DATABASE_URL set).

import { readFileSync, readdirSync, rmSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(process.cwd());
const MIG_DIR = resolve(ROOT, "supabase/migrations");
const FILTER = process.env.MIGRATIONS_FILTER ?? "pierre_v"; // pierre_v1 + pierre_v2…
const DATA_DIR = process.env.PGLITE_DATA ?? resolve(ROOT, ".pglite-data");

const args = new Set(process.argv.slice(2));
const usePg = args.has("--pg");
const reset = args.has("--reset");

function migrationFiles() {
  return readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql") && f.includes(FILTER)).sort();
}

async function applyWithPGlite() {
  const { PGlite } = await import("@electric-sql/pglite");
  if (reset && existsSync(DATA_DIR)) {
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log(`[migrate] reset: removed ${DATA_DIR}`);
  }
  const db = await PGlite.create(DATA_DIR);
  for (const f of migrationFiles()) {
    const sql = readFileSync(resolve(MIG_DIR, f), "utf-8");
    await db.exec(sql);
    console.log(`[migrate] applied (pglite): ${f}`);
  }
  const { rows } = await db.query("select count(*)::int n from pierre_rt_companies");
  console.log(`[migrate] ok — pierre_rt_companies reachable (rows=${rows[0].n}). data dir: ${DATA_DIR}`);
  await db.close();
}

async function applyWithPg() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for --pg");
  const spec = ["p", "g"].join("");
  const { default: pg } = await import(spec);
  const pool = new pg.Pool({ connectionString: url });
  try {
    for (const f of migrationFiles()) {
      const sql = readFileSync(resolve(MIG_DIR, f), "utf-8");
      await pool.query(sql);
      console.log(`[migrate] applied (pg): ${f}`);
    }
    console.log("[migrate] ok — applied to DATABASE_URL");
  } finally {
    await pool.end();
  }
}

(async () => {
  const files = migrationFiles();
  if (files.length === 0) { console.error(`[migrate] no migrations match filter "${FILTER}"`); process.exit(1); }
  if (usePg) await applyWithPg();
  else await applyWithPGlite();
})().catch((e) => { console.error("[migrate] FAILED:", e.message); process.exit(1); });
