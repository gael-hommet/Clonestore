#!/usr/bin/env node
// BLOC FINAL §4 — application SÛRE des migrations Founder Access sur une base réelle.
// Usage : DATABASE_URL=postgres://... node scripts/apply-founder-access-production.mjs [--production]
//
// Exige une URL explicite. En --production : refuse localhost. Applique les migrations
// clonestore_founder dans l'ordre, chacune dans une transaction, s'arrête au premier
// échec, ne masque aucune erreur, idempotent (re-jouable). Aucun secret affiché.

import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG_DIR = resolve(process.cwd(), "supabase/migrations");
const args = new Set(process.argv.slice(2));
const production = args.has("--production");
const url = process.env.DATABASE_URL ?? process.env.CLONESTORE_FOUNDER_DATABASE_URL;

function redactTarget(u) {
  try { const x = new URL(u); return `${x.protocol}//${x.username ? "***@" : ""}${x.hostname}:${x.port || "5432"}${x.pathname}`; }
  catch { return "(url illisible)"; }
}

if (!url) { console.error("[apply] DATABASE_URL requise (aucune URL → fail-closed)."); process.exit(2); }
if (production) {
  try { const h = new URL(url).hostname; if (h === "localhost" || h === "127.0.0.1") { console.error("[apply] --production refusé sur localhost."); process.exit(2); } } catch {}
}

function migrationFiles() {
  return readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql") && f.includes("clonestore_founder")).sort();
}

(async () => {
  const files = migrationFiles();
  if (files.length === 0) { console.error("[apply] aucune migration clonestore_founder trouvée."); process.exit(1); }
  console.log(`[apply] cible : ${redactTarget(url)}`);
  console.log(`[apply] migrations : ${files.length}`);

  const spec = ["p", "g"].join("");
  const { default: pg } = await import(spec);
  const pool = new pg.Pool({ connectionString: url, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
  const proof = { timestamp: new Date().toISOString(), target: redactTarget(url), applied: [], ok: false };
  try {
    for (const f of files) {
      const sql = readFileSync(resolve(MIG_DIR, f), "utf-8");
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("commit");
        console.log(`  ✓ ${f}`);
        proof.applied.push({ file: f, ok: true });
      } catch (e) {
        await client.query("rollback").catch(() => {});
        console.error(`  ✗ ${f} : ${e.message}`);
        proof.applied.push({ file: f, ok: false, error: e.message });
        throw e; // s'arrêter au premier échec
      } finally { client.release(); }
    }
    proof.ok = true;
    console.log("[apply] OK — migrations appliquées. Lancez ensuite verify-founder-access-production-db.mjs");
  } catch (e) {
    console.error("[apply] ÉCHEC :", e.message);
  } finally { await pool.end(); }
  console.log("PROOF " + JSON.stringify(proof));
  process.exit(proof.ok ? 0 : 1);
})();
