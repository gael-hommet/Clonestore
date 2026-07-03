// scripts/p941-pg-keeper.mjs
// P9.4.1 — Garde un Postgres 16 PERSISTANT (embedded-postgres) vivant pour les preuves
// full-stack : le dev server s'y connecte via CLONECHAT_DB_URL et SURVIT aux restarts du
// dev server (les données vivent dans PG, pas dans le process Next). Applique la migration
// P9.4.1. Reste actif jusqu'à SIGINT/kill. Usage : node scripts/p941-pg-keeper.mjs [port]

import { readFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";

const ROOT = process.cwd();
const PORT = Number(process.argv[2] ?? 55450);
const DATADIR = resolve(ROOT, ".p941-proofs/pgdata-fullstack");
const MIG = resolve(ROOT, "supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql");
const FRESH = process.env.P941_PG_FRESH === "1";
mkdirSync(resolve(ROOT, ".p941-proofs"), { recursive: true });

const EmbeddedPostgres = (await import(pathToFileURL(resolve(ROOT, "node_modules/embedded-postgres/dist/index.js")).href)).default;
const pgLib = (await import(pathToFileURL(resolve(ROOT, "node_modules/pg/lib/index.js")).href)).default;

if (FRESH && existsSync(DATADIR)) rmSync(DATADIR, { recursive: true, force: true });
const epg = new EmbeddedPostgres({ databaseDir: DATADIR, user: "postgres", password: "postgres", port: PORT, persistent: true });
const wasFresh = !existsSync(DATADIR);
if (wasFresh) await epg.initialise();
await epg.start();

// db + migration (idempotents)
const boot = new pgLib.Pool({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres", max: 1 });
try {
  const exists = await boot.query("select 1 from pg_database where datname='ccdb'");
  if (exists.rowCount === 0) await boot.query("create database ccdb with encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'");
} finally { await boot.end(); }
const mig = new pgLib.Pool({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "ccdb", max: 1 });
try { await mig.query(readFileSync(MIG, "utf-8")); } finally { await mig.end(); }

console.log(`P941 PG KEEPER READY url=postgres://postgres:postgres@127.0.0.1:${PORT}/ccdb datadir=${DATADIR}`);

let stopping = false;
async function shutdown() { if (stopping) return; stopping = true; try { await epg.stop(); } catch {} console.log("P941 PG KEEPER STOPPED"); process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// Rester vivant.
setInterval(() => {}, 1 << 30);
