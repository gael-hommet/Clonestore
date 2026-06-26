#!/usr/bin/env node
// CloneStory — VÉRIFICATION POST-MIGRATION (LECTURE SEULE). Prouve schéma _05.._08 + RLS
// forcée + politiques + triggers append-only + intégrité des données smoke + absence de
// fausses données. AUCUN secret, AUCUN email complet. Usage : node --env-file=.env.local
// scripts/clonestory-post-migration-verify.mjs --pg
import { resolve } from "path";

const usePg = process.argv.includes("--pg");
async function getClient() {
  if (usePg) {
    const url = process.env.DATABASE_URL;
    if (!url) { console.error("DATABASE_URL requis"); process.exit(1); }
    const { default: pg } = await import(["p", "g"].join(""));
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    const pool = new pg.Pool({ connectionString: url, ssl: isLocal ? undefined : { rejectUnauthorized: false } });
    return { query: (t, p) => pool.query(t, p), close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create(process.env.PGLITE_DATA ?? resolve(process.cwd(), ".pglite-data"));
  return { query: (t, p) => db.query(t, p), close: () => db.close() };
}

let pass = 0, fail = 0;
function check(label, ok, detail = "") { console.log(`  ${ok ? "✓" : "✗"}  ${label}${detail ? " — " + detail : ""}`); ok ? pass++ : fail++; }

async function main() {
  const c = await getClient();
  const one = async (sql, p) => { try { return (await c.query(sql, p)).rows[0]; } catch (e) { return { __err: e.message }; } };
  const num = async (sql, p) => { const r = await one(sql, p); return r && !r.__err ? Number(Object.values(r)[0]) : -1; };
  const colExists = async (t, col) => (await num(`select count(*)::int n from information_schema.columns where table_name=$1 and column_name=$2`, [t, col])) > 0;
  const tblExists = async (t) => (await num(`select count(*)::int n from information_schema.tables where table_name=$1`, [t])) > 0;

  console.log("\n— Tables & colonnes (_05.._08) —");
  check("_05 clonestory_fp_distinctions", await tblExists("clonestory_fp_distinctions"));
  check("_05 clonestory_fp_partner_awards", await tblExists("clonestory_fp_partner_awards"));
  check("_05 partners.account_user_id", await colExists("clonestory_fp_partners", "account_user_id"));
  check("_05 catalogue distinctions = 9", (await num(`select count(*)::int n from clonestory_fp_distinctions`)) === 9);
  check("_06 clonestory_fp_attributions", await tblExists("clonestory_fp_attributions"));
  check("_06 clonestory_fp_attribution_events", await tblExists("clonestory_fp_attribution_events"));
  check("_07 clonestory_fp_commercial_contributions", await tblExists("clonestory_fp_commercial_contributions"));
  check("_07 clonestory_fp_stripe_events", await tblExists("clonestory_fp_stripe_events"));
  check("_07 clonestory_fp_commercial_events", await tblExists("clonestory_fp_commercial_events"));
  check("_07 clonestory_fp_commercial_outbox", await tblExists("clonestory_fp_commercial_outbox"));
  check("_08 clonestory_fp_notifications_outbox", await tblExists("clonestory_fp_notifications_outbox"));
  check("_08 clonestory_fp_observability_events", await tblExists("clonestory_fp_observability_events"));
  check("_08 clonestory_fp_admin_notes", await tblExists("clonestory_fp_admin_notes"));
  check("_08 clonestory_fp_fraud_decisions", await tblExists("clonestory_fp_fraud_decisions"));
  check("_08 clonestory_fp_consents", await tblExists("clonestory_fp_consents"));
  check("_08 introductions.confirm_generation", await colExists("clonestory_fp_introductions", "confirm_generation"));
  check("_08 introductions.anonymized_at", await colExists("clonestory_fp_introductions", "anonymized_at"));
  check("_08 partners.anonymized_at", await colExists("clonestory_fp_partners", "anonymized_at"));

  console.log("\n— Sécurité : RLS forcée + politiques + append-only —");
  const rls = await c.query(`select relname, relrowsecurity r, relforcerowsecurity f from pg_class where relname like 'clonestory_fp_%' and relkind='r' order by relname`);
  let allForced = true; for (const x of rls.rows) if (!x.r || !x.f) { allForced = false; console.log(`     RLS non forcée: ${x.relname}`); }
  check(`RLS activée+forcée sur ${rls.rows.length} tables clonestory_fp_*`, allForced);
  const newTables = ["clonestory_fp_attributions", "clonestory_fp_commercial_contributions", "clonestory_fp_commercial_events", "clonestory_fp_stripe_events", "clonestory_fp_commercial_outbox", "clonestory_fp_notifications_outbox", "clonestory_fp_observability_events", "clonestory_fp_admin_notes", "clonestory_fp_fraud_decisions", "clonestory_fp_consents"];
  for (const t of newTables) {
    const np = await num(`select count(*)::int n from pg_policy join pg_class on pg_class.oid=pg_policy.polrelid where relname=$1`, [t]);
    if (np < 1) check(`politique présente: ${t}`, false, `${np} politique`);
  }
  check("toutes les nouvelles tables ont >=1 politique", (await Promise.all(newTables.map(async (t) => (await num(`select count(*)::int n from pg_policy join pg_class on pg_class.oid=pg_policy.polrelid where relname=$1`, [t]))))).every((n) => n >= 1));
  const appendOnly = ["clonestory_fp_commercial_events", "clonestory_fp_observability_events", "clonestory_fp_admin_notes", "clonestory_fp_fraud_decisions", "clonestory_fp_consents"];
  for (const t of appendOnly) {
    const trg = await num(`select count(*)::int n from pg_trigger join pg_class on pg_class.oid=pg_trigger.tgrelid where relname=$1 and not tgisinternal`, [t]);
    check(`append-only trigger: ${t}`, trg >= 1);
  }

  console.log("\n— Données smoke intactes (aucune fausse donnée) —");
  check("partenaires = 1", (await num(`select count(*)::int n from clonestory_fp_partners`)) === 1);
  check("introductions = 1", (await num(`select count(*)::int n from clonestory_fp_introductions`)) === 1);
  const p = await one(`select status, registry_number, personal_code, email_verified_at from clonestory_fp_partners limit 1`);
  check("partenaire smoke email_verified", p.status === "email_verified" && !!p.email_verified_at, p.status);
  check("partenaire smoke a son code (lien intact)", !!p.personal_code);
  check("partenaire smoke PAS de registry_number (aucune contribution vérifiée)", p.registry_number === null);
  const i = await one(`select status, dispute_flag from clonestory_fp_introductions limit 1`);
  check("introduction B = prospect_confirmed", i.status === "prospect_confirmed");
  check("introduction B sans litige", i.dispute_flag === false);
  check("aucun doublon partenaire (email_normalized)", (await num(`select count(*)::int n from (select email_normalized from clonestory_fp_partners group by email_normalized having count(*)>1) d`)) === 0);
  check("aucune attribution (0)", (await num(`select count(*)::int n from clonestory_fp_attributions`)) === 0);
  check("aucune contribution commerciale (0)", (await num(`select count(*)::int n from clonestory_fp_commercial_contributions`)) === 0);
  check("aucun event Stripe (0)", (await num(`select count(*)::int n from clonestory_fp_stripe_events`)) === 0);
  check("aucun award/distinction attribué (0)", (await num(`select count(*)::int n from clonestory_fp_partner_awards`)) === 0);
  check("aucune outbox commerciale parasite (0)", (await num(`select count(*)::int n from clonestory_fp_commercial_outbox`)) === 0);
  check("aucune outbox notifications parasite (0)", (await num(`select count(*)::int n from clonestory_fp_notifications_outbox`)) === 0);
  const ec = await num(`select count(*)::int n from clonestory_fp_contribution_events`);
  check("events de contribution inchangés (2)", ec === 2, `${ec}`);

  console.log(`\nVÉRIFICATION POST-MIGRATION: ${fail === 0 ? "OK" : "ANOMALIE"} (${pass} ✓ / ${fail} ✗)\n`);
  await c.close();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("[verify] échec:", e.message); process.exit(1); });
