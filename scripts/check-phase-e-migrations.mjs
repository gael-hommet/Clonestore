#!/usr/bin/env node
// Phase E — vérification d'application des migrations Founder Access sur PostgreSQL
// réel (PGlite). Applique le socle runtime (pierre_v*) PUIS les migrations
// clonestore_founder, dans l'ordre lexical réel, sur une base remise à zéro, puis
// vérifie : tables présentes, colonnes E.3/E.4, append-only effectif (triggers).
//
// N.B. on n'applique pas le filtre ".sql" complet : la migration héritée
// 2026-02-03__pierre_queue_updated_at.sql n'est pas compatible PGlite (documenté).
// L'ordre réel appliqué ici = socle runtime + Founder Access.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG_DIR = resolve(process.cwd(), "supabase/migrations");

function migrationFiles() {
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql") && (f.includes("pierre_v") || f.includes("clonestore_founder")))
    .sort();
}

function assert(cond, msg) { if (!cond) { console.error(`  ✗ ${msg}`); process.exitCode = 1; throw new Error(msg); } console.log(`  ✓ ${msg}`); }

(async () => {
  const files = migrationFiles();
  if (files.length === 0) { console.error("[check] aucune migration trouvée"); process.exit(1); }

  const pg = await PGlite.create();
  console.log("[check] application des migrations (ordre réel) :");
  for (const f of files) {
    await pg.exec(readFileSync(resolve(MIG_DIR, f), "utf-8"));
    console.log(`   appliqué : ${f}`);
  }

  console.log("[check] vérifications de schéma :");
  const tables = [
    "clonestore_founder_reservations", "clonestore_founder_funnel_events", "clonestore_founder_email_jobs",
    "clonestore_web_sessions", "clonestore_web_events", "clonestore_founder_admin_audit",
    "clonestore_rate_limits", "clonestore_founder_stripe_events",
  ];
  for (const t of tables) {
    const r = await pg.query(`select to_regclass('public.${t}') as reg`);
    assert(r.rows[0].reg !== null, `table ${t} présente`);
  }

  const cols = async (table, col) => {
    const r = await pg.query(`select 1 from information_schema.columns where table_name=$1 and column_name=$2`, [table, col]);
    return r.rows.length > 0;
  };
  assert(await cols("clonestore_founder_reservations", "contact_status"), "colonne contact_status (E.2)");
  assert(await cols("clonestore_founder_reservations", "subscription_status"), "colonne subscription_status (E.4)");
  assert(await cols("clonestore_founder_email_jobs", "locked_at"), "colonne locked_at (E.3)");
  assert(await cols("clonestore_founder_email_jobs", "next_attempt_at"), "colonne next_attempt_at (E.3)");

  // Append-only : UPDATE/DELETE doivent être refusés par les triggers.
  await pg.query("insert into clonestore_founder_funnel_events (event_name) values ('t')");
  let blocked = false;
  try { await pg.query("update clonestore_founder_funnel_events set event_name='x'"); }
  catch { blocked = true; }
  assert(blocked, "funnel_events append-only (UPDATE refusé)");

  blocked = false;
  await pg.query("insert into clonestore_founder_admin_audit (actor_email, action) values ('a','b')");
  try { await pg.query("delete from clonestore_founder_admin_audit"); }
  catch { blocked = true; }
  assert(blocked, "admin_audit append-only (DELETE refusé)");

  await pg.close();
  console.log(process.exitCode === 1 ? "[check] ÉCHEC" : "[check] OK — sous-ensemble (socle pierre_v* + Founder Access) applicable et conforme. Ce n'est PAS l'intégralité du schéma projet (la migration héritée pierre_queue n'est pas compatible PGlite).");
})().catch((e) => { console.error("[check] FAILED:", e.message); process.exit(1); });
