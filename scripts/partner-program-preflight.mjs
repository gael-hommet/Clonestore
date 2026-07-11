#!/usr/bin/env node
// Cabinets Fondateurs — PRÉFLIGHT en LECTURE SEULE avant migration.
// Usage : DATABASE_URL=postgres://... node scripts/partner-program-preflight.mjs
//
// N'écrit RIEN. Vérifie que la base est compatible avant d'appliquer les migrations :
//   • gen_random_uuid() disponible (uuid) ;
//   • aucune table cible existante avec une forme INCOMPATIBLE (colonnes clés manquantes) ;
//   • rôle pierre_rt_app (créé par la migration si absent — informational) ;
//   • signale les tables déjà présentes (ré-application idempotente sûre).
// Aucun secret affiché. Sortie non-zéro si un blocage réel est détecté.

const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
if (!url) { console.error("[pp-preflight] DATABASE_URL requise (fail-closed)."); process.exit(2); }
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
// Colonne clé attendue par table déjà existante → si la table existe sans elle = INCOMPATIBLE.
const KEY_COLUMN = {
  clonestore_pp_commission_entries: "commission_minor",
  clonestore_pp_partners: "commission_rate_bps",
  clonestore_orders_stripe_events: "payload_fingerprint",
};

(async () => {
  const { default: pg } = await import(["p", "g"].join(""));
  const pool = new pg.Pool({ connectionString: url, ssl: sslFor(url), options: "-c client_encoding=UTF8" });
  const problems = [];
  const notes = [];
  try {
    console.log(`[pp-preflight] cible : ${redact(url)}`);

    // 1) uuid
    try { await pool.query("select gen_random_uuid()"); notes.push("gen_random_uuid() OK"); }
    catch { problems.push("gen_random_uuid() indisponible (activer l'extension pgcrypto)."); }

    // 2) tables déjà présentes + compat
    const { rows } = await pool.query(
      `select table_name from information_schema.tables where table_schema='public' and table_name = any($1)`,
      [EXPECTED_TABLES],
    );
    const present = new Set(rows.map((r) => r.table_name));
    notes.push(`tables cibles déjà présentes : ${present.size}/${EXPECTED_TABLES.length} (ré-application idempotente sûre)`);
    for (const [t, col] of Object.entries(KEY_COLUMN)) {
      if (present.has(t)) {
        const c = await pool.query(`select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2`, [t, col]);
        if (c.rowCount === 0) problems.push(`Table ${t} existe SANS la colonne clé ${col} → forme incompatible (à investiguer AVANT migration).`);
      }
    }

    // 3) rôle pierre_rt_app (informational — la migration le crée si absent)
    const role = await pool.query(`select 1 from pg_roles where rolname='pierre_rt_app'`);
    notes.push(role.rowCount ? "rôle pierre_rt_app présent" : "rôle pierre_rt_app absent (créé par la migration)");

    console.log("\n[pp-preflight] NOTES :"); notes.forEach((n) => console.log("  • " + n));
    if (problems.length) {
      console.error("\n[pp-preflight] BLOCAGES :"); problems.forEach((p) => console.error("  ✗ " + p));
      console.error("\n[pp-preflight] NO-GO — corriger les blocages avant migration.");
      process.exit(1);
    }
    console.log("\n[pp-preflight] GO — base compatible, migration applicable.");
    process.exit(0);
  } catch (e) {
    console.error("[pp-preflight] erreur : " + e.message);
    process.exit(1);
  } finally { await pool.end(); }
})();
