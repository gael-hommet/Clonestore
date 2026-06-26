#!/usr/bin/env node
// CloneStory — SNAPSHOT logique PRÉ-MIGRATION (LECTURE SEULE, filet de sécurité).
// Capture schéma + compteurs + RLS + index + triggers + données smoke MASQUÉES des tables
// clonestory_fp_*. AUCUN secret, AUCUN token brut, AUCUN email complet, AUCUNE donnée bancaire.
//
// Usage : node --env-file=.env.local scripts/clonestory-pre-migration-snapshot.mjs --pg
// Écrit : artifacts/clonestory-production-pre-migration-<timestamp>.json

import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const usePg = process.argv.includes("--pg");

function maskEmail(e) {
  if (!e || typeof e !== "string" || !e.includes("@")) return null;
  const [l, d] = e.split("@");
  return `${l.slice(0, 2)}***@${d}`;
}
function maskId(id) { return id ? String(id).slice(0, 8) + "…" : null; }

async function getClient() {
  if (usePg) {
    const url = process.env.DATABASE_URL;
    if (!url) { console.error("[snapshot] DATABASE_URL requis avec --pg"); process.exit(1); }
    const { default: pg } = await import(["p", "g"].join(""));
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    const pool = new pg.Pool({ connectionString: url, ssl: isLocal ? undefined : { rejectUnauthorized: false } });
    return { query: (t, p) => pool.query(t, p), close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create(process.env.PGLITE_DATA ?? ".pglite-data");
  return { query: (t, p) => db.query(t, p), close: () => db.close() };
}

async function main() {
  const c = await getClient();
  const rows = async (sql, p) => { try { return (await c.query(sql, p)).rows; } catch { return []; } };
  const stamp = new Date().toISOString();

  // Tables clonestory_fp_*.
  const tables = (await rows(`select table_name from information_schema.tables where table_name like 'clonestory_fp_%' order by table_name`)).map((r) => r.table_name);

  const schema = {};
  for (const t of tables) {
    schema[t] = {
      count: Number((await rows(`select count(*)::int n from ${t}`))[0]?.n ?? -1),
      columns: (await rows(`select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position`, [t])).map((r) => `${r.column_name}:${r.data_type}`),
      rls: (await rows(`select relrowsecurity r, relforcerowsecurity f from pg_class where relname=$1`, [t]))[0] ?? null,
      policies: (await rows(`select polname from pg_policy join pg_class on pg_class.oid = pg_policy.polrelid where relname=$1`, [t])).map((r) => r.polname),
      indexes: (await rows(`select indexname from pg_indexes where tablename=$1`, [t])).map((r) => r.indexname),
      triggers: (await rows(`select tgname from pg_trigger join pg_class on pg_class.oid = pg_trigger.tgrelid where relname=$1 and not tgisinternal`, [t])).map((r) => r.tgname),
    };
  }

  // Données smoke MASQUÉES.
  const partners = (await rows(`select id, status, display_name, registry_number, personal_code, email, email_verified_at from clonestory_fp_partners order by joined_at asc`)).map((p) => ({
    id: maskId(p.id), status: p.status, display_name: p.display_name, registry_number: p.registry_number,
    has_code: !!p.personal_code, email_masked: maskEmail(p.email), email_verified: !!p.email_verified_at,
  }));
  const introductions = (await rows(`select id, partner_id, status, prospect_company, prospect_email, dispute_flag from clonestory_fp_introductions order by created_at asc`)).map((i) => ({
    id: maskId(i.id), partner_id: maskId(i.partner_id), status: i.status, prospect_company: i.prospect_company,
    has_prospect_email: !!i.prospect_email, dispute_flag: i.dispute_flag,
  }));
  const eventTypes = (await rows(`select type, count(*)::int n from clonestory_fp_contribution_events group by type order by type`)).map((e) => `${e.type}:${e.n}`);

  const snapshot = {
    stamp, kind: "clonestory-pre-migration", source: usePg ? "production(--pg)" : "pglite-local",
    tables, schema, smoke: { partners, introductions, contribution_event_types: eventTypes },
    note: "Filet de sécurité lecture seule. Aucun secret/token/email complet/donnée bancaire. Migrations additives & idempotentes (rollback = drop des nouvelles tables).",
  };

  mkdirSync(resolve(process.cwd(), "artifacts"), { recursive: true });
  const out = resolve(process.cwd(), `artifacts/clonestory-production-pre-migration-${stamp.replace(/[:.]/g, "-")}.json`);
  writeFileSync(out, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`[snapshot] écrit: ${out}`);
  console.log(`[snapshot] tables=${tables.length} partenaires=${partners.length} introductions=${introductions.length}`);
  console.log(`[snapshot] events: ${eventTypes.join(", ") || "(aucun)"}`);
  await c.close();
}
main().catch((e) => { console.error("[snapshot] échec:", e.message); process.exit(1); });
