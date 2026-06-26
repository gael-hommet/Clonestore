#!/usr/bin/env node
// scripts/db/backfill-tenancy.mjs
// PHASE 8.2 — run the idempotent tenancy backfill (legacy per-user ownership ->
// canonical pierre_rt_companies + owner pierre_rt_members).
//
//   node scripts/db/backfill-tenancy.mjs           # local file-backed PGlite
//   DATABASE_URL=... node scripts/db/backfill-tenancy.mjs --pg   # staging/prod
//
// Re-runnable with no duplication. Safe when legacy tables are absent (no-op).

import { resolve } from "path";

const args = new Set(process.argv.slice(2));
const usePg = args.has("--pg");
const DATA_DIR = process.env.PGLITE_DATA ?? resolve(process.cwd(), ".pglite-data");

async function withPGlite() {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create(DATA_DIR);
  const { rows } = await db.query("select * from pierre_rt_backfill_tenancy()");
  console.log(`[backfill] companies_created=${rows[0].companies_created} members_created=${rows[0].members_created} (pglite ${DATA_DIR})`);
  await db.close();
}

async function withPg() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required for --pg");
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url });
  try {
    const { rows } = await pool.query("select * from pierre_rt_backfill_tenancy()");
    console.log(`[backfill] companies_created=${rows[0].companies_created} members_created=${rows[0].members_created} (DATABASE_URL)`);
  } finally {
    await pool.end();
  }
}

(async () => { if (usePg) await withPg(); else await withPGlite(); })()
  .catch((e) => { console.error("[backfill] FAILED:", e.message); process.exit(1); });
