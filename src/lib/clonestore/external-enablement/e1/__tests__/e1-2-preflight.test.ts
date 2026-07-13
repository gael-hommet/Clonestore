// E1.2 — local tests for the hardened read-only preflight (§12).
//
// These run against the SAME core the runner executes (e1-2-preflight-core.mjs), so a
// query that passes here is literally the query that would be sent. Nothing in this file
// opens a connection; the whole point is to prove the tool cannot mutate, cannot read a
// customer row, and cannot connect without an authorization — BEFORE any socket exists.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  AUTHORIZATION_SENTENCE,
  ALLOWED_ACTION,
  ALLOWED_RELATIONS,
  QUERY_REGISTRY,
  SESSION_SAFETY,
  P941_CANONICAL,
  P941_ALL_TABLES,
  PARTNER_PAYOUT_CANONICAL,
  auditRegistry,
  resolveRegisteredQuery,
  validateSql,
  extractRelations,
  isCustomerRelation,
  verifySessionSafety,
  detectLeaks,
  sanitizeError,
  classifyTarget,
  buildAuthorization,
  validateAuthorization,
  classifyP941,
  classifyPartnerPayout,
  reconcileHistory,
  detectDrift,
} from "../e1-2-preflight-core.mjs";

import { buildE12CommandCenter, E1_2_HARD_VALUES, isDeploymentAuthorized } from "../e1-2-remote-state-command-center";

const RUNNER_SRC = readFileSync(resolve(process.cwd(), "scripts/e1-2-remote-state-preflight.mjs"), "utf8");
const CORE_SRC = readFileSync(resolve(process.cwd(), "src/lib/clonestore/external-enablement/e1/e1-2-preflight-core.mjs"), "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — synthetic CATALOG metadata (never customer rows)
// ─────────────────────────────────────────────────────────────────────────────

function idealP941Evidence() {
  const tables = P941_ALL_TABLES.map((relname) => ({
    relname, nspname: "public", owner: "postgres", relrowsecurity: true, relforcerowsecurity: true,
  }));
  const columns: any[] = [];
  const indexes: any[] = [];
  const constraints: any[] = [];
  for (const spec of P941_CANONICAL.tables) {
    for (const [column_name, data_type] of Object.entries(spec.columns)) {
      columns.push({
        table_name: spec.name, column_name, data_type,
        is_nullable: (spec.notNull ?? []).includes(column_name) ? "NO" : "YES",
        column_default: null, is_identity: "NO", is_generated: "NEVER",
      });
    }
    for (const indexname of spec.indexes ?? []) {
      const unique = (spec.uniqueIndexes ?? []).includes(indexname);
      indexes.push({
        table_name: spec.name, indexname,
        indexdef: `CREATE ${unique ? "UNIQUE " : ""}INDEX ${indexname} ON public.${spec.name} USING btree (company_id)`,
      });
    }
    for (const col of spec.uniqueColumns ?? []) {
      constraints.push({ table_name: spec.name, conname: `${spec.name}_${col}_key`, contype: "u", definition: `UNIQUE (${col})` });
    }
  }
  const policies = P941_CANONICAL.tenantTables.map((t: string) => ({
    table_name: t, policyname: `cc_iso_${t}`, permissive: "PERMISSIVE", roles: "{public}", cmd: "ALL",
    qual: "((company_id)::text = current_setting('app.current_company'::text, true))",
    with_check: "((company_id)::text = current_setting('app.current_company'::text, true))",
  }));
  const functions = P941_CANONICAL.functions.map((f: any) => ({
    proname: f.name, args: f.args, prosecdef: false, provolatile: "v", language: "plpgsql", proconfig: null, owner: "postgres",
  }));
  const tableGrants = P941_ALL_TABLES.flatMap((t) =>
    ["SELECT", "INSERT", "UPDATE", "DELETE"].map((p) => ({ table_schema: "public", table_name: t, privilege_type: p })),
  );
  const routineGrants = P941_CANONICAL.functions.map((f: any) => ({
    routine_schema: "public", routine_name: f.name, privilege_type: "EXECUTE",
  }));
  return {
    connected: true, safetyOk: true, tables, columns, indexes, constraints, policies, functions,
    tableGrants, routineGrants, memberships: [], extensions: [], triggers: [], ppFunctions: [],
    role: {
      rolname: "clonechat_app", rolcanlogin: false, rolsuper: false, rolcreatedb: false,
      rolcreaterole: false, rolreplication: false, rolbypassrls: false, rolinherit: true,
    },
  };
}

function idealPartnerEvidence() {
  const C = PARTNER_PAYOUT_CANONICAL;
  const tables = C.baseTables.map((relname: string) => ({
    relname, nspname: "public", owner: "postgres", relrowsecurity: true, relforcerowsecurity: true,
  }));
  const columns: any[] = [];
  for (const [table, cols] of Object.entries(C.addedColumns)) {
    for (const column_name of cols as string[]) {
      columns.push({ table_name: table, column_name, data_type: "text", is_nullable: "YES", column_default: null });
    }
  }
  columns.push({ table_name: "clonestore_pp_transfers", column_name: "stripe_mode", data_type: "text", is_nullable: "NO", column_default: "'test'::text" });
  columns.push({ table_name: "clonestore_pp_commission_entries", column_name: "stripe_mode", data_type: "text", is_nullable: "NO", column_default: "'test'::text" });
  columns.push({ table_name: "clonestore_pp_payout_runs", column_name: "dry_run", data_type: "boolean", is_nullable: "NO", column_default: "true" });

  // Model each index on its REAL host table (two live on non-base tables the runner must also
  // scan), and give uq_pp_transfer_partner_period the WIDE predicate this migration recreates.
  const INDEX_HOST: Record<string, string> = {
    uq_pp_transfer_partner_period: "clonestore_pp_transfers",
    idx_pp_transfer_needs_attention: "clonestore_pp_transfers",
    idx_pp_entry_available_pool: "clonestore_pp_commission_entries",
    idx_pp_entry_partner_status: "clonestore_pp_commission_entries",
    idx_pp_attr_partner_status: "clonestore_pp_attributions",
    idx_pp_touch_partner: "clonestore_pp_referral_touches",
    idx_pp_partner_status_country: "clonestore_pp_partners",
    uq_pp_item_entry_live: "clonestore_pp_transfer_items",
  };
  const WIDE_PARTIAL =
    "WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text, 'transferred'::text, 'reconciliation_required'::text, 'failed_retryable'::text, 'created'::text, 'paid'::text, 'failed'::text]))";
  const indexes = [...C.addedIndexes, "uq_pp_item_entry_live"].map((indexname: string) => ({
    table_name: INDEX_HOST[indexname] ?? "clonestore_pp_transfers",
    indexname,
    indexdef:
      indexname === "uq_pp_transfer_partner_period"
        ? `CREATE UNIQUE INDEX ${indexname} ON public.clonestore_pp_transfers USING btree (partner_id, period_start, period_end) ${WIDE_PARTIAL}`
        : `CREATE UNIQUE INDEX ${indexname} ON public.${INDEX_HOST[indexname] ?? "clonestore_pp_transfers"} USING btree (entry_id) WHERE (released_at IS NULL)`,
  }));

  const constraints = [
    {
      table_name: "clonestore_pp_transfers", conname: "clonestore_pp_transfers_status_check", contype: "c",
      definition: `CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'transferred'::text, 'failed_retryable'::text, 'failed_permanent'::text, 'reconciliation_required'::text, 'released'::text, 'created'::text, 'paid'::text, 'failed'::text])))`,
    },
    { table_name: "clonestore_pp_transfers", conname: "clonestore_pp_transfers_stripe_mode_check", contype: "c", definition: `CHECK ((stripe_mode = ANY (ARRAY['test'::text, 'live'::text])))` },
    { table_name: "clonestore_pp_commission_entries", conname: "ce_stripe_mode_check", contype: "c", definition: `CHECK ((stripe_mode = ANY (ARRAY['test'::text, 'live'::text])))` },
    { table_name: "clonestore_pp_payout_runs", conname: "clonestore_pp_payout_runs_run_key_key", contype: "u", definition: "UNIQUE (run_key)" },
    { table_name: "clonestore_pp_transfers", conname: "clonestore_pp_transfers_idempotency_key_key", contype: "u", definition: "UNIQUE (idempotency_key)" },
    {
      table_name: "clonestore_pp_email_outbox", conname: "clonestore_pp_email_outbox_kind_check", contype: "c",
      definition: `CHECK ((kind = ANY (ARRAY['connect_ready'::text, 'payout_blocked'::text])))`,
    },
  ];
  return {
    connected: true, safetyOk: true, tables, columns, indexes, constraints, policies: [],
    functions: [], ppFunctions: [], tableGrants: [], routineGrants: [], memberships: [],
    extensions: [{ extname: "pgcrypto" }, { extname: "uuid-ossp" }],
    triggers: [{ table_name: "clonestore_pp_commission_entries", tgname: "clonestore_pp_entries_guard", function_name: "clonestore_pp_entries_guard_fn", tgenabled: "O" }],
    role: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("E1.2 §12.1–4 — connection & authorization gating", () => {
  it("1. no connection can occur without --connect: `pg` is imported only inside the connect path", () => {
    // The core itself can never open a socket.
    expect(CORE_SRC).not.toMatch(/from\s+["']pg["']|import\(["']pg["']\)/);
    expect(CORE_SRC).not.toMatch(/require\(["'](pg|net|fs)["']\)/);
    // In the runner, the no-connect path exits BEFORE `pg` is ever imported.
    const noConnectExit = RUNNER_SRC.indexOf("mode: \"PREPARE_ONLY\"");
    const pgImport = RUNNER_SRC.indexOf('await import("pg")');
    expect(noConnectExit).toBeGreaterThan(-1);
    expect(pgImport).toBeGreaterThan(-1);
    expect(noConnectExit).toBeLessThan(pgImport);
  });

  it("2. --connect requires a valid current-session authorization", () => {
    const authGate = RUNNER_SRC.indexOf("validateAuthorization(authorization");
    const pgImport = RUNNER_SRC.indexOf('await import("pg")');
    expect(authGate).toBeGreaterThan(-1);
    expect(authGate).toBeLessThan(pgImport); // authorization is checked BEFORE the driver loads
    expect(validateAuthorization(null, { sessionId: "s", nowMs: 0 }).ok).toBe(false);
  });

  it("3. an expired authorization is rejected", () => {
    const now = 1_000_000;
    const { authorization } = buildAuthorization({ sessionId: "s1", nowMs: now, sentence: AUTHORIZATION_SENTENCE });
    const later = now + 16 * 60 * 1000; // TTL is 15 min
    const res = validateAuthorization(authorization!, { sessionId: "s1", nowMs: later });
    expect(res.ok).toBe(false);
    expect(res.failures.map((f) => f.code)).toContain("AUTHORIZATION_EXPIRED");
  });

  it("4. an authorization is invalidated after one run (single-use), and is session-bound", () => {
    const now = 1_000_000;
    const { authorization } = buildAuthorization({ sessionId: "s1", nowMs: now, sentence: AUTHORIZATION_SENTENCE });
    expect(validateAuthorization(authorization!, { sessionId: "s1", nowMs: now + 1000 }).ok).toBe(true);

    const consumed = { ...authorization!, consumedAtMs: now + 500 };
    expect(validateAuthorization(consumed, { sessionId: "s1", nowMs: now + 1000 }).failures.map((f) => f.code)).toContain("AUTHORIZATION_ALREADY_CONSUMED");

    // a different session cannot reuse it
    expect(validateAuthorization(authorization!, { sessionId: "OTHER", nowMs: now + 1000 }).failures.map((f) => f.code)).toContain("SESSION_MISMATCH");

    // The grant is CLAIMED ATOMICALLY (renameSync) BEFORE the socket opens — not consumed
    // afterwards — so a concurrent second run or a crash-before-finally cannot replay it.
    const claim = RUNNER_SRC.indexOf("renameSync(AUTH_FILE, CLAIMED_FILE)");
    const connect = RUNNER_SRC.indexOf("await runPreflight()");
    const pgImport = RUNNER_SRC.indexOf('await import("pg")');
    expect(claim).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(connect); // claim precedes connection
    expect(claim).toBeLessThan(pgImport); // and precedes the driver load
    // a failed atomic claim refuses the run
    expect(RUNNER_SRC).toMatch(/could not be atomically claimed[\s\S]*process\.exit\(4\)/);
    // and it is NOT an environment variable
    expect(RUNNER_SRC).not.toMatch(/process\.env\.[A-Z_]*AUTHORIZ/i);
  });

  it("4b. a wrong sentence mints nothing", () => {
    expect(buildAuthorization({ sessionId: "s", nowMs: 1, sentence: "i authorize read-only remote database preflight" }).ok).toBe(false);
    expect(buildAuthorization({ sessionId: "s", nowMs: 1, sentence: AUTHORIZATION_SENTENCE }).ok).toBe(true);
    expect(ALLOWED_ACTION).toBe("READ_ONLY_REMOTE_PREFLIGHT");
  });
});

describe("E1.2 §12.5–7 — secrets never leave the process", () => {
  const parts = {
    dsn: "postgresql://postgres.abcdefghijkl:S3cretPassw0rd@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
    host: "aws-0-eu-west-3.pooler.supabase.com",
    user: "postgres.abcdefghijkl",
    password: "S3cretPassw0rd",
    database: "postgres",
  };

  it("5. the DSN is never printed", () => {
    expect(detectLeaks({ target: parts.dsn }, parts).clean).toBe(false);
    expect(detectLeaks({ category: "managed_supabase_remote", fingerprint: "c049738d18e8" }, parts).clean).toBe(true);
  });

  it("6. username, password and host are each caught INDEPENDENTLY (not only as a whole DSN)", () => {
    expect(detectLeaks({ note: `connected as ${parts.user}` }, parts).found.map((f) => f.id)).toContain("user");
    expect(detectLeaks({ note: `pw=${parts.password}` }, parts).found.map((f) => f.id)).toContain("password");
    expect(detectLeaks({ note: `host=${parts.host}` }, parts).found.map((f) => f.id)).toContain("host");
    // the generic database name `postgres` must NOT cry wolf
    expect(detectLeaks({ note: "role category: ordinary" }, parts).clean).toBe(true);
  });

  it("6b. provider secrets and tokens are caught by pattern", () => {
    expect(detectLeaks({ k: "sk_live_51Abcdefghijkl" }).clean).toBe(false);
    expect(detectLeaks({ k: "whsec_abcdef123456" }).clean).toBe(false);
    expect(detectLeaks({ k: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0" }).clean).toBe(false);
    expect(detectLeaks({ k: "https://abcdefghijkl.supabase.co" }).clean).toBe(false);
  });

  it("6c. a SHORT database password (< 6 chars) is still caught", () => {
    // Postgres imposes no minimum password length; a 4-char password must not slip through.
    expect(detectLeaks({ note: "db password is pg42" }, { password: "pg42" }).found.map((f) => f.id)).toContain("password");
    // and the raw percent-encoded form of a credential is guarded too
    expect(detectLeaks({ note: "creds p%40ss99" }, { password: "p@ss99", passwordRaw: "p%40ss99" }).found.map((f) => f.id)).toContain("passwordRaw");
  });

  it("7. remote errors are sanitized — error.message is NEVER surfaced", () => {
    const e = Object.assign(new Error("connect ECONNREFUSED 10.1.2.3:5432 for user postgres.abcdefghijkl"), { code: "ECONNREFUSED" });
    const s = sanitizeError(e);
    expect(s.messageIncluded).toBe(false);
    expect(JSON.stringify(s)).not.toContain("10.1.2.3");
    expect(JSON.stringify(s)).not.toContain("postgres.abcdefghijkl");
    expect(s.code).toBe("ECONNREFUSED");
    // the runner only ever emits the sanitized shape
    expect(RUNNER_SRC).not.toMatch(/e\.message|error\.message/);
  });
});

describe("E1.2 §12.8–15 — the query registry is the only way to reach the server", () => {
  it("8. every query must come from the registry — an unknown id throws", () => {
    expect(() => resolveRegisteredQuery("objects.tables")).not.toThrow();
    expect(() => resolveRegisteredQuery("drop.everything")).toThrow(/not in the registry/);
    // the runner's executor takes an ID, never SQL
    expect(RUNNER_SRC).toMatch(/async function runRegistered\(id, params = \[\]\)/);
    expect(RUNNER_SRC).toMatch(/const entry = resolveRegisteredQuery\(id\)/);
    expect(RUNNER_SRC).toMatch(/client\.query\(entry\.sql, params\)/);
  });

  it("9. arbitrary SQL is rejected", () => {
    expect(validateSql("select * from clonechat_messages").ok).toBe(false);
    expect(validateSql("select 1; drop table clonechat_messages").ok).toBe(false);
    expect(validateSql("select ${payload} from pg_class").ok).toBe(false);
  });

  it("10. every mutation statement class is rejected", () => {
    const mutations = [
      "insert into clonechat_messages values (1)",
      "update pg_class set relname = 'x'",
      "delete from clonechat_messages",
      "drop table clonechat_messages",
      "alter table clonechat_messages add column x text",
      "create table t (id int)",
      "truncate clonechat_messages",
      "grant select on pg_class to public",
      "revoke select on pg_class from public",
      "copy pg_class to stdout",
      "vacuum",
      "analyze",
      "refresh materialized view mv",
      "call some_proc()",
      "do $$ begin end $$",
      "merge into t using s on true",
    ];
    for (const sql of mutations) expect(validateSql(sql).ok, sql).toBe(false);
  });

  it("11. SELECT INTO is rejected", () => {
    expect(validateSql("select relname into tmp from pg_class").ok).toBe(false);
    expect(validateSql("select relname into tmp from pg_class").violations.some((v) => v.detail === "select_into" || v.code === "FORBIDDEN_TOKEN")).toBe(true);
  });

  it("12. temp-object creation and locking are rejected", () => {
    expect(validateSql("create temp table t as select 1").ok).toBe(false);
    expect(validateSql("lock table pg_class").ok).toBe(false);
    expect(validateSql("select relname from pg_class for update").ok).toBe(false);
  });

  it("13. customer-table row queries are rejected", () => {
    for (const rel of ["clonechat_messages", "clonechat_conversations", "clonestore_pp_commission_entries", "clonestore_pp_partners", "pierre_rt_employees"]) {
      expect(isCustomerRelation(rel), rel).toBe(true);
      expect(validateSql(`select * from ${rel}`).ok, rel).toBe(false);
    }
    // the migration LEDGER is the sole pierre_rt_ exemption — it holds filenames, not people
    expect(isCustomerRelation("public.pierre_rt_schema_migrations")).toBe(false);
  });

  it("13b. a comma-joined customer table cannot hide behind a catalog table (defense in depth)", () => {
    // The naive `\bfrom\s+(\w+)` regex would only see pg_class and wave this through.
    for (const sql of [
      "select * from pg_class, clonechat_messages",
      "select * from pg_class c, clonestore_pp_partners p where c.oid = 1",
      "select * from pg_class as a, auth.users as b",
      "select * from pg_class, pg_namespace, clonechat_commands",
    ]) {
      expect(extractRelations(sql), sql).toEqual(expect.arrayContaining([expect.stringMatching(/clonechat_|clonestore_|auth\./)]));
      expect(validateSql(sql).ok, sql).toBe(false);
    }
    // …but a legitimate two-table CATALOG join still validates.
    expect(validateSql("select 1 from pg_class c, pg_namespace n where c.relnamespace = n.oid").ok).toBe(true);
  });

  it("13c. quoted identifiers and block-comment separators cannot hide a customer table", () => {
    for (const sql of [
      'select * from "clonechat_messages"',
      "select * from pg_class/**/,/**/clonechat_messages",
      'select * from public."clonechat_conversations"',
    ]) {
      expect(validateSql(sql).ok, sql).toBe(false);
    }
  });

  it("13d. a `--` inside a STRING LITERAL cannot blank out a stacked mutation (strip order)", () => {
    // string literals are stripped BEFORE line comments, so the '--' here is not a comment
    const sql = "select 'a--b'; drop table clonechat_messages";
    const v = validateSql(sql);
    expect(v.ok).toBe(false);
    expect(v.violations.map((x) => x.code)).toEqual(expect.arrayContaining(["STATEMENT_STACKING"]));
    expect(v.violations.some((x) => x.detail === "drop")).toBe(true);
  });

  it("14. auth / session / secret relations are rejected", () => {
    for (const rel of ["auth.users", "auth.sessions", "auth.refresh_tokens", "storage.objects", "vault.secrets"]) {
      expect(isCustomerRelation(rel), rel).toBe(true);
      expect(validateSql(`select * from ${rel}`).ok, rel).toBe(false);
    }
  });

  it("15. only catalog / information_schema / migration-history relations are reachable", () => {
    const audit = auditRegistry();
    expect(audit.ok).toBe(true);
    expect(audit.registeredQueryCount).toBeGreaterThanOrEqual(18);
    for (const entry of Object.values(QUERY_REGISTRY)) {
      for (const rel of extractRelations(entry.sql)) {
        expect(ALLOWED_RELATIONS.has(rel), `${entry.id} → ${rel}`).toBe(true);
        expect(isCustomerRelation(rel), `${entry.id} → ${rel}`).toBe(false);
      }
      expect(entry.mutationRisk).toBe("none");
      expect(entry.customerRowRisk).toBe("none");
    }
  });

  it("15b. schema-usage query tolerates an ABSENT role (guards has_schema_privilege) — real-connection hardening", () => {
    // has_schema_privilege(role, ...) THROWS 42704 when the role does not exist. On a remote
    // where clonechat_app is not yet created, an unguarded call aborts the whole sweep. The
    // query must guard with `exists (select 1 from pg_roles ...)` so an absent role returns null.
    const q = QUERY_REGISTRY["grants.schema_usage"];
    expect(q.sql).toMatch(/exists\s*\(\s*select 1 from pg_roles where rolname = \$1\s*\)/i);
    expect(validateSql(q.sql).ok).toBe(true);
  });

  it("38. no customer-row query exists anywhere in the registry", () => {
    const allSql = Object.values(QUERY_REGISTRY).map((e) => e.sql).join("\n").toLowerCase();
    // table names may appear ONLY as bound parameters ($1), never as query targets
    expect(allSql).not.toMatch(/from\s+clonechat_/);
    expect(allSql).not.toMatch(/from\s+clonestore_/);
    expect(allSql).not.toMatch(/from\s+auth\./);
    for (const entry of Object.values(QUERY_REGISTRY)) expect(validateSql(entry.sql).ok, entry.id).toBe(true);
  });
});

describe("E1.2 §12.16–21 — the session is provably read-only", () => {
  it("16. statement, lock and idle-in-transaction timeouts are all configured", () => {
    const ids = SESSION_SAFETY.statements.map((s) => s.id);
    expect(ids).toContain("safety.statement_timeout");
    expect(ids).toContain("safety.lock_timeout");
    expect(ids).toContain("safety.idle_in_transaction_timeout");
    expect(SESSION_SAFETY.statementTimeoutMs).toBeGreaterThan(0);
    expect(SESSION_SAFETY.statementTimeoutMs).toBeLessThanOrEqual(30000);
  });

  it("17. a read-only transaction is enforced", () => {
    const sqls = SESSION_SAFETY.statements.map((s) => s.sql);
    expect(sqls).toContain("set session characteristics as transaction read only");
    expect(sqls).toContain("begin read only");
  });

  it("18. search_path is pinned to catalog schemas (no search-path trust)", () => {
    expect(SESSION_SAFETY.searchPath).toBe("pg_catalog, information_schema");
    expect(SESSION_SAFETY.statements.some((s) => s.sql === "set search_path = pg_catalog, information_schema")).toBe(true);
  });

  it("19. rollback always occurs — on the happy path AND in the catch", () => {
    expect(SESSION_SAFETY.rollback.sql).toBe("rollback");
    const rollbacks = RUNNER_SRC.match(/SESSION_SAFETY\.rollback\.sql/g) ?? [];
    expect(rollbacks.length).toBeGreaterThanOrEqual(3); // safety-failure path, success path, catch path
  });

  it("20. the client is always released and the pool always ended", () => {
    expect(RUNNER_SRC).toMatch(/finally\s*\{[\s\S]*client\.release\(\)/);
    expect(RUNNER_SRC).toMatch(/pool\.end\(\)/);
  });

  it("21. a failed safety assertion stops inspection dead", () => {
    // verifySessionSafety fails closed on every dimension
    expect(verifySessionSafety(null).ok).toBe(false);
    expect(verifySessionSafety({ transaction_read_only: "off", search_path: "pg_catalog, information_schema", statement_timeout: "5s", lock_timeout: "2s", idle_in_transaction_session_timeout: "10s" }).ok).toBe(false);
    expect(verifySessionSafety({ transaction_read_only: "on", search_path: "public", statement_timeout: "5s", lock_timeout: "2s", idle_in_transaction_session_timeout: "10s" }).ok).toBe(false);
    expect(verifySessionSafety({ transaction_read_only: "on", search_path: "pg_catalog, information_schema", statement_timeout: "0", lock_timeout: "2s", idle_in_transaction_session_timeout: "10s" }).ok).toBe(false);
    expect(verifySessionSafety({ transaction_read_only: "on", search_path: 'pg_catalog, "information_schema"', statement_timeout: "5s", lock_timeout: "2s", idle_in_transaction_session_timeout: "10s" }).ok).toBe(true);

    // and the runner rolls back + emits the failure WITHOUT running an inspection query
    expect(RUNNER_SRC).toMatch(/if \(!safety\.ok\)[\s\S]*rollback[\s\S]*SAFETY_ASSERTION_FAILED[\s\S]*return;/);

    // with safety off, classification is UNVERIFIABLE — never a guess
    expect(classifyP941({ connected: true, safetyOk: false }).state).toBe("UNVERIFIABLE");
    expect(classifyPartnerPayout({ connected: true, safetyOk: false }).state).toBe("UNVERIFIABLE");
  });

  it("21b. an INCOMPLETE inspection (a query threw mid-sweep) yields UNVERIFIABLE, never a confident guess", () => {
    // connected + safe, but the sweep did not finish → both classifiers must fail closed.
    const p = { ...idealP941Evidence(), inspectionComplete: false };
    expect(classifyP941(p).state).toBe("UNVERIFIABLE");
    const q = { ...idealPartnerEvidence(), inspectionComplete: false };
    expect(classifyPartnerPayout(q).state).toBe("UNVERIFIABLE");
    // the runner only sets inspectionComplete=true AFTER the whole sweep, and never in the catch
    expect(RUNNER_SRC).toMatch(/ev\.inspectionComplete = true;/);
    expect(RUNNER_SRC).toMatch(/inspectionComplete: false/);
    const setTrue = RUNNER_SRC.indexOf("ev.inspectionComplete = true");
    const catchStart = RUNNER_SRC.indexOf("} catch (e) {");
    expect(setTrue).toBeGreaterThan(-1);
    expect(setTrue).toBeLessThan(catchStart); // set on the success path, before the catch
  });
});

describe("E1.2 §12.22–29 — P9.4.1 classification from metadata alone", () => {
  it("22. NOT_APPLIED when the role, tables and functions are all absent", () => {
    const r = classifyP941({ connected: true, safetyOk: true, tables: [], columns: [], indexes: [], policies: [], functions: [], tableGrants: [], routineGrants: [], role: null });
    expect(r.state).toBe("NOT_APPLIED");
  });

  it("23. PARTIALLY_APPLIED when some canonical objects are missing", () => {
    const ev = idealP941Evidence();
    ev.tables = ev.tables.filter((t) => t.relname !== "clonechat_commands");
    ev.columns = ev.columns.filter((c) => c.table_name !== "clonechat_commands");
    const r = classifyP941(ev);
    expect(r.state).toBe("PARTIALLY_APPLIED");
    expect((r.detail as any).missingTables).toContain("clonechat_commands");
  });

  it("23b. PARTIALLY_APPLIED when a single column is missing (deep inspection, not name-presence)", () => {
    const ev = idealP941Evidence();
    ev.columns = ev.columns.filter((c) => !(c.table_name === "clonechat_commands" && c.column_name === "payload_sha256"));
    const r = classifyP941(ev);
    expect(r.state).toBe("PARTIALLY_APPLIED");
    expect((r.detail as any).objectGaps).toContainEqual({ table: "clonechat_commands", column: "payload_sha256", problem: "COLUMN_MISSING" });
  });

  it("23c. PARTIALLY_APPLIED when the exactly-once UNIQUE on clonechat_commands.fingerprint is gone", () => {
    const ev = idealP941Evidence();
    ev.constraints = ev.constraints.filter((c) => c.table_name !== "clonechat_commands");
    const r = classifyP941(ev);
    expect(r.state).toBe("PARTIALLY_APPLIED");
    expect((r.detail as any).objectGaps).toContainEqual({ table: "clonechat_commands", column: "fingerprint", problem: "UNIQUE_CONSTRAINT_MISSING" });
  });

  it("24. FULLY_APPLIED only when role, tables, columns, indexes, RLS, policies, grants and functions ALL check out", () => {
    const r = classifyP941(idealP941Evidence());
    expect(r.state).toBe("FULLY_APPLIED");
    expect(r.blockers).toHaveLength(0);
  });

  it("25. INCOMPATIBLE_EXISTING_STATE on unsafe role attributes (LOGIN / SUPERUSER)", () => {
    const ev = idealP941Evidence();
    ev.role.rolcanlogin = true;
    ev.role.rolsuper = true;
    const r = classifyP941(ev);
    expect(r.state).toBe("INCOMPATIBLE_EXISTING_STATE");
    expect(r.blockers.map((b: any) => b.code)).toEqual(expect.arrayContaining(["ROLE_CAN_LOGIN", "ROLE_IS_SUPERUSER"]));
  });

  it("26. BYPASSRLS is a blocker — never FULLY_APPLIED", () => {
    const ev = idealP941Evidence();
    ev.role.rolbypassrls = true;
    const r = classifyP941(ev);
    expect(r.state).toBe("INCOMPATIBLE_EXISTING_STATE");
    expect(r.blockers.map((b: any) => b.code)).toContain("ROLE_BYPASSES_RLS");
  });

  it("27. broad grants outside the clonechat_ perimeter are a blocker", () => {
    const ev = idealP941Evidence();
    ev.tableGrants.push({ table_schema: "public", table_name: "clonestore_pp_commission_entries", privilege_type: "SELECT" });
    ev.tableGrants.push({ table_schema: "public", table_name: "pierre_rt_employees", privilege_type: "SELECT" });
    const r = classifyP941(ev);
    expect(r.state).toBe("INCOMPATIBLE_EXISTING_STATE");
    expect(r.blockers.map((b: any) => b.code)).toContain("GRANTS_OUTSIDE_PERIMETER");
    expect((r.detail as any).grantsOutsidePerimeter).toContain("public.pierre_rt_employees");
  });

  it("28. missing / unforced RLS and a globally-permissive tenant policy are blockers", () => {
    const noRls = idealP941Evidence();
    noRls.tables[0].relrowsecurity = false;
    expect(classifyP941(noRls).blockers.map((b: any) => b.code)).toContain("RLS_NOT_ENABLED");

    const notForced = idealP941Evidence();
    notForced.tables[1].relforcerowsecurity = false;
    expect(classifyP941(notForced).blockers.map((b: any) => b.code)).toContain("RLS_NOT_FORCED");

    const wideOpen = idealP941Evidence();
    wideOpen.policies = wideOpen.policies.map((p) => ({ ...p, qual: "true", with_check: "true", cmd: "ALL" }));
    const r = classifyP941(wideOpen);
    expect(r.state).toBe("INCOMPATIBLE_EXISTING_STATE");
    expect(r.blockers.map((b: any) => b.code)).toContain("TENANT_POLICY_UNSAFE");
    expect(JSON.stringify(r.detail)).toContain("PERMISSIVE_POLICY_GRANTS_GLOBAL_ACCESS");
  });

  it("29. an unexpected SECURITY DEFINER function is a blocker", () => {
    const ev = idealP941Evidence();
    ev.functions[0].prosecdef = true;
    const r = classifyP941(ev);
    expect(r.state).toBe("INCOMPATIBLE_EXISTING_STATE");
    expect(r.blockers.map((b: any) => b.code)).toContain("UNSAFE_SECURITY_DEFINER");
  });

  it("29b. a partner-table RLS gap is NOT blamed on P9.4.1 (perimeter scoping)", () => {
    // The runner sweeps both perimeters into ev.tables. A clonestore_pp_* table without RLS
    // must not turn P9.4.1's verdict into INCOMPATIBLE.
    const ev = idealP941Evidence();
    ev.tables.push({ relname: "clonestore_pp_transfers", nspname: "public", owner: "postgres", relrowsecurity: false, relforcerowsecurity: false });
    const r = classifyP941(ev);
    expect(r.state).toBe("FULLY_APPLIED");
    expect(JSON.stringify(r.detail)).not.toContain("clonestore_pp_transfers");
  });
});

describe("E1.2 §12.30–31, 37 — history and objects are reconciled, never conflated", () => {
  it("30. a history entry with incomplete objects is PARTIAL/INCOMPATIBLE — never FULLY_APPLIED", () => {
    const ev = idealP941Evidence();
    ev.tables = ev.tables.slice(0, 3); // objects incomplete
    ev.columns = ev.columns.filter((c) => ev.tables.some((t) => t.relname === c.table_name));
    const objectState = classifyP941(ev).state;
    expect(objectState).not.toBe("FULLY_APPLIED");

    const drift = detectDrift({ objectState, historyState: "ENTRY_PRESENT" });
    expect(drift.driftDetected).toBe(true);
    expect(drift.signals.map((s) => s.code)).toContain("HISTORY_WITHOUT_OBJECTS");
  });

  it("31. complete objects with no ledger entry are detected as drift, not silently blessed", () => {
    const drift = detectDrift({ objectState: "FULLY_APPLIED", historyState: "ENTRY_ABSENT_LEDGER_EXISTS" });
    expect(drift.signals.map((s) => s.code)).toContain("OBJECTS_WITHOUT_HISTORY");

    const noLedger = detectDrift({ objectState: "FULLY_APPLIED", historyState: "NO_LEDGER_FOR_THIS_MIGRATION" });
    expect(noLedger.signals.map((s) => s.code)).toContain("OBJECTS_WITHOUT_LEDGER_MECHANISM");
  });

  it("31b. the real history mechanism is reported honestly: no ledger tracks either migration", () => {
    const h = reconcileHistory({
      connected: true, safetyOk: true, ledgerPresent: true, supabaseCliPresent: false,
      entries: [{ filename: "2026-06-15__pierre_v1_runtime.sql", checksum: "x" }],
      migrationFileName: "p941_clonechat_durable", ledgerTracksThisMigration: false,
    });
    expect(h.state).toBe("NO_LEDGER_FOR_THIS_MIGRATION");
    expect(h.reason).toMatch(/object state is the only admissible evidence/);
    // and without a connection it can only be UNVERIFIABLE
    expect(reconcileHistory({ connected: false, safetyOk: false, ledgerTracksThisMigration: false }).state).toBe("UNVERIFIABLE");
  });

  it("37. a local migration FILE never implies remote application", () => {
    const cc = buildE12CommandCenter({
      e11LocallyReconciled: true, repositoryStable: true,
      p941LocalMigrationPresent: true, partnerPayoutMigrationPresent: true,
      readOnlyAuthorizationReceived: false, remoteConnectionAttempted: false,
    });
    expect(cc.p941LocalMigrationPresent).toBe(true);
    expect(cc.partnerPayoutMigrationPresent).toBe(true);
    expect(cc.p941RemoteState).toBe("UNVERIFIABLE");
    expect(cc.partnerPayoutRemoteState).toBe("UNVERIFIABLE");
    expect(cc.remoteSchemaCompatibility).toBe("REMOTE_SCHEMA_UNVERIFIABLE");
    expect(cc.verdict).toBe("E1.2 — READ-ONLY PREFLIGHT PREPARED / OWNER AUTHORIZATION REQUIRED");
  });
});

describe("E1.2 §12.32–36 — partner payout classification", () => {
  it("32. NOT_APPLIED when the partner program is not installed at all", () => {
    const r = classifyPartnerPayout({ connected: true, safetyOk: true, tables: [], columns: [], indexes: [], constraints: [], extensions: [], triggers: [] });
    expect(r.state).toBe("NOT_APPLIED");
  });

  it("33. PARTIALLY_APPLIED when the base exists but this migration's delta does not", () => {
    const ev = idealPartnerEvidence();
    ev.columns = ev.columns.filter((c) => c.column_name !== "batch_hash");
    ev.indexes = ev.indexes.filter((i) => i.indexname !== "idx_pp_transfer_needs_attention");
    const r = classifyPartnerPayout(ev);
    expect(r.state).toBe("PARTIALLY_APPLIED");
    expect((r.detail as any).missingColumns).toContainEqual({ table: "clonestore_pp_transfers", column: "batch_hash" });
    expect((r.detail as any).missingIndexes).toContain("idx_pp_transfer_needs_attention");
  });

  it("33b. FULLY_APPLIED only when every added column, index and CHECK vocabulary is present", () => {
    const r = classifyPartnerPayout(idealPartnerEvidence());
    expect(r.state).toBe("FULLY_APPLIED");
    expect(r.blockers).toHaveLength(0);
    expect((r.detail as any).idempotency).toEqual({
      runKeyUnique: true, transferIdempotencyUnique: true, singleLiveBatchIndex: true, singleLiveTransferIndex: true,
    });
  });

  it("33c. the two indexes hosted on non-base tables are actually observed (no false PARTIAL)", () => {
    // idx_pp_attr_partner_status lives on clonestore_pp_attributions, idx_pp_touch_partner on
    // clonestore_pp_referral_touches — neither is a base table. A fully-applied DB must classify
    // FULLY_APPLIED, and the runner must include those host tables in its scan scope.
    expect(PARTNER_PAYOUT_CANONICAL.indexHostTables).toEqual(
      expect.arrayContaining(["clonestore_pp_attributions", "clonestore_pp_referral_touches"]),
    );
    // the runner unions indexHostTables into ALL_TABLES
    expect(RUNNER_SRC).toMatch(/\.\.\.PARTNER_PAYOUT_CANONICAL\.indexHostTables/);
    // and if those indexes are genuinely absent, it IS PARTIAL (not silently ok)
    const ev = idealPartnerEvidence();
    ev.indexes = ev.indexes.filter((i) => i.indexname !== "idx_pp_attr_partner_status");
    expect(classifyPartnerPayout(ev).state).toBe("PARTIALLY_APPLIED");
  });

  it("33d. uq_pp_transfer_partner_period is verified by PREDICATE, not just by name", () => {
    // The base ships a same-named index with a NARROWER predicate. A name-only check would
    // accept the un-migrated index; the classifier must reject a stale definition.
    const stale = idealPartnerEvidence();
    stale.indexes = stale.indexes.map((i) =>
      i.indexname === "uq_pp_transfer_partner_period"
        ? { ...i, indexdef: "CREATE UNIQUE INDEX uq_pp_transfer_partner_period ON public.clonestore_pp_transfers USING btree (partner_id, period_start, period_end) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text]))" }
        : i,
    );
    const r = classifyPartnerPayout(stale);
    expect(r.state).toBe("INCOMPATIBLE_EXISTING_STATE");
    expect(r.blockers.map((b: any) => b.code)).toContain("SINGLE_LIVE_TRANSFER_INDEX_STALE");
  });

  it("34. a missing idempotency constraint is a BLOCKER (double-payment risk)", () => {
    const noLiveBatch = idealPartnerEvidence();
    noLiveBatch.indexes = noLiveBatch.indexes.filter((i) => i.indexname !== "uq_pp_item_entry_live");
    const r1 = classifyPartnerPayout(noLiveBatch);
    expect(r1.state).toBe("INCOMPATIBLE_EXISTING_STATE");
    expect(r1.blockers.map((b: any) => b.code)).toContain("MISSING_SINGLE_LIVE_BATCH_CONSTRAINT");

    const noRunKey = idealPartnerEvidence();
    noRunKey.constraints = noRunKey.constraints.filter((c) => c.conname !== "clonestore_pp_payout_runs_run_key_key");
    expect(classifyPartnerPayout(noRunKey).blockers.map((b: any) => b.code)).toContain("MISSING_RUN_KEY_UNIQUENESS");

    const noIdem = idealPartnerEvidence();
    noIdem.constraints = noIdem.constraints.filter((c) => c.conname !== "clonestore_pp_transfers_idempotency_key_key");
    expect(classifyPartnerPayout(noIdem).blockers.map((b: any) => b.code)).toContain("MISSING_TRANSFER_IDEMPOTENCY");
  });

  it("35. broken test/live separation is a BLOCKER — and a default that silently enables live is caught", () => {
    const liveDefault = idealPartnerEvidence();
    liveDefault.columns = liveDefault.columns.map((c) =>
      c.column_name === "stripe_mode" && c.table_name === "clonestore_pp_transfers" ? { ...c, column_default: "'live'::text" } : c,
    );
    const r = classifyPartnerPayout(liveDefault);
    expect(r.state).toBe("INCOMPATIBLE_EXISTING_STATE");
    expect(r.blockers.map((b: any) => b.code)).toContain("TEST_LIVE_SEPARATION_UNSAFE");
    expect(JSON.stringify(r.detail)).toContain("DEFAULT_NOT_TEST");

    const noMode = idealPartnerEvidence();
    noMode.columns = noMode.columns.filter((c) => c.column_name !== "stripe_mode");
    expect(JSON.stringify(classifyPartnerPayout(noMode).detail)).toContain("MODE_COLUMN_MISSING");

    const wetRun = idealPartnerEvidence();
    wetRun.columns = wetRun.columns.map((c) => (c.column_name === "dry_run" ? { ...c, column_default: "false" } : c));
    expect(JSON.stringify(classifyPartnerPayout(wetRun).detail)).toContain("DRY_RUN_DEFAULT_NOT_TRUE");
  });

  it("36. an outbound-effectful trigger is a BLOCKER; a mere immutability guard is not", () => {
    const ev = idealPartnerEvidence();
    expect(classifyPartnerPayout(ev).state).toBe("FULLY_APPLIED"); // the *_guard trigger is fine

    const bad = idealPartnerEvidence();
    bad.triggers = [{ table_name: "clonestore_pp_transfers", tgname: "trg_stripe_send", function_name: "stripe_call_http", tgenabled: "O" }];
    const r = classifyPartnerPayout(bad);
    expect(r.state).toBe("INCOMPATIBLE_EXISTING_STATE");
    expect(r.blockers.map((b: any) => b.code)).toContain("TRIGGER_MAY_INITIATE_TRANSFER");
  });

  it("36b. a remote cron is NEVER inferred from table presence — only from pg_cron actually being installed", () => {
    const plain = classifyPartnerPayout(idealPartnerEvidence());
    expect((plain.detail as any).remoteCronPossible).toBe(false);

    const cron = idealPartnerEvidence();
    cron.extensions = [{ extname: "pg_cron" }, { extname: "pg_net" }];
    const r = classifyPartnerPayout(cron);
    expect((r.detail as any).remoteCronPossible).toBe(true);
    expect((r.detail as any).dangerousExtensionsInstalled).toEqual(expect.arrayContaining(["pg_cron", "pg_net"]));
    // and the P10 floor is still unreachable from SQL — it is a compile-time constant
    expect((r.detail as any).p10FloorReachableFromDatabase).toBe(false);
  });
});

describe("E1.2 §12.39–42 — the gates E1.2 can never open", () => {
  it("39/40/41/42. production, deployment, mutation and migration counters are pinned", () => {
    const cc = buildE12CommandCenter({
      e11LocallyReconciled: true, repositoryStable: true, readOnlyAuthorizationReceived: true,
      remoteConnectionAttempted: true, remoteConnectionSucceeded: true, remoteReadOnlyEnforced: true,
      remoteTargetCategory: "managed_supabase_remote", productionSuspected: true,
      p941: classifyP941(idealP941Evidence()),
      partner: classifyPartnerPayout(idealPartnerEvidence()),
      p941HistoryState: "NO_LEDGER_FOR_THIS_MIGRATION",
      partnerHistoryState: "NO_LEDGER_FOR_THIS_MIGRATION",
    });
    // Even in the BEST case — both migrations fully applied and compatible —
    // production, payment and deployment stay shut.
    expect(cc.remoteSchemaCompatibility).toBe("REMOTE_SCHEMA_COMPATIBLE");
    expect(cc.productionAuthorized).toBe(false);
    expect(cc.partnerPayoutLiveAuthorized).toBe(false);
    expect(cc.partnerPayoutRemoteExecutionEnabled).toBe(false);
    expect(cc.paymentMode).toBe("disabled");
    expect(cc.deploymentStillBlocked).toBe(true);
    expect(cc.deploymentPerformed).toBe(false);
    expect(cc.remoteDatabaseMutated).toBe(false);
    expect(cc.mutationsExecuted).toBe(0);
    expect(cc.migrationsApplied).toBe(0);
    expect(cc.customerRowsRead).toBe(0);
    expect(isDeploymentAuthorized(cc)).toBe(false);
    expect(cc.verdict).toBe("E1.2 — REMOTE DATABASE ALREADY COMPATIBLE / DEPLOYMENT AUTHORIZATION STILL REQUIRED");
    expect(E1_2_HARD_VALUES.productionAuthorized).toBe(false);
  });

  it("the command center refuses to publish a false green (hard-value guard)", () => {
    // A drifted schema must produce the repair verdict, never a compatible one.
    const bad = idealP941Evidence();
    bad.role.rolbypassrls = true;
    const cc = buildE12CommandCenter({
      e11LocallyReconciled: true, repositoryStable: true, readOnlyAuthorizationReceived: true,
      remoteConnectionAttempted: true, remoteConnectionSucceeded: true, remoteReadOnlyEnforced: true,
      p941: classifyP941(bad),
      partner: classifyPartnerPayout(idealPartnerEvidence()),
    });
    expect(cc.remoteSchemaCompatibility).toBe("REMOTE_SCHEMA_DRIFTED");
    expect(cc.clonechatAppRoleBypassesRls).toBe(true);
    expect(cc.verdict).toBe("E1.2 — REMOTE SCHEMA PARTIAL OR DRIFTED / REPAIR PLAN REQUIRED");
    expect(cc.nextSafeAction).toBe("CREATE_REPAIR_MIGRATION");
    expect(cc.exactBlockers.join(" ")).toMatch(/BYPASSRLS|circumventable/i);
  });

  it("with no connection every remote field is UNVERIFIABLE — never a default-true", () => {
    const cc = buildE12CommandCenter({ repositoryStable: true });
    for (const k of [
      "clonechatAppRoleExists", "clonechatAppRoleLeastPrivilege", "clonechatDurableTablesReady",
      "clonechatDurableFunctionsReady", "clonechatRlsReady", "clonechatGrantsReady",
      "partnerPayoutConstraintsReady", "partnerPayoutTestLiveSeparationReady",
      "remoteDriftDetected", "backupRequired", "migrationApplicationRequired", "repairMigrationRequired",
    ] as const) {
      expect(cc[k], k).toBe("UNVERIFIABLE");
    }
    expect(cc.remoteConnectionSucceeded).toBe(false);
    expect(cc.remoteReadOnlyEnforced).toBe(false);
  });

  it("target classification never needs a connection and never exposes the host", () => {
    expect(classifyTarget("postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres")).toBe("managed_supabase_remote");
    expect(classifyTarget("postgresql://u:p@localhost:5432/postgres")).toBe("local");
    expect(classifyTarget("")).toBe("absent");
    expect(classifyTarget("not-a-url")).toBe("unparseable");
  });
});
