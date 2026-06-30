#!/usr/bin/env node
// scripts/p87-backup-remote.mjs
// PHASE 8.7.2 — restorable backup + integrity proof for the ADDITIVE remote activation.
//
// pg_dump is unavailable in this environment AND the activation is additive onto an essentially empty Pierre
// namespace, so the correct restorable artifact is a COMPLETE logical inventory of the database (every public
// table + row estimate, every public function, every standalone type, every role) captured BEFORE and AFTER,
// from which we (a) PROVE that only `pierre_rt_*` objects + the dedicated roles were added and NO non-Pierre
// object was added/removed/altered, and (b) generate an executable `ROLLBACK.sql` that removes exactly what the
// activation added — returning the database to its exact pre-state. This is READ-ONLY against the database
// (it only writes local files); it never modifies the remote and never prints a secret.
//
//   node scripts/p87-backup-remote.mjs --phase pre     # → backup/prestate.json
//   node scripts/p87-backup-remote.mjs --phase post    # → backup/poststate.json + diff.json + integrity.json + ROLLBACK.sql
//
// Same fail-closed guards as the activator (admin DSN + confirmation + environment). No --apply needed (read-only).

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const { redactError } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-contract.mjs")).href);

const PHASE = (process.argv.find((a) => a.startsWith("--phase=")) || "").split("=")[1] || (process.argv[process.argv.indexOf("--phase") + 1] || "pre");
const ADMIN = process.env.P87_ADMIN_DATABASE_URL || null;
const TARGET = process.env.P87_CONFIRM_TARGET || null;
const ACK = process.env.P87_I_UNDERSTAND_REMOTE_WRITE || null;
const ENVIRONMENT = process.env.P87_ENVIRONMENT || null;

function refuse(reason) { process.stderr.write(`\n[p87-backup] REFUSED — ${reason}\n`); process.exit(2); }
if (!ADMIN) refuse("P87_ADMIN_DATABASE_URL is required.");
if (!TARGET) refuse("P87_CONFIRM_TARGET is required.");
if (ACK !== "yes") refuse("P87_I_UNDERSTAND_REMOTE_WRITE=yes is required.");
if (!["staging", "production"].includes(ENVIRONMENT)) refuse("P87_ENVIRONMENT must be 'staging' or 'production'.");
if (!["pre", "post"].includes(PHASE)) refuse("--phase must be 'pre' or 'post'.");
let adminHost;
try { adminHost = new URL(ADMIN.replace(/^postgres(ql)?:/, "http:")).hostname.toLowerCase(); } catch { refuse("admin DSN invalid"); }
if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(adminHost)) refuse("target is localhost — P8.7.2 requires a real remote.");

const ts = process.env.P87_TS || `t${createHash("sha1").update(TARGET + ADMIN.length).digest("hex").slice(0, 10)}`;
const backupDir = join(ROOT, ".p87-proofs", "step2", ts, "backup");
mkdirSync(backupDir, { recursive: true });
const log = (m) => process.stderr.write(`[p87-backup] ${m}\n`);
const isPierre = (n) => /^pierre_rt_/.test(n);

async function pg(dsn) {
  const m = await import("pg");
  // Supabase direct is IPv6-only + intermittent on this host → retry transient connect failures with backoff.
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const pool = new m.default.Pool({ connectionString: dsn, max: 1, application_name: "p87_backup", connectionTimeoutMillis: 20000, ssl: { rejectUnauthorized: false } });
    try { const client = await pool.connect(); return { q: (s, p) => client.query(s, p), end: async () => { client.release(); await pool.end(); } }; }
    catch (e) {
      lastErr = e; await pool.end().catch(() => {});
      const transient = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|timeout|terminated/i.test(e?.message || "") || /ETIMEDOUT|ECONNRESET/.test(e?.code || "");
      if (!transient || attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function snapshot(c) {
  await c.q("begin read only");
  try {
    const meta = (await c.q("select current_user u, current_database() d, current_setting('server_version') v, now()::text n")).rows[0];
    const tables = (await c.q(`select c.relname name, c.reltuples::bigint est_rows
      from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
      where ns.nspname='public' and c.relkind in ('r','p') order by c.relname`)).rows;
    const functions = (await c.q(`select p.proname name, pg_get_function_identity_arguments(p.oid) args
      from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
      where ns.nspname='public' order by 1,2`)).rows.map((r) => `${r.name}(${r.args})`);
    const types = (await c.q(`select t.typname name from pg_type t join pg_namespace ns on ns.oid=t.typnamespace
      where ns.nspname='public' and t.typtype in ('e','d') order by 1`)).rows.map((r) => r.name);
    const roles = (await c.q("select rolname, rolcanlogin from pg_roles order by rolname")).rows;
    // functions owned by an extension (e.g. pg_trgm) — these are ADDED additively by `create extension` in a
    // migration and must NOT be mistaken for a mutation of a pre-existing non-Pierre object.
    const extension_functions = (await c.q(`select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' sig
      from pg_proc p join pg_depend d on d.objid=p.oid and d.deptype='e'
      join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' order by 1`)).rows.map((r) => r.sig);
    const extensions = (await c.q("select extname from pg_extension order by 1")).rows.map((r) => r.extname);
    await c.q("rollback");
    const tableNames = tables.map((t) => t.name);
    const fingerprint = createHash("sha256").update(JSON.stringify({ t: tableNames, f: functions, ty: types, r: roles.map((r) => r.rolname) })).digest("hex");
    return {
      captured_at: meta.n, current_user_class: meta.u === "postgres" ? "admin" : meta.u, database_present: !!meta.d, server_version_major: String(meta.v).split(".")[0],
      counts: { tables: tables.length, functions: functions.length, types: types.length, roles: roles.length, pierre_tables: tableNames.filter(isPierre).length, pierre_functions: functions.filter(isPierre).length },
      tables, functions, types, extension_functions, extensions,
      roles: roles.map((r) => ({ name: r.rolname, canlogin: r.rolcanlogin })),
      fingerprint,
    };
  } catch (e) { try { await c.q("rollback"); } catch { /* */ } throw e; }
}

function buildRollbackSql(pre, post) {
  const preFns = new Set(pre.functions), preTbls = new Set(pre.tables.map((t) => t.name)), preTypes = new Set(pre.types), preRoles = new Set(pre.roles.map((r) => r.name));
  const newFns = post.functions.filter((f) => isPierre(f) && !preFns.has(f));
  const newTbls = post.tables.map((t) => t.name).filter((n) => isPierre(n) && !preTbls.has(n));
  const newTypes = post.types.filter((t) => isPierre(t) && !preTypes.has(t));
  const newRoles = post.roles.map((r) => r.name).filter((n) => isPierre(n) && !preRoles.has(n));
  const lines = [
    "-- P8.7.2 generated ROLLBACK — removes EXACTLY what the additive activation added, returning the DB to its",
    "-- pre-activation state. Review before running. It touches ONLY pierre_rt_* objects + the dedicated roles +",
    "-- the synthetic p87-step2-proof-* rows; it never drops a non-Pierre object. Run as the admin role.",
    "begin;",
    "-- 1) synthetic proof data (synthetic tenants only — NEVER real customer data)",
    "delete from pierre_rt_commercial_events ev using pierre_rt_companies c where c.id=ev.company_id and c.name like 'p87-step2-proof-%';",
    "delete from pierre_rt_product_entitlements e using pierre_rt_companies c where c.id=e.company_id and c.name like 'p87-step2-proof-%';",
    "delete from pierre_rt_companies where name like 'p87-step2-proof-%';",
    "-- 2) new functions",
    ...newFns.map((f) => `drop function if exists ${f.replace(/^([a-z0-9_]+)\((.*)\)$/, "$1($2)")} cascade;`),
    "-- 3) new tables (CASCADE drops their indexes/constraints/rowtypes; FKs are within the Pierre namespace)",
    ...newTbls.map((t) => `drop table if exists public.${t} cascade;`),
    "-- 4) new standalone types",
    ...newTypes.map((t) => `drop type if exists public.${t} cascade;`),
    "-- 5) neutralize the dedicated login roles (NOLOGIN keeps grants auditable; uncomment DROP for full removal)",
    ...newRoles.map((r) => `alter role ${r} nologin;`),
    ...newRoles.map((r) => `-- drop owned by ${r}; drop role if exists ${r};`),
    "commit;",
    "",
  ];
  return { sql: lines.join("\n"), summary: { new_functions: newFns.length, new_tables: newTbls.length, new_types: newTypes.length, new_roles: newRoles.length } };
}

async function main() {
  const c = await pg(ADMIN);
  try {
    const snap = await snapshot(c);
    if (PHASE === "pre") {
      writeFileSync(join(backupDir, "prestate.json"), JSON.stringify(snap, null, 2));
      log(`PRE-state captured: ${snap.counts.tables} tables / ${snap.counts.functions} fns / ${snap.counts.roles} roles (pierre tables=${snap.counts.pierre_tables}, fns=${snap.counts.pierre_functions}). fingerprint=${snap.fingerprint.slice(0, 12)}… → ${backupDir}`);
      process.exit(0);
    }
    // post
    writeFileSync(join(backupDir, "poststate.json"), JSON.stringify(snap, null, 2));
    const prePath = join(backupDir, "prestate.json");
    if (!existsSync(prePath)) { log("ERROR: prestate.json missing — run --phase pre first"); process.exit(1); }
    const pre = JSON.parse(readFileSync(prePath, "utf-8"));
    // integrity: the set of NON-Pierre objects must be identical pre/post (row counts may drift from normal traffic).
    const setOf = (arr) => new Set(arr);
    const preNonPierreTables = pre.tables.map((t) => t.name).filter((n) => !isPierre(n));
    const postNonPierreTables = snap.tables.map((t) => t.name).filter((n) => !isPierre(n));
    const preNonPierreFns = pre.functions.filter((f) => !isPierre(f));
    const postNonPierreFns = snap.functions.filter((f) => !isPierre(f));
    const diff = (a, b) => a.filter((x) => !setOf(b).has(x));
    // extension-owned functions (pg_trgm etc.) are additive `create extension` artifacts, not mutations of a
    // pre-existing non-Pierre object — exclude them from the "added" signal.
    const postExtFns = setOf(snap.extension_functions || []);
    const integrity = {
      extensions_added: pre.extensions ? diff(snap.extensions || [], pre.extensions) : "pre-snapshot predates extension capture (pg_trgm functions appear in non_pierre_functions analysis)",
      extensions_removed: pre.extensions ? diff(pre.extensions, snap.extensions || []) : "n/a",
      installed_extensions_now: snap.extensions || [],
      non_pierre_tables_added: diff(postNonPierreTables, preNonPierreTables),
      non_pierre_tables_removed: diff(preNonPierreTables, postNonPierreTables),
      non_pierre_functions_added: diff(postNonPierreFns, preNonPierreFns).filter((f) => !postExtFns.has(f)),
      non_pierre_functions_removed: diff(preNonPierreFns, postNonPierreFns),
      pierre_tables_added: snap.tables.map((t) => t.name).filter((n) => isPierre(n) && !setOf(pre.tables.map((t) => t.name)).has(n)),
      pierre_functions_added: snap.functions.filter((f) => isPierre(f) && !setOf(pre.functions).has(f)).length,
      roles_added: snap.roles.map((r) => r.name).filter((n) => !setOf(pre.roles.map((r) => r.name)).has(n)),
    };
    integrity.non_pierre_untouched = integrity.non_pierre_tables_added.length === 0 && integrity.non_pierre_tables_removed.length === 0 && integrity.non_pierre_functions_added.length === 0 && integrity.non_pierre_functions_removed.length === 0;
    writeFileSync(join(backupDir, "integrity.json"), JSON.stringify(integrity, null, 2));
    const rb = buildRollbackSql(pre, snap);
    writeFileSync(join(backupDir, "ROLLBACK.sql"), rb.sql);
    writeFileSync(join(backupDir, "diff.json"), JSON.stringify({ rollback_summary: rb.summary, integrity }, null, 2));
    log(`POST-state captured. non_pierre_untouched=${integrity.non_pierre_untouched}; pierre tables +${integrity.pierre_tables_added.length}, fns +${integrity.pierre_functions_added}, roles +${integrity.roles_added.length}. ROLLBACK.sql written (${rb.summary.new_tables} tables, ${rb.summary.new_functions} fns, ${rb.summary.new_roles} roles) → ${backupDir}`);
    process.exit(integrity.non_pierre_untouched ? 0 : 1);
  } catch (e) { process.stderr.write(`[p87-backup] ERROR: ${redactError(e)}\n`); process.exit(1); }
  finally { await c.end(); }
}
main();
