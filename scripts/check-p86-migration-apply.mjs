// scripts/check-p86-migration-apply.mjs
// P8.6 — prove migration chain pierre_v1 → pierre_v28 applies on a VIRGIN PGlite DB and that v28
// re-applies idempotently. Mirrors the integration harness loader (same pierre_v filter + sort).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MIG_DIR = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
const v28 = files.find((f) => f.includes("pierre_v28"));
if (!v28) { console.error("FAIL: v28 migration not found"); process.exit(1); }

const pg = await PGlite.create();
try {
  for (const f of files) {
    try { await pg.exec(readFileSync(resolve(MIG_DIR, f), "utf-8")); }
    catch (e) { console.error(`FAIL applying ${f}:\n${e.message}`); process.exit(1); }
  }
  // idempotent re-apply of v28
  try { await pg.exec(readFileSync(resolve(MIG_DIR, v28), "utf-8")); }
  catch (e) { console.error(`FAIL re-applying v28 (not idempotent):\n${e.message}`); process.exit(1); }

  const tables = [
    "pierre_rt_commercial_events", "pierre_rt_product_entitlements", "pierre_rt_customer_activations",
    "pierre_rt_onboarding_sessions", "pierre_rt_onboarding_steps", "pierre_rt_company_access_events",
  ];
  for (const t of tables) {
    const r = await pg.query(`select to_regclass($1) as reg`, [t]);
    if (!r.rows[0].reg) { console.error(`FAIL: table ${t} missing`); process.exit(1); }
  }
  const roles = await pg.query(`select rolname from pg_roles where rolname in ('pierre_rt_billing_webhook','pierre_rt_customer_activation_worker')`);
  if (roles.rows.length !== 2) { console.error(`FAIL: expected 2 new roles, found ${roles.rows.length}`); process.exit(1); }

  const fns = await pg.query(`select proname from pg_proc where proname in (
    'pierre_rt_ingest_commercial_event','pierre_rt_apply_entitlement_event','pierre_rt_request_customer_activation',
    'pierre_rt_provision_customer_company','pierre_rt_complete_onboarding_step','pierre_rt_accept_membership_invitation',
    'pierre_rt_transfer_company_ownership')`);
  if (fns.rows.length < 7) { console.error(`FAIL: missing governed functions (found ${fns.rows.length}/7)`); process.exit(1); }

  // invitation reinforcement columns present
  const cols = await pg.query(`select column_name from information_schema.columns where table_name='pierre_rt_invitations' and column_name in ('email_normalized','accepted_by','updated_at','version')`);
  if (cols.rows.length !== 4) { console.error(`FAIL: invitation reinforcement columns missing (${cols.rows.length}/4)`); process.exit(1); }

  console.log(`PASS — v1→v28 applied (${files.length} migrations), v28 idempotent, ${tables.length} tables + 2 roles + governed functions present.`);
} finally { await pg.close(); }
