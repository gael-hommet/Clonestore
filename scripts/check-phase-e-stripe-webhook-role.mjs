#!/usr/bin/env node
// E-R3 §2/§6 — vérifie réellement que le journal Stripe n'est écrivable que par le
// rôle webhook dédié. Applique le socle pierre_v* + Founder Access sur PGlite, puis :
//   • SET ROLE clonestore_stripe_webhook_writer → EXECUTE OK, INSERT brut refusé ;
//   • SET ROLE pierre_rt_app (rôle applicatif général) → EXECUTE refusé, INSERT refusé.
// Comportement réel, pas un grep.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG_DIR = resolve(process.cwd(), "supabase/migrations");
function migrations() {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql") && (f.includes("pierre_v") || f.includes("clonestore_founder")))
    .sort();
}
function assert(cond, msg) { if (!cond) { console.error(`  ✗ ${msg}`); process.exitCode = 1; throw new Error(msg); } console.log(`  ✓ ${msg}`); }

async function roleCheck(pg, role) {
  await pg.exec(`set role ${role}`);
  const r = await pg.query(
    `select has_function_privilege(current_user,'clonestore_record_founder_stripe_event(jsonb)','EXECUTE') as can_exec,
            has_table_privilege(current_user,'clonestore_founder_stripe_events','INSERT') as raw_insert`);
  await pg.exec("reset role");
  return { can_exec: r.rows[0].can_exec, raw_insert: r.rows[0].raw_insert };
}

(async () => {
  const pg = await PGlite.create();
  for (const f of migrations()) await pg.exec(readFileSync(resolve(MIG_DIR, f), "utf-8"));
  console.log("[check] rôle d'écriture du journal Stripe :");

  const writer = await roleCheck(pg, "clonestore_stripe_webhook_writer");
  assert(writer.can_exec === true, "writer dédié : EXECUTE de la fonction de journalisation accordé");
  assert(writer.raw_insert === false, "writer dédié : INSERT brut refusé (moindre privilège)");

  const app = await roleCheck(pg, "pierre_rt_app");
  assert(app.can_exec === false, "rôle applicatif général : EXECUTE refusé");
  assert(app.raw_insert === false, "rôle applicatif général : INSERT brut refusé");

  // Tentative réelle de forge sous le rôle général → doit échouer.
  await pg.exec("set role pierre_rt_app");
  let blocked = false;
  try { await pg.query("select clonestore_record_founder_stripe_event('{\"stripe_event_id\":\"x\",\"event_type\":\"checkout.session.completed\",\"processing_result\":\"applied\"}'::jsonb)"); }
  catch { blocked = true; }
  await pg.exec("reset role");
  assert(blocked, "forge sous pierre_rt_app : EXECUTE réellement refusé à l'exécution");

  await pg.close();
  console.log(process.exitCode === 1 ? "[check] ÉCHEC" : "[check] OK — journal Stripe écrivable uniquement par le rôle webhook dédié");
})().catch((e) => { console.error("[check] FAILED:", e.message); process.exit(1); });
