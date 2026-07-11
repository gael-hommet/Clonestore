#!/usr/bin/env node
// Cabinets Fondateurs — VÉRIFICATION POST-MIGRATION.
// Usage : DATABASE_URL=postgres://... node scripts/partner-program-postcheck.mjs
//
// Vérifie la structure (tables, colonnes, index, triggers, RLS, policies) EN LECTURE SEULE,
// puis exécute des contrôles COMPORTEMENTAUX dans une TRANSACTION ANNULÉE (rollback → aucune
// donnée persistée) : isolation RLS partenaire, immutabilité du ledger, interdiction des
// DELETE financiers. Sortie non-zéro si un seul contrôle échoue. Aucun secret affiché.

const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
if (!url) { console.error("[pp-postcheck] DATABASE_URL requise (fail-closed)."); process.exit(2); }
function redact(u) { try { const x = new URL(u); return `${x.protocol}//${x.hostname}:${x.port || "5432"}${x.pathname}`; } catch { return "(url illisible)"; } }
function sslFor(u) { if (process.env.PGSSL === "disable") return false; try { const h = new URL(u).hostname; if (h === "localhost" || h === "127.0.0.1" || h === "::1") return false; } catch {} return { rejectUnauthorized: false }; }

const EXPECTED_TABLES = [
  "clonestore_pp_settings", "clonestore_pp_applications", "clonestore_pp_partners",
  "clonestore_pp_partner_codes", "clonestore_pp_referral_touches", "clonestore_pp_introductions",
  "clonestore_pp_attributions", "clonestore_pp_attribution_events", "clonestore_pp_customers",
  "clonestore_pp_risk_flags", "clonestore_pp_stripe_events", "clonestore_pp_payout_runs",
  "clonestore_pp_transfers", "clonestore_pp_commission_entries", "clonestore_pp_commission_events",
  "clonestore_pp_transfer_items", "clonestore_pp_approval_requests", "clonestore_pp_admin_audit",
  "clonestore_pp_email_outbox", "clonestore_orders_stripe_events",
];

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("  ✓ " + n); };
const ko = (n, d) => { fail++; console.error("  ✗ " + n + (d ? " — " + d : "")); };

(async () => {
  const { default: pg } = await import(["p", "g"].join(""));
  const pool = new pg.Pool({ connectionString: url, ssl: sslFor(url), options: "-c client_encoding=UTF8" });
  try {
    console.log(`[pp-postcheck] cible : ${redact(url)}\n[pp-postcheck] STRUCTURE :`);

    // Tables
    const t = await pool.query(`select table_name from information_schema.tables where table_schema='public' and table_name = any($1)`, [EXPECTED_TABLES]);
    const present = new Set(t.rows.map((r) => r.table_name));
    for (const tbl of EXPECTED_TABLES) present.has(tbl) ? ok(`table ${tbl}`) : ko(`table ${tbl} MANQUANTE`);

    // Colonnes financières en unités mineures (bigint) + taux bps
    const money = await pool.query(`select data_type from information_schema.columns where table_name='clonestore_pp_commission_entries' and column_name='commission_minor'`);
    money.rows[0]?.data_type === "bigint" ? ok("commission_minor est bigint (centimes)") : ko("commission_minor n'est pas bigint");
    const bps = await pool.query(`select data_type from information_schema.columns where table_name='clonestore_pp_partners' and column_name='commission_rate_bps'`);
    bps.rows[0]?.data_type === "integer" ? ok("commission_rate_bps est integer (bps)") : ko("commission_rate_bps absent/incorrect");

    // Index critiques (unicité)
    const idx = await pool.query(`select indexname from pg_indexes where schemaname='public' and indexname = any($1)`, [[
      "uq_pp_entry_event", "uq_pp_entry_invoice_commission", "uq_pp_transfer_partner_period",
      "uq_pp_item_entry_live", "uq_pp_attr_active_subject", "uq_pp_partner_slug",
    ]]);
    const idxSet = new Set(idx.rows.map((r) => r.indexname));
    for (const i of ["uq_pp_entry_event", "uq_pp_entry_invoice_commission", "uq_pp_transfer_partner_period", "uq_pp_item_entry_live", "uq_pp_attr_active_subject", "uq_pp_partner_slug"])
      idxSet.has(i) ? ok(`index unique ${i}`) : ko(`index ${i} MANQUANT`);

    // Triggers append-only / immutabilité
    const trg = await pool.query(`select tgname from pg_trigger where tgname = any($1)`, [[
      "trg_pp_entries_guard", "trg_clonestore_pp_commission_events_append_only", "trg_clonestore_pp_admin_audit_append_only",
    ]]);
    const trgSet = new Set(trg.rows.map((r) => r.tgname));
    trgSet.has("trg_pp_entries_guard") ? ok("trigger immutabilité ledger (trg_pp_entries_guard)") : ko("trigger immutabilité ledger MANQUANT");
    trgSet.has("trg_clonestore_pp_commission_events_append_only") ? ok("trigger append-only commission_events") : ko("trigger append-only commission_events MANQUANT");

    // RLS activée + forcée sur les tables sensibles
    const rls = await pool.query(`select relname, relrowsecurity, relforcerowsecurity from pg_class where relname = any($1)`, [[
      "clonestore_pp_partners", "clonestore_pp_commission_entries", "clonestore_pp_email_outbox", "clonestore_orders_stripe_events",
    ]]);
    for (const r of rls.rows) {
      if (r.relname === "clonestore_orders_stripe_events") { r.relrowsecurity ? ok(`RLS activée sur ${r.relname}`) : ko(`RLS non activée sur ${r.relname}`); continue; }
      (r.relrowsecurity && r.relforcerowsecurity) ? ok(`RLS forcée sur ${r.relname}`) : ko(`RLS non forcée sur ${r.relname}`);
    }

    // Policies présentes
    const pol = await pool.query(`select count(*)::int n from pg_policies where schemaname='public' and tablename like 'clonestore_pp_%'`);
    pol.rows[0].n >= 15 ? ok(`policies RLS présentes (${pol.rows[0].n})`) : ko(`policies RLS insuffisantes (${pol.rows[0].n})`);

    // ── Contrôles COMPORTEMENTAUX (transaction ANNULÉE) ─────────────────────────
    console.log("\n[pp-postcheck] COMPORTEMENT (transaction annulée — aucune donnée persistée) :");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role pierre_rt_app");
      await client.query("select set_config('app.pp_service','on',true)");
      // Seed minimal
      const p = await client.query(`insert into clonestore_pp_partners (email,email_normalized,display_name,country,public_slug) values ('pc@x.fr','pc@x.fr','Postcheck','FR','postcheck-slug') returning id`);
      const pid = p.rows[0].id;
      await client.query(`insert into clonestore_pp_commission_entries (partner_id,stripe_invoice_id,stripe_event_id,currency,eligible_net_minor,rate_bps,commission_minor,entry_type,status,available_at) values ($1,'in_pc','evt_pc','eur',44900,2000,8980,'commission','pending',now())`, [pid]);

      // Immutabilité : muter un montant doit échouer. SAVEPOINT → on reprend après l'erreur
      // attendue (sinon la transaction reste abortée et bloque les contrôles suivants).
      await client.query("savepoint sp_immut");
      try { await client.query(`update clonestore_pp_commission_entries set commission_minor=1 where partner_id=$1`, [pid]); ko("immutabilité ledger : la mutation d'un montant a été ACCEPTÉE (anomalie)"); await client.query("release savepoint sp_immut"); }
      catch { ok("immutabilité ledger : mutation d'un montant REFUSÉE"); await client.query("rollback to savepoint sp_immut"); }

      // DELETE financier interdit
      await client.query(`insert into clonestore_pp_commission_events (partner_id,type) values ($1,'commission_recorded')`, [pid]);
      await client.query("savepoint sp_del");
      try { await client.query(`delete from clonestore_pp_commission_events where partner_id=$1`, [pid]); ko("DELETE financier : suppression d'un événement ACCEPTÉE (anomalie)"); await client.query("release savepoint sp_del"); }
      catch { ok("DELETE financier : suppression d'un événement REFUSÉE"); await client.query("rollback to savepoint sp_del"); }

      // Isolation RLS : en mode PARTNER d'un AUTRE id, le partenaire n'est pas visible
      await client.query("select set_config('app.pp_service','',true)");
      await client.query("select set_config('app.pp_partner','00000000-0000-4000-8000-000000000000',true)");
      const seen = await client.query(`select 1 from clonestore_pp_partners where id=$1`, [pid]);
      seen.rowCount === 0 ? ok("isolation RLS : un autre cabinet ne voit pas ces lignes") : ko("isolation RLS : fuite cross-partenaire (anomalie)");

      await client.query("rollback");
    } finally { client.release(); }

    console.log(`\n[pp-postcheck] RÉSULTAT : ${pass} OK / ${fail} KO`);
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error("[pp-postcheck] erreur : " + e.message);
    process.exit(1);
  } finally { await pool.end(); }
})();
