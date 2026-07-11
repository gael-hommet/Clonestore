#!/usr/bin/env node
// Validation des scripts opérateur contre un VRAI Postgres (embedded-postgres).
// Prouve : apply (2× = idempotent) + preflight (GO) + postcheck (tout vert), sur un serveur
// Postgres réel jetable. N'affecte aucune base de production. Sortie non-zéro si un échec.

import { execFileSync } from "child_process";
import { existsSync, rmSync } from "fs";
import { resolve } from "path";

const PORT = 54329;
const DATADIR = resolve(process.cwd(), ".partner-proofs", "pgdata-validate");
const URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/ppcheck`;

function run(script, extraEnv = {}) {
  return execFileSync(process.execPath, [resolve(process.cwd(), "scripts", script)], {
    env: { ...process.env, DATABASE_URL: URL, PGSSL: "disable", ...extraEnv },
    stdio: "pipe", encoding: "utf-8",
  });
}

(async () => {
  const EmbeddedPostgres = (await import("embedded-postgres")).default;
  const { default: pg } = await import("pg");
  if (existsSync(DATADIR)) rmSync(DATADIR, { recursive: true, force: true });
  const epg = new EmbeddedPostgres({ databaseDir: DATADIR, user: "postgres", password: "postgres", port: PORT, persistent: false });
  let failed = false;
  try {
    await epg.initialise();
    await epg.start();
    const boot = new pg.Pool({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres", max: 1 });
    // Base UTF-8 (comme Supabase) — sinon le Postgres embarqué Windows crée en WIN1252 et
    // rejette les caractères Unicode des commentaires SQL. lc C = compatible UTF-8 partout.
    try { await boot.query("create database ppcheck with encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'"); } finally { await boot.end(); }

    console.log("\n=== 1) PRÉFLIGHT (base vierge) ===");
    console.log(run("partner-program-preflight.mjs"));

    console.log("=== 2) APPLY (1ʳᵉ fois) ===");
    console.log(run("apply-partner-program-production.mjs"));

    console.log("=== 3) APPLY (2ᵉ fois — idempotence) ===");
    console.log(run("apply-partner-program-production.mjs"));

    console.log("=== 4) POSTCHECK ===");
    console.log(run("partner-program-postcheck.mjs"));

    console.log("\n✅ VALIDATION OK — les 3 scripts opérateur fonctionnent sur un vrai Postgres (apply idempotent, preflight, postcheck tout vert).");
  } catch (e) {
    failed = true;
    console.error("\n❌ VALIDATION ÉCHOUÉE");
    if (e.stdout) console.error(String(e.stdout));
    if (e.stderr) console.error(String(e.stderr));
    if (!e.stdout && !e.stderr) console.error(e.message);
  } finally {
    try { await epg.stop(); } catch {}
    try { if (existsSync(DATADIR)) rmSync(DATADIR, { recursive: true, force: true }); } catch {}
    process.exit(failed ? 1 : 0);
  }
})();
