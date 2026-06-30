#!/usr/bin/env node
// scripts/p87-activate-remote.mjs
// PHASE 8.7.2 — operator-run activation of the REAL remote PostgreSQL runtime/billing infrastructure.
//
// DOUBLE-GUARDED + FAIL-CLOSED. It NEVER writes unless the operator both (a) sets the confirmation env vars
// (an admin DSN + an explicit typed target label + an acknowledgement) AND (b) passes --apply. Without
// --apply it is a DRY RUN (plan only, zero writes). It refuses a localhost/ambiguous target. It NEVER
// prints a secret. It:
//   1. records a redacted read-only baseline + schema fingerprint to .p87-proofs/step2/<ts>/
//   2. applies migrations v1→v28 in order (idempotent; fail-fast; NO reset/drop/truncate)
//   3. bootstraps the 7 dedicated roles as LOGIN least-privilege (CSPRNG passwords)
//   4. writes the 7 DSNs + 4 system secrets ATOMICALLY to .env.p87-runtime.local (gitignored) + redacted manifest
//   5. re-verifies each DSN binds current_user = its exact role (no SET ROLE)
//
// The synthetic runtime/billing PROOF is a separate step (scripts/p87-runtime-billing-proof.mjs), then
// verified read-only by `npm run check:p87-runtime-billing-live`.

import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const creds = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/p87-credentials.mjs")).href);
const { redactError, FORBIDDEN_DIRECT_SELECT } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-contract.mjs")).href);

const APPLY = process.argv.includes("--apply");
const ADMIN = process.env.P87_ADMIN_DATABASE_URL || null;
const TARGET = process.env.P87_CONFIRM_TARGET || null;
const ACK = process.env.P87_I_UNDERSTAND_REMOTE_WRITE || null;
const ENVIRONMENT = process.env.P87_ENVIRONMENT || null;

function refuse(reason) { process.stderr.write(`\n[p87-activate] REFUSED — ${reason}\n`); process.exit(2); }

// ── fail-closed guards ────────────────────────────────────────────────────────────────────────
if (!ADMIN) refuse("P87_ADMIN_DATABASE_URL is required (a DEDICATED admin DSN; never silently reuse DATABASE_URL).");
if (!TARGET) refuse("P87_CONFIRM_TARGET is required (type the exact project ref/staging name you intend to write to).");
if (ACK !== "yes") refuse("P87_I_UNDERSTAND_REMOTE_WRITE=yes is required (acknowledge this WRITES to a real remote DB).");
if (!["staging", "production"].includes(ENVIRONMENT)) refuse("P87_ENVIRONMENT must be 'staging' or 'production'.");
let adminHost;
try { adminHost = new URL(ADMIN.replace(/^postgres(ql)?:/, "http:")).hostname.toLowerCase(); } catch { refuse("P87_ADMIN_DATABASE_URL is not a valid postgres DSN."); }
if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(adminHost)) refuse("the target is localhost — P8.7.2 requires a REAL remote target.");

const ts = process.env.P87_TS || `t${createHash("sha1").update(TARGET + ADMIN.length).digest("hex").slice(0, 10)}`;
const proofDir = join(ROOT, ".p87-proofs", "step2", ts);
mkdirSync(proofDir, { recursive: true });
const log = (m) => process.stderr.write(`[p87-activate] ${m}\n`);
const writeProof = (name, obj) => writeFileSync(join(proofDir, name), JSON.stringify(obj, null, 2));

async function pg(dsn) {
  const m = await import("pg");
  // Supabase direct connections are IPv6-only; this host's IPv6 route is intermittent → retry transient
  // connect failures (ETIMEDOUT/ECONNRESET/reset) with backoff. Auth/permission errors are NOT retried.
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const pool = new m.default.Pool({ connectionString: dsn, max: 1, application_name: "p87_activate", connectionTimeoutMillis: 20000, ssl: { rejectUnauthorized: false } });
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

async function main() {
  log(`mode: ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"} · environment: ${ENVIRONMENT} · target(confirmed): ${TARGET}`);

  // 1) read-only baseline
  const c = await pg(ADMIN);
  let baseline;
  try {
    await c.q("begin read only");
    const meta = (await c.q("select current_user u, current_database() d, current_setting('server_version') v")).rows[0];
    const ssl = (await c.q("select coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false) s")).rows[0].s;
    const v28 = (await c.q("select to_regclass('public.pierre_rt_product_entitlements') t")).rows[0].t;
    const roles = (await c.q("select rolname, rolcanlogin from pg_roles where rolname like 'pierre_rt_%' order by rolname")).rows;
    const tables = (await c.q("select count(*)::int n from information_schema.tables where table_schema='public' and table_name like 'pierre_rt_%'")).rows[0].n;
    const fns = (await c.q("select count(*)::int n from pg_proc where proname like 'pierre_rt_%'")).rows[0].n;
    const fp = createHash("sha256").update(`${tables}:${fns}:${roles.map((r) => r.rolname).join(",")}`).digest("hex");
    await c.q("rollback");
    if (!ssl) throw new Error("admin connection is NOT using TLS — refuse");
    baseline = { current_user_class: meta.u === "postgres" ? "admin" : meta.u, database_present: !!meta.d, server_version: String(meta.v).split(".")[0], tls: ssl, v28_present: !!v28, pierre_tables: tables, pierre_functions: fns, pierre_roles: roles.map((r) => ({ name: r.rolname, canlogin: r.rolcanlogin })), schema_fingerprint_before: fp };
    writeProof("baseline.json", baseline);
    log(`baseline recorded (tls=${ssl}, v28=${!!v28}, tables=${tables}, fns=${fns}, roles=${roles.length}) → ${proofDir}`);
  } finally { await c.end(); }

  // migration plan
  const migFiles = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql") && f.includes("pierre_v")).sort();
  log(`migration plan: ${migFiles.length} files (v1→v28).`);

  if (!APPLY) {
    log("DRY RUN complete — no writes performed. Re-run with --apply (and the confirmation env vars) to activate.");
    writeProof("plan.json", { mode: "dry_run", migrations: migFiles.length, roles: creds.ROLE_DSN_VARS.map(([, r]) => r), system_secrets: creds.SYSTEM_SECRET_VARS });
    process.exit(0);
  }

  // 2) apply migrations v1→v28 (idempotent, per-file transaction + ledger, fail-fast, resumable)
  const admin = await pg(ADMIN);
  try {
    // namespaced, additive migration ledger — records every applied file + its sha256 so a re-run is safely
    // resumable (skip already-applied) and an external auditor can diff exactly what this kit changed.
    await admin.q(`create table if not exists public.pierre_rt_schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now(),
      applied_by text not null default current_user
    )`);
    const ledger = [];
    for (const f of migFiles) {
      const sql = readFileSync(join(ROOT, "supabase/migrations", f), "utf-8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const prior = (await admin.q(`select checksum from public.pierre_rt_schema_migrations where filename=$1`, [f])).rows[0];
      if (prior) {
        if (prior.checksum !== checksum) throw new Error(`migration ${f}: checksum drift vs ledger (a different version is already applied) — refuse`);
        log(`skipped ${f} (already in ledger; checksum matches)`); ledger.push({ filename: f, checksum, status: "already_applied" }); continue;
      }
      try {
        await admin.q("begin");
        await admin.q(sql);
        await admin.q(`insert into public.pierre_rt_schema_migrations(filename, checksum) values ($1,$2)`, [f, checksum]);
        await admin.q("commit");
        log(`applied ${f}`); ledger.push({ filename: f, checksum, status: "applied" });
      } catch (e) { await admin.q("rollback").catch(() => {}); throw new Error(`migration ${f} failed: ${redactError(e)}`); }
    }
    writeProof("migration-ledger.json", { count: ledger.length, applied: ledger.filter((l) => l.status === "applied").length, files: ledger });
    const v28 = (await admin.q("select to_regclass('public.pierre_rt_product_entitlements') t")).rows[0].t;
    if (!v28) throw new Error("post-migration: v28 table still absent");

    // 3) bootstrap the 7 dedicated roles as LOGIN least-privilege (CSPRNG)
    const bundle = creds.buildCredentialBundle(ADMIN, { environment: ENVIRONMENT, now: null });
    for (const [varName, role] of creds.ROLE_DSN_VARS) {
      const dsn = bundle.values[varName];
      const pw = decodeURIComponent(new URL(dsn.replace(/^postgres(ql)?:/, "http:")).password);
      // role already exists (created NOLOGIN by migrations with its grants) → grant LOGIN; else create.
      const exists = (await admin.q(`select 1 from pg_roles where rolname = $1`, [role])).rows.length > 0;
      const verb = exists ? "alter role" : "create role";
      // SERVER-SIDE safe quoting via format(%I,%L): identifier + literal are escaped by Postgres, the password
      // is NEVER concatenated into SQL and the resulting DDL is NEVER printed. (No bind params in a DO block.)
      // We grant ONLY login+password: the migrations create these roles NOLOGIN, which already defaults them to
      // NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS. We deliberately do NOT restate those
      // attributes because altering SUPERUSER/REPLICATION/BYPASSRLS requires a real superuser (Supabase's
      // `postgres` admin is NOT one); the least-privilege posture is verified independently by the live check.
      const ddl = (await admin.q(
        `select format($fmt$${verb} %I login password %L$fmt$, $1::text, $2::text) as ddl`,
        [role, pw])).rows[0].ddl;
      await admin.q(ddl);
      log(`role ready (login, least-privilege): ${role}`);
    }

    // 3b) least-privilege hardening: ensure NO dedicated role retains direct SELECT on a forbidden business
    //     table. An earlier migration (v24) granted the planner SELECT on pierre_rt_missions; that table can
    //     carry PII in its instruction and the planner never reads it directly (it only EXECUTEs the governed
    //     SECURITY DEFINER pierre_rt_create_compiled_mission_run, which accesses missions as the definer).
    //     REVOKE is idempotent (a no-op when the grant is absent) and never touches a non-Pierre object.
    for (const [, role] of creds.ROLE_DSN_VARS) {
      for (const t of FORBIDDEN_DIRECT_SELECT) {
        const stmt = (await admin.q(`select format('revoke select on %s from %I', $1::text, $2::text) s`, [t, role])).rows[0].s;
        await admin.q(stmt);
      }
    }
    log(`least-privilege hardening: revoked direct SELECT on ${FORBIDDEN_DIRECT_SELECT.length} forbidden tables from all 7 roles (idempotent)`);

    // 4) write values ATOMICALLY to .env.p87-runtime.local (gitignored, 0600, loaded by the P8.7 scripts).
    //    writeFileSync OVERWRITES the whole managed file → no appended duplicate keys on a re-run.
    const envFile = join(ROOT, ".env.p87-runtime.local");
    const sysBundle = bundle.values; // 7 role DSNs + the 4 system secrets
    const managed = `# P8.7.2 managed runtime/billing credentials — GENERATED, gitignored, do NOT commit.\n`
      + `# environment: ${ENVIRONMENT}\n` + creds.renderEnvFragment(sysBundle) + `\n`;
    writeFileSync(envFile, managed, { mode: 0o600 });
    writeProof("dsn-manifest.json", bundle.manifest);
    log(`wrote ${Object.keys(sysBundle).length} secrets/DSNs → .env.p87-runtime.local (gitignored, 0600); redacted manifest → ${proofDir}`);

    // 5) re-verify each DSN binds current_user = exact role (no SET ROLE)
    const verify = [];
    for (const [varName, role] of creds.ROLE_DSN_VARS) {
      const d = await pg(bundle.values[varName]);
      try { const cu = (await d.q("select current_user u")).rows[0].u; verify.push({ role, current_user_matches: cu === role }); }
      finally { await d.end(); }
    }
    writeProof("role-verify.json", { verify });
    const allBound = verify.every((v) => v.current_user_matches);
    log(`role bind verification: ${allBound ? "ALL OK" : "FAILED"}`);
    if (!allBound) throw new Error("one or more dedicated DSNs did not bind to their exact role");

    log("ACTIVATION (steps 1-5) complete. Next: run scripts/p87-runtime-billing-proof.mjs, then `npm run check:p87-runtime-billing-live`.");
  } finally { await admin.end(); }
}

main().catch((e) => { process.stderr.write(`[p87-activate] ERROR: ${redactError(e)}\n`); process.exit(1); });
