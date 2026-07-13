#!/usr/bin/env node
// scripts/c1-4-local-budget-db.mjs
// C1.4 §9/§10 — Provisionne une base Postgres LOCALE JETABLE (embedded-postgres) et y applique
// la migration CANONIQUE P9.4.1 (qui CRÉE le rôle `clonechat_app` de façon idempotente).
// Puis PROUVE : rôle présent · moindre privilège · pas de BYPASSRLS · RLS active ·
// réservation de budget durable réelle (atomique) · aucun accès aux tables hors CloneChat.
//
// NE TOUCHE JAMAIS une base distante/managée : la base est créée ici, sur 127.0.0.1.
// N'imprime aucun secret (le DSN local est un mot de passe jetable `postgres`).
//
//   node scripts/c1-4-local-budget-db.mjs --start   → démarre + migre + prouve, garde le serveur
//   node scripts/c1-4-local-budget-db.mjs --prove   → démarre, prouve, arrête (rapport JSON)

import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.C1_4_PG_PORT ?? 55450);
const DATADIR = resolve(ROOT, ".c1-4-pgdata");
const MIG = resolve(ROOT, "supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql");
export const LOCAL_URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/ccdb`;

const keepAlive = process.argv.includes("--start");

const EmbeddedPostgres = (await import("embedded-postgres")).default;
const { default: pg } = await import("pg");

const report = { host: "127.0.0.1 (embedded, disposable)", database: "ccdb", migration: MIG.replace(ROOT, "."), steps: {} };

if (existsSync(DATADIR)) rmSync(DATADIR, { recursive: true, force: true });
const epg = new EmbeddedPostgres({ databaseDir: DATADIR, user: "postgres", password: "postgres", port: PORT, persistent: true });
await epg.initialise();
await epg.start();

// ── Base jetable + migration canonique (crée clonechat_app) ──────────────────
{
  const boot = new pg.Pool({ host: "127.0.0.1", port: PORT, user: "postgres", password: "postgres", database: "postgres", max: 1 });
  try {
    await boot.query("drop database if exists ccdb");
    await boot.query("create database ccdb with encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'");
  } finally { await boot.end(); }
  const mig = new pg.Pool({ connectionString: LOCAL_URL, max: 1 });
  try {
    await mig.query(readFileSync(MIG, "utf-8"));
    report.steps.migrationApplied = true;
  } finally { await mig.end(); }
}

const pool = new pg.Pool({ connectionString: LOCAL_URL, max: 4 });

// ── PREUVE 1 : le rôle existe et est MOINDRE PRIVILÈGE ──────────────────────
{
  const r = await pool.query(
    `select rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolbypassrls, rolreplication
       from pg_roles where rolname = 'clonechat_app'`,
  );
  const role = r.rows[0] ?? null;
  report.steps.roleExists = !!role;
  report.steps.rolePrivileges = role
    ? {
        superuser: role.rolsuper, createdb: role.rolcreatedb, createrole: role.rolcreaterole,
        canlogin: role.rolcanlogin, bypassrls: role.rolbypassrls, replication: role.rolreplication,
      }
    : null;
  report.steps.roleLeastPrivilege = !!role && !role.rolsuper && !role.rolcreatedb && !role.rolcreaterole && !role.rolbypassrls && !role.rolreplication && !role.rolcanlogin;
  report.steps.roleBypassesRls = !!role && role.rolbypassrls === true;
}

// ── PREUVE 2 : RLS activée sur les tables tenant ────────────────────────────
{
  const r = await pool.query(
    `select relname, relrowsecurity, relforcerowsecurity
       from pg_class where relname like 'clonechat%' and relkind = 'r' order by relname`,
  );
  report.steps.tables = r.rows.map((t) => ({ table: t.relname, rls: t.relrowsecurity, force: t.relforcerowsecurity }));
  report.steps.rlsEnabledOnAll = r.rows.length > 0 && r.rows.every((t) => t.relrowsecurity === true);
}

// ── PREUVE 3 : privilèges accordés UNIQUEMENT sur les tables clonechat_* ────
{
  const r = await pool.query(
    `select table_name, string_agg(distinct privilege_type, ',' order by privilege_type) as privs
       from information_schema.role_table_grants
      where grantee = 'clonechat_app' group by table_name order by table_name`,
  );
  report.steps.grants = r.rows.map((g) => ({ table: g.table_name, privileges: g.privs }));
  report.steps.grantsOnlyOnClonechatTables = r.rows.length > 0 && r.rows.every((g) => g.table_name.startsWith("clonechat"));
  // Aucune table étrangère (Pierre/customers/secrets) accessible.
  const foreign = r.rows.filter((g) => !g.table_name.startsWith("clonechat"));
  report.steps.foreignTablesGranted = foreign.map((g) => g.table_name);
}

// ── PREUVE 4 : RÉSERVATION DE BUDGET DURABLE RÉELLE (le défaut C1.3) ────────
{
  const { buildClonechatDurable } = await import(new URL("../src/lib/clonechat/durable/index.ts", import.meta.url).href).catch(() => ({}));
  // Import TS impossible en node brut : on prouve la fonction SQL directement, sous le rôle applicatif.
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role clonechat_app");
    const who = await c.query("select current_user as u");
    report.steps.assumedRole = who.rows[0].u;
    const day = new Date().toISOString().slice(0, 10);
    const keys = [`u:c14-user:${day}`, `g:day:${day}`];
    const kinds = ["user_day", "global_day"];
    const caps = [100000, 1000000];
    const res = await c.query("select clonechat_budget_try_reserve($1::text[],$2::text[],$3::bigint[],$4::bigint) as ok", [keys, kinds, caps, 900]);
    report.steps.durableReservationGranted = res.rows[0].ok === true;
    await c.query("select clonechat_budget_commit($1::text[],$2::bigint,$3::bigint)", [keys, 900, 120]);
    const counters = await c.query("select scope_key, committed_tokens, reserved_tokens from clonechat_budget_counters where scope_key = any($1::text[]) order by scope_key", [keys]);
    report.steps.budgetCounters = counters.rows.map((x) => ({ scope: x.scope_key, committed: Number(x.committed_tokens), reserved: Number(x.reserved_tokens) }));
    report.steps.budgetCommitRecorded = counters.rows.every((x) => Number(x.committed_tokens) === 120 && Number(x.reserved_tokens) === 0);
    // Atomicité : une 2e réservation au-delà du plafond doit être REFUSÉE.
    const over = await c.query("select clonechat_budget_try_reserve($1::text[],$2::text[],$3::bigint[],$4::bigint) as ok", [keys, kinds, [100, 100], 5000]);
    report.steps.budgetCapEnforced = over.rows[0].ok === false;
    await c.query("commit");
  } catch (e) {
    try { await c.query("rollback"); } catch {}
    report.steps.durableReservationError = String(e?.message ?? e).slice(0, 200);
  } finally { c.release(); }
}

// ── PREUVE 5 : le rôle NE PEUT PAS lire une table étrangère ────────────────
{
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("create table if not exists c14_foreign_secrets(id int, v text)");
    await c.query("set local role clonechat_app");
    try {
      await c.query("select * from c14_foreign_secrets");
      report.steps.foreignTableReadBlocked = false;
    } catch {
      report.steps.foreignTableReadBlocked = true; // permission denied attendu
    }
    await c.query("rollback");
  } finally { c.release(); }
}

await pool.end();

const dir = resolve(ROOT, ".c1-4-proofs", "access-openai-runtime");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "database-role-privileges.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (keepAlive) {
  writeFileSync(resolve(ROOT, ".c1-4-local-db-url"), LOCAL_URL);
  console.log("\n[c1.4] base locale prête et MAINTENUE. DSN écrit dans .c1-4-local-db-url");
  await new Promise(() => {}); // garde le serveur vivant
} else {
  await epg.stop();
}
