// scripts/p941-durable-proof.mjs
// P9.4.1 — Preuve de DURABILITÉ réelle du schéma CloneChat contre un VRAI Postgres 16
// persistant (embedded-postgres — no Docker, no Supabase, no prod). Prouve :
//   1) migration additive applique proprement ;
//   2) RLS : isolation tenant réelle (company A invisible pour company B) — sous
//      `set role clonechat_app` (un superuser bypasserait la RLS) ;
//   3) budget ATOMIQUE : sous concurrence, deux "instances" (connexions indépendantes)
//      ne dépassent jamais ensemble le plafond ;
//   4) PERSISTANCE : après un vrai restart du serveur PG, les données survivent.
// Écrit .p941-proofs/<run>/{durable-schema,tenant-isolation,budget-concurrency,restart-proof}.json
// Nettoie le data dir à la fin (ZERO RESIDUE). Usage: node scripts/p941-durable-proof.mjs

import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";

const ROOT = process.cwd();
const PORT = Number(process.env.P941_PG_PORT ?? 55432);
const HOST = "127.0.0.1";
const DATADIR = resolve(ROOT, ".p941-proofs/pgdata");
const OUT = resolve(ROOT, ".p941-proofs/p941-run1");
const MIG = resolve(ROOT, "supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql");
mkdirSync(OUT, { recursive: true });

const EmbeddedPostgres = (await import(pathToFileURL(resolve(ROOT, "node_modules/embedded-postgres/dist/index.js")).href)).default;
const pgLib = (await import(pathToFileURL(resolve(ROOT, "node_modules/pg/lib/index.js")).href)).default;

const write = (name, obj) => writeFileSync(resolve(OUT, name), JSON.stringify(obj, null, 2));
const uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });

// Tenant-scoped query helper (assumes clonechat_app + sets GUC), mirrors src pg client.
async function asTenant(pool, companyId, userId, internal, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role clonechat_app");
    await c.query("select set_config('app.current_company', $1, true)", [companyId]);
    await c.query("select set_config('app.current_user_id', $1, true)", [userId ?? ""]);
    await c.query("select set_config('app.clonechat_internal', $1, true)", [internal ? "true" : "false"]);
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
}

let epg, pool;
const green = { schema: false, isolation: false, budget: false, restart: false };
try {
  if (existsSync(DATADIR)) rmSync(DATADIR, { recursive: true, force: true });
  epg = new EmbeddedPostgres({ databaseDir: DATADIR, user: "postgres", password: "postgres", port: PORT, persistent: true });
  await epg.initialise();
  await epg.start();

  // create UTF8 db (Windows initdb defaults to WIN1252)
  { const boot = new pgLib.Pool({ host: HOST, port: PORT, user: "postgres", password: "postgres", database: "postgres", max: 1 });
    try { await boot.query("drop database if exists ccdb"); await boot.query("create database ccdb with encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'"); } finally { await boot.end(); } }
  pool = new pgLib.Pool({ host: HOST, port: PORT, user: "postgres", password: "postgres", database: "ccdb", max: 12 });

  // 1) apply migration
  await pool.query(readFileSync(MIG, "utf-8"));
  const tbls = (await pool.query("select table_name from information_schema.tables where table_name like 'clonechat_%' order by 1")).rows.map((r) => r.table_name);
  green.schema = ["clonechat_conversations","clonechat_messages","clonechat_bug_cases","clonechat_bug_occurrences","clonechat_budget_counters","clonechat_support_cases","clonechat_usage_events"].every((t) => tbls.includes(t));
  write("durable-schema.json", { pg_version: (await pool.query("select version()")).rows[0].version.slice(0, 40), tables: tbls, applied: true, ok: green.schema });

  // 2) tenant isolation (RLS under clonechat_app)
  const companyA = uuid(), companyB = uuid(), userA = uuid();
  const convId = await asTenant(pool, companyA, userA, false, async (c) => {
    const r = await c.query("insert into clonechat_conversations (company_id, user_id, title) values ($1,$2,$3) returning id", [companyA, userA, "A-thread"]);
    await c.query("insert into clonechat_messages (conversation_id, company_id, user_id, seq, role, content) values ($1,$2,$3,1,'user','[{\"type\":\"text\",\"text\":\"secret A\"}]'::jsonb)", [r.rows[0].id, companyA, userA]);
    return r.rows[0].id;
  });
  const aSees = await asTenant(pool, companyA, userA, false, async (c) => (await c.query("select count(*)::int n from clonechat_conversations")).rows[0].n);
  const bSees = await asTenant(pool, companyB, uuid(), false, async (c) => (await c.query("select count(*)::int n from clonechat_conversations")).rows[0].n);
  const bSeesMsgs = await asTenant(pool, companyB, uuid(), false, async (c) => (await c.query("select count(*)::int n from clonechat_messages")).rows[0].n);
  green.isolation = aSees === 1 && bSees === 0 && bSeesMsgs === 0;
  write("tenant-isolation.json", { companyA_sees: aSees, companyB_sees_conversations: bSees, companyB_sees_messages: bSeesMsgs, ok: green.isolation, note: "RLS enforced under set role clonechat_app; superuser bypass avoided" });

  // 3) atomic budget under concurrency: global cap 1000, 20 concurrent reserves of 300
  const day = "2026-07-03";
  const gScope = `global:day:${day}`;
  const CAP = 1000, RESERVE = 300, N = 20;
  const attempts = await Promise.all(Array.from({ length: N }, () => (async () => {
    const c = await pool.connect();
    try {
      await c.query("begin"); await c.query("set local role clonechat_app");
      const r = await c.query("select clonechat_budget_try_reserve($1::text[],$2::text[],$3::bigint[],$4::bigint) ok",
        [[gScope], ["global_day"], [CAP], RESERVE]);
      await c.query("commit");
      return r.rows[0].ok === true;
    } catch { await c.query("rollback").catch(() => {}); return false; } finally { c.release(); }
  })()));
  const granted = attempts.filter(Boolean).length;
  const counters = (await pool.query("select committed_tokens, reserved_tokens from clonechat_budget_counters where scope_key=$1", [gScope])).rows[0];
  const totalReserved = Number(counters.reserved_tokens);
  green.budget = granted * RESERVE <= CAP && totalReserved <= CAP && granted === Math.floor(CAP / RESERVE);
  write("budget-concurrency.json", { cap: CAP, reservePer: RESERVE, concurrent: N, granted, expectedGranted: Math.floor(CAP / RESERVE), totalReserved, ok: green.budget, note: "atomic FOR UPDATE reserve — concurrent independent connections cannot jointly exceed cap" });

  // 4) restart persistence: stop + start the SAME persistent data dir, re-query
  await pool.end();
  await epg.stop();
  await epg.start();
  pool = new pgLib.Pool({ host: HOST, port: PORT, user: "postgres", password: "postgres", database: "ccdb", max: 4 });
  const afterRestart = await asTenant(pool, companyA, userA, false, async (c) => ({
    conv: (await c.query("select count(*)::int n from clonechat_conversations")).rows[0].n,
    msg: (await c.query("select count(*)::int n from clonechat_messages where conversation_id=$1", [convId])).rows[0].n,
  }));
  const budgetAfter = (await pool.query("select reserved_tokens from clonechat_budget_counters where scope_key=$1", [gScope])).rows[0];
  green.restart = afterRestart.conv === 1 && afterRestart.msg === 1 && Number(budgetAfter.reserved_tokens) === totalReserved;
  write("restart-proof.json", { beforeRestart: { conversations: aSees, reserved: totalReserved }, afterRestart: { conversations: afterRestart.conv, messages: afterRestart.msg, reserved: Number(budgetAfter.reserved_tokens) }, ok: green.restart, note: "real PG server stop+start on persistent data dir; durable data survived" });

  const allOk = Object.values(green).every(Boolean);
  console.log(JSON.stringify({ green, allOk }, null, 2));
  console.log(allOk ? "P941 DURABLE PROOF — VERIFIED" : "P941 DURABLE PROOF — FAILED");
  if (!allOk) process.exitCode = 3;
} catch (e) {
  console.error("DURABLE PROOF ERROR:", e && e.message ? e.message : e);
  process.exitCode = 2;
} finally {
  try { if (pool) await pool.end(); } catch {}
  try { if (epg) await epg.stop(); } catch {}
  try { if (existsSync(DATADIR)) rmSync(DATADIR, { recursive: true, force: true }); } catch {}
  console.log("P941 DURABLE PROOF CLEANUP — data dir removed");
}
