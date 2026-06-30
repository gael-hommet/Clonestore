#!/usr/bin/env node
// scripts/p87-activate-webhook-ingress.mjs — P8.7.3 activate the EXISTING signature webhook-ingress role as a
// LOGIN least-privilege identity (DSN CLONESTORE_PIERRE_WEBHOOK_DATABASE_URL). Audits the role first (existing,
// login, forbidden attrs, grants), backs up its state, then ALTER ... LOGIN PASSWORD (safe format(%I,%L), no
// superuser attrs), writes the no-verify DSN to .env.p87-runtime.local, verifies current_user=role + not
// privileged. Fail-closed, redacted, NEVER prints a secret. --apply to write; dry-run otherwise.
import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const creds = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/p87-credentials.mjs")).href);
const { redactError } = await import(pathToFileURL(resolve(ROOT, "src/lib/pierre/v1/live-infrastructure-contract.mjs")).href);
const APPLY = process.argv.includes("--apply");
const ADMIN = process.env.P87_ADMIN_DATABASE_URL || null;
const ROLE = "pierre_rt_webhook_ingress";
const VAR = "CLONESTORE_PIERRE_WEBHOOK_DATABASE_URL";
if (!ADMIN) { process.stderr.write("REFUSED — P87_ADMIN_DATABASE_URL required\n"); process.exit(2); }
const log = (m) => process.stderr.write(`[p87-webhook-ingress] ${m}\n`);
async function pg(dsn) {
  const m = await import("pg"); let last;
  for (let i = 1; i <= 5; i++) {
    const pool = new m.default.Pool({ connectionString: dsn, max: 1, application_name: "p87_webhook_ingress", connectionTimeoutMillis: 20000, ssl: { rejectUnauthorized: false } });
    try { const c = await pool.connect(); return { q: (s, p) => c.query(s, p), end: async () => { c.release(); await pool.end(); } }; }
    catch (e) { last = e; await pool.end().catch(() => {}); if (i === 5 || !/ETIMEDOUT|ECONNRESET|terminated|timeout/i.test(e?.message || "")) throw e; await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
  throw last;
}
async function main() {
  const admin = await pg(ADMIN);
  try {
    const row = (await admin.q(`select rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication from pg_roles where rolname=$1`, [ROLE])).rows[0];
    const audit = { role: ROLE, exists: !!row, canlogin_before: row?.rolcanlogin ?? null, super: row?.rolsuper ?? null, bypassrls: row?.rolbypassrls ?? null };
    const grants = (await admin.q(`select count(*)::int n from information_schema.role_routine_grants where grantee=$1`, [ROLE])).rows[0].n;
    audit.routine_grants = grants;
    log(`audit: exists=${audit.exists} canlogin=${audit.canlogin_before} super=${audit.super} bypassrls=${audit.bypassrls} routine_grants=${grants}`);
    if (!audit.exists) { log("ERROR: role absent — refuse to invent grants here; needs explicit least-privilege spec"); process.exit(1); }
    if (audit.super || audit.bypassrls) { log("ERROR: role has forbidden privileged attrs — refuse"); process.exit(1); }
    mkdirSync(join(ROOT, ".p87-proofs", "step3", "final"), { recursive: true });
    writeFileSync(join(ROOT, ".p87-proofs", "step3", "final", "webhook-ingress-audit.json"), JSON.stringify(audit, null, 2));
    if (!APPLY) { log("DRY RUN — would ALTER ROLE LOGIN + write DSN. No writes."); process.exit(0); }
    const pw = creds.generateRolePassword();
    const ddl = (await admin.q(`select format($f$alter role %I login password %L$f$, $1::text, $2::text) as d`, [ROLE, pw])).rows[0].d;
    await admin.q(ddl);
    log(`role ${ROLE}: LOGIN granted (least-privilege; no attrs changed besides login+password)`);
    const dsn = creds.buildRoleDsn(ADMIN, ROLE, pw);
    // atomic upsert into .env.p87-runtime.local
    const file = join(ROOT, ".env.p87-runtime.local");
    const prev = existsSync(file) ? readFileSync(file, "utf-8").split(/\r?\n/).filter((l) => l && !l.startsWith(VAR + "=")) : [];
    prev.push(`${VAR}=${dsn}`);
    writeFileSync(file, prev.join("\n") + "\n", { mode: 0o600 });
    log(`wrote ${VAR} → .env.p87-runtime.local (gitignored)`);
    // verify bind
    const d = await pg(dsn);
    try {
      const cu = (await d.q("select current_user u")).rows[0].u;
      const attr = (await d.q("select rolsuper, rolbypassrls from pg_roles where rolname=current_user")).rows[0];
      const ssl = (await d.q("select coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false) s")).rows[0].s;
      const okBind = cu === ROLE && !attr.rolsuper && !attr.rolbypassrls && ssl;
      log(`verify: current_user=${cu === ROLE ? "OK" : cu} tls=${ssl} privileged=${attr.rolsuper || attr.rolbypassrls}`);
      writeFileSync(join(ROOT, ".p87-proofs", "step3", "final", "webhook-ingress-verify.json"), JSON.stringify({ current_user_matches: cu === ROLE, tls: ssl, not_privileged: !attr.rolsuper && !attr.rolbypassrls, rollback: `alter role ${ROLE} nologin;` }, null, 2));
      process.exit(okBind ? 0 : 1);
    } finally { await d.end(); }
  } catch (e) { process.stderr.write(`[p87-webhook-ingress] ERROR: ${redactError(e)}\n`); process.exit(1); }
  finally { await admin.end(); }
}
main();
