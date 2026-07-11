#!/usr/bin/env node
// Cabinets Fondateurs — application SÛRE des migrations sur une base réelle.
// Usage : DATABASE_URL=postgres://... node scripts/apply-partner-program-production.mjs [--production]
//
// Applique, DANS L'ORDRE, les migrations du programme partenaires + le ledger d'événements
// orders : clonestore_pp_{core,finance,emails} puis clonestore_orders_stripe_events.
// Chaque fichier dans SA transaction. S'arrête au premier échec, ne masque aucune erreur,
// idempotent (re-jouable). Aucun secret affiché. En --production : refuse localhost.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const MIG_DIR = resolve(process.cwd(), "supabase/migrations");
const args = new Set(process.argv.slice(2));
const production = args.has("--production");
const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;

function redactTarget(u) {
  try { const x = new URL(u); return `${x.protocol}//${x.username ? "***@" : ""}${x.hostname}:${x.port || "5432"}${x.pathname}`; }
  catch { return "(url illisible)"; }
}
// SSL désactivé pour un hôte local (localhost/127.0.0.1/::1) ou si PGSSL=disable ;
// sinon TLS avec rejectUnauthorized=false (requis par Supabase).
function sslFor(u) {
  if (process.env.PGSSL === "disable") return false;
  try { const h = new URL(u).hostname; if (h === "localhost" || h === "127.0.0.1" || h === "::1") return false; } catch {}
  return { rejectUnauthorized: false };
}

if (!url) { console.error("[pp-apply] DATABASE_URL requise (fail-closed)."); process.exit(2); }
if (production) {
  try { const h = new URL(url).hostname; if (h === "localhost" || h === "127.0.0.1") { console.error("[pp-apply] --production refusé sur localhost."); process.exit(2); } } catch {}
}

// Ordre déterministe : les migrations pp (_01,_02,_03) puis le ledger orders (_10).
function migrationFiles() {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql") && (f.includes("clonestore_pp") || f.includes("clonestore_orders_stripe_events")))
    .sort();
}

(async () => {
  const files = migrationFiles();
  if (files.length === 0) { console.error("[pp-apply] aucune migration trouvée."); process.exit(1); }
  console.log(`[pp-apply] cible : ${redactTarget(url)}`);
  console.log(`[pp-apply] migrations (${files.length}) :`); files.forEach((f) => console.log(`  - ${f}`));

  const spec = ["p", "g"].join("");
  const { default: pg } = await import(spec);
  const pool = new pg.Pool({ connectionString: url, ssl: sslFor(url), options: "-c client_encoding=UTF8" });
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
        throw e;
      } finally { client.release(); }
    }
    proof.ok = true;
    console.log("[pp-apply] OK — migrations appliquées. Lancez ensuite : node scripts/partner-program-postcheck.mjs");
  } catch {
    console.error("[pp-apply] ÉCHEC — arrêt au premier échec (aucune donnée détruite).");
  } finally {
    await pool.end();
    try { mkdirSync(resolve(process.cwd(), ".partner-proofs"), { recursive: true }); writeFileSync(resolve(process.cwd(), ".partner-proofs", "apply-proof.json"), JSON.stringify(proof, null, 2)); } catch {}
    process.exit(proof.ok ? 0 : 1);
  }
})();
