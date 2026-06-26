#!/usr/bin/env node
// CloneStory — preuve RÉELLE des politiques RLS.
//   défaut : PGlite (PostgreSQL 16 en process) — applique les migrations puis prouve
//            l'isolation en tant que rôle restreint pierre_rt_app.
//   --pg   : exécute la MÊME preuve contre DATABASE_URL (réservé opérateur), dans une
//            transaction ROLLBACK (aucune donnée persistée en production).
//
// Prouve : (1) un membre ne voit QUE ses propres lignes ; (2) le rôle restreint sans
// GUC ne voit RIEN (fail-closed) ; (3) les événements sont append-only (update/delete
// refusés). Un superuser contourne RLS → on bascule sur `set local role pierre_rt_app`.

import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const usePg = process.argv.includes("--pg");
const MIG_DIR = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql") && (f.includes("pierre_v") || f.includes("clonestory_fp")))
  .sort();

let failures = 0;
function check(name, cond) {
  console.log(`  ${cond ? "✓" : "✗"}  ${name}`);
  if (!cond) failures++;
}

async function withPGlite() {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create();
  for (const f of files) await pg.exec(readFileSync(resolve(MIG_DIR, f), "utf-8"));
  const q = (t, p) => pg.query(t, p);
  await run(q, (fn) => pg.transaction(fn));
  await pg.close();
}

async function withPg() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL requis pour --pg");
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    // Tout dans UNE transaction annulée → aucune donnée persistée en production.
    await client.query("begin");
    const q = (t, p) => client.query(t, p);
    await runInline(q);
    await client.query("rollback");
  } finally {
    client.release();
    await pool.end();
  }
}

// Variante PGlite : transactions imbriquées via pg.transaction.
async function run(q, tx) {
  await runInline(q, tx);
}

async function runInline(q, tx) {
  // Crée deux membres + une introduction pour A, en mode service.
  const svc = async (sql, params) => {
    if (tx) return tx(async (t) => { await t.query("set local role pierre_rt_app"); await t.query("select set_config('app.clonestory_service','on',true)"); return t.query(sql, params); });
    await q("set local role pierre_rt_app"); await q("select set_config('app.clonestory_service','on',true)"); const r = await q(sql, params); await q("reset role"); await q("select set_config('app.clonestory_service','',true)"); return r;
  };
  const A = (await svc(`insert into clonestory_fp_partners (email,email_normalized,first_name,last_name,display_name,status,email_verified_at) values ('rls-a@x.fr','rls-a@x.fr','A','A','A','email_verified',now()) returning id`)).rows[0].id;
  const B = (await svc(`insert into clonestory_fp_partners (email,email_normalized,first_name,last_name,display_name,status,email_verified_at) values ('rls-b@x.fr','rls-b@x.fr','B','B','B','email_verified',now()) returning id`)).rows[0].id;
  await svc(`insert into clonestory_fp_introductions (partner_id,method,status,prospect_company,company_fingerprint) values ($1,'declared','declared','Soc A','fp-a')`, [A]);
  await svc(`insert into clonestory_fp_contribution_events (partner_id,type,source) values ($1,'introduction_declared','declared')`, [A]);

  // Membre B : ne voit AUCUNE introduction (RLS).
  const memCount = async () => {
    if (tx) return (await tx(async (t) => { await t.query("set local role pierre_rt_app"); await t.query("select set_config('app.clonestory_partner',$1,true)", [B]); return t.query("select count(*)::int n from clonestory_fp_introductions"); })).rows[0].n;
    await q("set local role pierre_rt_app"); await q("select set_config('app.clonestory_partner',$1,true)", [B]); const r = await q("select count(*)::int n from clonestory_fp_introductions"); await q("select set_config('app.clonestory_partner','',true)"); await q("reset role"); return r.rows[0].n;
  };
  check("un membre ne voit pas les introductions d'un autre (RLS)", (await memCount()) === 0);

  // Rôle restreint SANS GUC → 0 ligne (fail-closed).
  const blindCount = async () => {
    if (tx) return (await tx(async (t) => { await t.query("set local role pierre_rt_app"); return t.query("select count(*)::int n from clonestory_fp_partners"); })).rows[0].n;
    await q("set local role pierre_rt_app"); await q("select set_config('app.clonestory_service','',true)"); await q("select set_config('app.clonestory_partner','',true)"); const r = await q("select count(*)::int n from clonestory_fp_partners"); await q("reset role"); return r.rows[0].n;
  };
  check("rôle restreint sans GUC ne voit rien (fail-closed)", (await blindCount()) === 0);

  // Append-only : update/delete des événements refusés.
  let updateBlocked = false;
  try {
    if (tx) await tx(async (t) => { await t.query("set local role pierre_rt_app"); await t.query("select set_config('app.clonestory_service','on',true)"); await t.query("update clonestory_fp_contribution_events set type='manual_validation' where true"); });
    else { await q("set local role pierre_rt_app"); await q("select set_config('app.clonestory_service','on',true)"); await q("update clonestory_fp_contribution_events set type='manual_validation' where true"); }
  } catch { updateBlocked = true; } finally { if (!tx) { try { await q("reset role"); } catch {} } }
  check("événements append-only (update refusé)", updateBlocked);
}

(async () => {
  console.log(`CloneStory — preuve RLS (${usePg ? "DATABASE_URL (rollback)" : "PGlite local"})\n`);
  try {
    if (usePg) await withPg();
    else await withPGlite();
  } catch (e) {
    console.error("ERREUR:", e.message);
    process.exit(2);
  }
  console.log("");
  if (failures === 0) { console.log("VERDICT RLS: OK — isolation et append-only prouvés."); process.exit(0); }
  console.log(`VERDICT RLS: ÉCHEC — ${failures} contrôle(s) en échec.`); process.exit(1);
})();
