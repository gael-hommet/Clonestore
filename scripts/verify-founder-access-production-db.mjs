#!/usr/bin/env node
// BLOC FINAL §4 — vérification POST-application du schéma Founder Access sur la base réelle.
// Usage : DATABASE_URL=postgres://... node scripts/verify-founder-access-production-db.mjs
// Exit code non nul en cas d'écart. Aucun secret affiché.

const url = process.env.DATABASE_URL ?? process.env.CLONESTORE_FOUNDER_DATABASE_URL;
if (!url) { console.error("[verify] DATABASE_URL requise."); process.exit(2); }

const TABLES = ["clonestore_founder_reservations", "clonestore_founder_funnel_events", "clonestore_founder_email_jobs",
  "clonestore_web_sessions", "clonestore_web_events", "clonestore_founder_admin_audit", "clonestore_rate_limits", "clonestore_founder_stripe_events"];

(async () => {
  const spec = ["p", "g"].join("");
  const { default: pg } = await import(spec);
  const pool = new pg.Pool({ connectionString: url, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
  let bad = 0;
  const ok = (name, cond, detail = "") => { if (cond) console.log(`  ✓ ${name} ${detail}`); else { console.error(`  ✗ ${name} ${detail}`); bad++; } };
  try {
    const id = await pool.query("select current_user, current_role, version()");
    console.log(`[verify] current_user=${id.rows[0].current_user} role=${id.rows[0].current_role}`);
    console.log(`[verify] ${id.rows[0].version.split(",")[0]}`);

    for (const t of TABLES) {
      const r = await pool.query(`select to_regclass('public.${t}') as reg`);
      ok(`table:${t}`, r.rows[0].reg !== null);
    }
    const fn = await pool.query("select count(*)::int n from pg_proc where proname='clonestore_record_founder_stripe_event'");
    ok("function:journal_writer", Number(fn.rows[0].n) > 0);

    // Append-only — aligné sur src/lib/founder-access/production-verify.ts : robuste quelle
    // que soit la connexion. 1) on tente la mutation ; 2) si refusée → conforme ; 3) sinon
    // (propriétaire/table vide : ni REVOKE ni trigger ligne ne se déclenchent), on confirme
    // que le trigger anti-mutation `clonestore_forbid_mutation` est réellement attaché.
    const triggerArmed = async (table) => {
      const r = await pool.query(
        `select count(*)::int n from pg_trigger tg
           join pg_class c on c.oid = tg.tgrelid
           join pg_proc p on p.oid = tg.tgfoid
          where c.relname = $1 and not tg.tgisinternal and p.proname = 'clonestore_forbid_mutation'`, [table]);
      return Number(r.rows[0].n) > 0;
    };
    const appendOnly = async (name, table, mutation) => {
      let raised = false;
      try { await pool.query(mutation); } catch { raised = true; }
      if (raised) { ok(name, true, "(mutation refusée)"); return; }
      const armed = await triggerArmed(table);
      ok(name, armed, armed ? "(trigger anti-mutation attaché)" : "(MUTATION AUTORISÉE)");
    };
    await appendOnly("append_only:funnel_update_blocked", "clonestore_founder_funnel_events",
      "update clonestore_founder_funnel_events set event_name='x' where false");
    await appendOnly("append_only:audit_delete_blocked", "clonestore_founder_admin_audit",
      "delete from clonestore_founder_admin_audit where false");

    // Grants (moindre privilège).
    const g = async (q) => (await pool.query(q)).rows[0].v;
    ok("grant:pierre_rt_app_no_execute", (await g("select has_function_privilege('pierre_rt_app','clonestore_record_founder_stripe_event(jsonb)','EXECUTE') as v")) === false);
    ok("grant:pierre_rt_app_no_raw_insert", (await g("select has_table_privilege('pierre_rt_app','clonestore_founder_stripe_events','INSERT') as v")) === false);
    ok("grant:public_no_execute", (await g("select has_function_privilege('public','clonestore_record_founder_stripe_event(jsonb)','EXECUTE') as v")) === false);
    ok("grant:writer_execute", (await g("select has_function_privilege('clonestore_stripe_webhook_writer','clonestore_record_founder_stripe_event(jsonb)','EXECUTE') as v")) === true);
  } catch (e) {
    console.error("[verify] ERREUR :", e.message); bad++;
  } finally { await pool.end(); }
  console.log(bad === 0 ? "[verify] OK — schéma production conforme" : `[verify] ÉCHEC — ${bad} écart(s)`);
  process.exit(bad === 0 ? 0 : 1);
})();
