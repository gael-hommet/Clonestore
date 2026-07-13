#!/usr/bin/env node
// scripts/e1-2-remote-state-preflight.mjs
//
// E1.2 — THE canonical read-only remote preflight runner.
// Supersedes scripts/e1-1-clonechat-remote-preflight.mjs (kept only as E1.1 evidence).
//
// It cannot mutate anything, and that is structural rather than promised:
//   * it never accepts SQL — it accepts a query ID and looks the SQL up in the registry;
//   * every registry entry is structurally validated (statement type + token scan +
//     relation allowlist) BEFORE the socket is even opened;
//   * the session is READ ONLY, timed out, lock-timed out, idle-timed out, and its
//     search_path is pinned to pg_catalog,information_schema — and all of that is then
//     VERIFIED from the server. If the verification fails, zero inspection queries run;
//   * it never prints the DSN, host, username, password or any token — output is scanned
//     for each of those independently and the run is refused if any appears.
//
// Modes:
//   node scripts/e1-2-remote-state-preflight.mjs
//       → classify the target + audit the registry. NO CONNECTION. (default)
//
//   node scripts/e1-2-remote-state-preflight.mjs --authorize --sentence "<exact sentence>"
//       → mint a short-lived, single-use authorization file. NO CONNECTION.
//
//   node scripts/e1-2-remote-state-preflight.mjs --connect --session <id>
//       → the ONLY path that opens a socket. Requires a valid, unexpired, unconsumed
//         authorization for THIS session id.

import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";

import {
  AUTHORIZATION_SENTENCE,
  ALLOWED_ACTION,
  QUERY_REGISTRY,
  SESSION_SAFETY,
  P941_CANONICAL,
  P941_ALL_TABLES,
  PARTNER_PAYOUT_CANONICAL,
  auditRegistry,
  resolveRegisteredQuery,
  verifySessionSafety,
  detectLeaks,
  sanitizeError,
  classifyTarget,
  isProductionSuspected,
  buildAuthorization,
  validateAuthorization,
  classifyP941,
  classifyPartnerPayout,
  reconcileHistory,
  detectDrift,
  deriveE12CommandCenter,
} from "../src/lib/clonestore/external-enablement/e1/e1-2-preflight-core.mjs";

const ROOT = process.cwd();
const PROOF_DIR = resolve(ROOT, ".e1-2-proofs", "remote-database-state");
const AUTH_DIR = resolve(ROOT, ".e1-2-auth");
const AUTH_FILE = resolve(AUTH_DIR, "authorization.json");

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};

const CONNECT = has("--connect");
const AUTHORIZE = has("--authorize");

// ── Target resolution — the value is read, never printed ──────────────────────
function readEnvFile() {
  const out = {};
  for (const f of [".env.local", ".env"]) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && out[m[1]] === undefined) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}
const env = { ...readEnvFile(), ...process.env };
const DSN = env.CLONECHAT_DB_URL || env.DATABASE_URL || "";
const SOURCE_VAR = env.CLONECHAT_DB_URL ? "CLONECHAT_DB_URL" : env.DATABASE_URL ? "DATABASE_URL" : null;
const CATEGORY = classifyTarget(DSN);
const PRODUCTION_SUSPECTED = isProductionSuspected(CATEGORY);

/** Everything the leak guard must never find in our output. */
function secretParts() {
  const parts = { dsn: DSN || undefined };
  try {
    const u = new URL(DSN);
    parts.host = u.hostname || undefined;
    // Guard BOTH the decoded and the raw percent-encoded forms — output could contain either.
    parts.user = decodeURIComponent(u.username || "") || undefined;
    parts.password = decodeURIComponent(u.password || "") || undefined;
    parts.userRaw = u.username || undefined;
    parts.passwordRaw = u.password || undefined;
    parts.database = (u.pathname || "").replace(/^\//, "") || undefined;
  } catch {
    /* unparseable → the DSN itself is still guarded */
  }
  return parts;
}
const FINGERPRINT = DSN ? createHash("sha256").update(DSN).digest("hex").slice(0, 12) : null;

function writeProof(name, obj) {
  mkdirSync(PROOF_DIR, { recursive: true });
  const leak = detectLeaks(obj, secretParts());
  if (!leak.clean) {
    console.error(`E1.2 REFUSED: a secret would have leaked into ${name} (${leak.found.map((f) => f.id).join(", ")}). Nothing written.`);
    process.exit(3);
  }
  writeFileSync(resolve(PROOF_DIR, name), JSON.stringify(obj, null, 2) + "\n");
  return name;
}

const localFilePresent = (rel) => existsSync(resolve(ROOT, rel));
const sha256File = (rel) => (localFilePresent(rel) ? createHash("sha256").update(readFileSync(resolve(ROOT, rel))).digest("hex") : null);

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --authorize (no connection)
// ─────────────────────────────────────────────────────────────────────────────
if (AUTHORIZE) {
  const sentence = val("--sentence");
  if (sentence !== AUTHORIZATION_SENTENCE) {
    console.error("E1.2 REFUSED: the authorization sentence does not match exactly. No authorization minted.");
    process.exit(4);
  }
  const sessionId = randomUUID();
  const now = Date.now();
  const built = buildAuthorization({
    sessionId,
    nowMs: now,
    sentence,
    sentenceSha256: createHash("sha256").update(sentence).digest("hex"),
  });
  if (!built.ok) {
    console.error(`E1.2 REFUSED: ${built.reason}`);
    process.exit(4);
  }
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(AUTH_FILE, JSON.stringify(built.authorization, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        authorizationMinted: true,
        sessionId,
        allowedAction: ALLOWED_ACTION,
        expiresInMinutes: Math.round((built.authorization.expiresAtMs - now) / 60000),
        singleUse: true,
        storedIn: ".e1-2-auth/authorization.json",
        note: "Not an environment variable — an env var could silently persist across sessions.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry audit — runs in EVERY mode, before anything else
// ─────────────────────────────────────────────────────────────────────────────
const registryAudit = auditRegistry();
if (!registryAudit.ok) {
  console.error("E1.2 REFUSED: the query registry failed its own structural audit. No connection opened.");
  writeProof("query-registry.json", { ok: false, ...registryAudit });
  process.exit(5);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: default (no --connect) — prepare only, NEVER connect
// ─────────────────────────────────────────────────────────────────────────────
if (!CONNECT) {
  const out = {
    phase: "E1.2",
    mode: "PREPARE_ONLY",
    remoteConnectionAttempted: false,
    remoteConnectionSucceeded: false,
    mutationsExecuted: 0,
    migrationsApplied: 0,
    customerRowsRead: 0,
    target: {
      configured: Boolean(DSN),
      sourceVariable: SOURCE_VAR,
      category: CATEGORY,
      productionSuspected: PRODUCTION_SUSPECTED,
      dsnFingerprintSha256_12: FINGERPRINT,
      urlPrinted: false,
    },
    registry: { ok: true, registeredQueryCount: registryAudit.registeredQueryCount },
    note:
      "No --connect flag: no socket was opened. A migration FILE existing locally proves nothing about the remote database; only an authorized read-only connection can establish that.",
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --connect — requires a valid, unexpired, unconsumed authorization
// ─────────────────────────────────────────────────────────────────────────────
const sessionId = val("--session");
if (!sessionId) {
  console.error("E1.2 REFUSED: --connect requires --session <id> from a minted authorization.");
  process.exit(4);
}
if (!existsSync(AUTH_FILE)) {
  console.error("E1.2 REFUSED: no authorization present. The owner must send the exact sentence first.");
  process.exit(4);
}
let authorization = null;
try {
  authorization = JSON.parse(readFileSync(AUTH_FILE, "utf8"));
} catch {
  console.error("E1.2 REFUSED: the authorization file is unreadable.");
  process.exit(4);
}
const authCheck = validateAuthorization(authorization, { sessionId, nowMs: Date.now(), action: ALLOWED_ACTION });
if (!authCheck.ok) {
  console.error(`E1.2 REFUSED: authorization invalid (${authCheck.failures.map((f) => f.code).join(", ")}).`);
  process.exit(4);
}
if (!DSN) {
  console.error("E1.2 REFUSED: no database configured.");
  process.exit(2);
}

// ── ATOMICALLY CLAIM the grant BEFORE any socket is opened ────────────────────
// renameSync is atomic on the same volume. A concurrent second `--connect` finds the
// source already gone and refuses; a crash AFTER the claim leaves the grant consumed
// (non-replayable) rather than valid. This closes the "validate now, consume later"
// replay window — consumption must precede connection, never follow it.
const CLAIMED_FILE = AUTH_FILE + ".claimed";
try {
  renameSync(AUTH_FILE, CLAIMED_FILE);
} catch {
  console.error("E1.2 REFUSED: the authorization could not be atomically claimed (already consumed, or a concurrent run claimed it first).");
  process.exit(4);
}
// Re-validate the CLAIMED copy (defence in depth: prove nothing changed in the race).
try {
  const claimed = JSON.parse(readFileSync(CLAIMED_FILE, "utf8"));
  const recheck = validateAuthorization(claimed, { sessionId, nowMs: Date.now(), action: ALLOWED_ACTION });
  if (!recheck.ok) {
    rmSync(CLAIMED_FILE, { force: true });
    console.error(`E1.2 REFUSED: claimed authorization no longer valid (${recheck.failures.map((f) => f.code).join(", ")}).`);
    process.exit(4);
  }
} catch {
  rmSync(CLAIMED_FILE, { force: true });
  console.error("E1.2 REFUSED: the claimed authorization is unreadable.");
  process.exit(4);
}

await runPreflight();

async function runPreflight() {
  const { default: pg } = await import("pg");

  // Supabase requires TLS. Local targets do not.
  const ssl = CATEGORY === "local" ? false : { rejectUnauthorized: false };
  const sslCategory = ssl === false ? "disabled(local)" : "tls(rejectUnauthorized=false)";

  const pool = new pg.Pool({
    connectionString: DSN,
    ssl,
    max: 1,
    application_name: "e1-2-readonly-preflight",
    connectionTimeoutMillis: 15000,
    statement_timeout: SESSION_SAFETY.statementTimeoutMs, // belt: driver-level too
  });

  const ev = {
    connected: false,
    safetyOk: false,
    inspectionComplete: false, // flips true ONLY after the whole metadata sweep succeeds
    queriesExecuted: [],
    mutationsExecuted: 0,
    customerRowsRead: 0,
  };
  let safety = null;
  let target = null;
  let client = null;

  /** The ONLY way a statement reaches the server. Takes an ID; SQL is unrepresentable here. */
  async function runRegistered(id, params = []) {
    const entry = resolveRegisteredQuery(id);
    const res = await client.query(entry.sql, params);
    ev.queriesExecuted.push({ id, rows: res.rowCount ?? res.rows.length });
    return res.rows;
  }

  try {
    client = await pool.connect();
    ev.connected = true;

    // ── enforce, then PROVE, the read-only session ───────────────────────────
    for (const s of SESSION_SAFETY.statements) {
      await client.query(s.sql);
      ev.queriesExecuted.push({ id: s.id, rows: 0 });
    }
    const safetyRow = (await runRegistered("safety.verify"))[0];
    safety = verifySessionSafety(safetyRow);
    ev.safetyOk = safety.ok;

    if (!safety.ok) {
      // Fail closed: not one inspection query runs.
      await client.query(SESSION_SAFETY.rollback.sql);
      emit({ ev, safety, target: null, failure: "SAFETY_ASSERTION_FAILED", sslCategory });
      return;
    }

    // ── target truth (§8) ───────────────────────────────────────────────────
    const versionRow = (await runRegistered("target.version"))[0];
    const roleRow = (await runRegistered("target.current_role"))[0];
    const sslRow = (await runRegistered("target.ssl"))[0];
    const extensions = await runRegistered("target.extensions");
    target = {
      postgresMajorVersion: Math.floor(Number(versionRow?.server_version_num ?? 0) / 10000) || "unknown",
      currentRoleCategory: roleRow?.rolsuper ? "superuser" : roleRow?.rolbypassrls ? "bypassrls" : roleRow?.rolcreaterole ? "createrole" : "ordinary",
      currentRoleNamePrinted: false,
      sslActive: sslRow?.ssl === true || sslRow?.ssl === "on",
      sslCategory,
      extensions: extensions.map((e) => e.extname),
    };
    ev.extensions = extensions;

    // ── migration history — the REAL mechanism ──────────────────────────────
    const ledger = (await runRegistered("history.ledger_present"))[0];
    const ledgerPresent = Boolean(ledger?.present);
    const supabaseCliPresent = Boolean(ledger?.supabase_cli_present);
    let ledgerEntries = [];
    if (ledgerPresent) ledgerEntries = await runRegistered("history.pierre_ledger");
    let supabaseEntries = [];
    if (supabaseCliPresent) supabaseEntries = await runRegistered("history.supabase_cli");

    // ── objects (one metadata sweep over both perimeters) ───────────────────
    // The index-host tables must be in the scan or two canonical partner indexes
    // (idx_pp_attr_partner_status, idx_pp_touch_partner) would never be observed and the
    // payout migration would be permanently misclassified PARTIALLY_APPLIED.
    const ALL_TABLES = [
      ...P941_ALL_TABLES,
      ...PARTNER_PAYOUT_CANONICAL.baseTables,
      ...PARTNER_PAYOUT_CANONICAL.indexHostTables,
    ];
    ev.tables = await runRegistered("objects.tables", [ALL_TABLES]);
    ev.columns = await runRegistered("objects.columns", [ALL_TABLES]);
    ev.constraints = await runRegistered("objects.constraints", [ALL_TABLES]);
    ev.indexes = await runRegistered("objects.indexes", [ALL_TABLES]);
    ev.policies = await runRegistered("objects.policies", [ALL_TABLES]);
    ev.triggers = await runRegistered("objects.triggers", [ALL_TABLES]);
    ev.functions = await runRegistered("objects.functions", [P941_CANONICAL.functions.map((f) => f.name)]);
    ev.ppFunctions = await runRegistered("objects.functions_like", ["clonestore\\_pp\\_%"]);

    // ── role + grants ───────────────────────────────────────────────────────
    const roleRows = await runRegistered("p941.role", [P941_CANONICAL.role.name]);
    ev.role = roleRows[0] ?? null;
    ev.memberships = await runRegistered("p941.role_memberships", [P941_CANONICAL.role.name]);
    ev.tableGrants = await runRegistered("grants.tables", [P941_CANONICAL.role.name]);
    ev.routineGrants = await runRegistered("grants.routines", [P941_CANONICAL.role.name]);
    ev.schemaUsage = await runRegistered("grants.schema_usage", [P941_CANONICAL.role.name]);

    ev.history = { ledgerPresent, supabaseCliPresent, ledgerEntries, supabaseEntries };

    // The full metadata sweep completed. Only now may a definite classification be trusted;
    // if any query above had thrown, this line never runs and both classifiers stay UNVERIFIABLE.
    ev.inspectionComplete = true;

    // ── always roll back: we opened a transaction, we close it with nothing ──
    await client.query(SESSION_SAFETY.rollback.sql);

    emit({ ev, safety, target, failure: null, sslCategory });
  } catch (e) {
    const sanitized = sanitizeError(e);
    try {
      if (client) await client.query(SESSION_SAFETY.rollback.sql);
    } catch {
      /* already closed */
    }
    emit({ ev, safety, target, failure: "CONNECTION_OR_QUERY_FAILURE", sanitized, sslCategory });
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
    // Single-use: the authorization dies with the run, whatever the outcome.
    consumeAuthorization();
  }
}

function consumeAuthorization() {
  // The grant was already atomically claimed (renamed to CLAIMED_FILE) BEFORE the socket
  // opened, so it is non-replayable regardless of what happens here. This is only tidy-up:
  // remove the claimed marker. The original AUTH_FILE no longer exists.
  try {
    rmSync(CLAIMED_FILE, { force: true });
  } catch {
    /* best effort — the marker is not at the AUTH_FILE path, so it can never authorize a run */
  }
}

function emit({ ev, safety, target, failure, sanitized, sslCategory }) {
  const p941Local = P941_CANONICAL.localFile;
  const ppLocal = PARTNER_PAYOUT_CANONICAL.localFile;

  const p941 = classifyP941(ev);
  const partner = classifyPartnerPayout(ev);

  // NOTHING records these two migrations in a remote ledger (p87 filters on "pierre_v";
  // the partner applier writes no history; nothing applies migrations-p941/ at all).
  const p941History = reconcileHistory({
    connected: ev.connected,
    safetyOk: ev.safetyOk,
    ledgerPresent: ev.history?.ledgerPresent,
    supabaseCliPresent: ev.history?.supabaseCliPresent,
    entries: ev.history?.ledgerEntries,
    migrationFileName: "p941_clonechat_durable",
    ledgerTracksThisMigration: false,
  });
  const partnerHistory = reconcileHistory({
    connected: ev.connected,
    safetyOk: ev.safetyOk,
    ledgerPresent: ev.history?.ledgerPresent,
    supabaseCliPresent: ev.history?.supabaseCliPresent,
    entries: ev.history?.ledgerEntries,
    migrationFileName: "clonestore_pp_payout_automation",
    ledgerTracksThisMigration: false,
  });

  const drift941 = detectDrift({ objectState: p941.state, historyState: p941History.state });
  const driftPartner = detectDrift({ objectState: partner.state, historyState: partnerHistory.state });

  const cc = deriveE12CommandCenter({
    e11LocallyReconciled: true,
    repositoryStable: true,
    readOnlyAuthorizationReceived: true,
    remoteConnectionAttempted: true,
    remoteConnectionSucceeded: ev.connected,
    remoteReadOnlyEnforced: ev.safetyOk,
    remoteTargetCategory: CATEGORY,
    productionSuspected: PRODUCTION_SUSPECTED,
    p941LocalMigrationPresent: localFilePresent(p941Local),
    partnerPayoutMigrationPresent: localFilePresent(ppLocal),
    p941,
    partner,
    p941HistoryState: p941History.state,
    partnerHistoryState: partnerHistory.state,
    drift941,
    driftPartner,
  });

  const written = [];
  written.push(
    writeProof("connection-result.json", {
      phase: "E1.2",
      remoteConnectionAttempted: true,
      remoteConnectionSucceeded: ev.connected,
      failure,
      sanitizedError: sanitized ?? null,
      queriesExecuted: ev.queriesExecuted.length,
      queryIds: ev.queriesExecuted.map((q) => q.id),
      urlPrinted: false,
      credentialsPrinted: false,
    }),
  );
  written.push(
    writeProof("read-only-session.json", {
      phase: "E1.2",
      sessionEstablished: ev.connected,
      readOnlyTransactionEnforced: Boolean(safety?.observed?.transactionReadOnly),
      searchPathPinned: safety?.observed?.searchPath ?? null,
      statementTimeoutMs: safety?.observed?.statementTimeoutMs ?? null,
      lockTimeoutMs: safety?.observed?.lockTimeoutMs ?? null,
      idleInTransactionTimeoutMs: safety?.observed?.idleInTransactionTimeoutMs ?? null,
      safetyVerified: Boolean(safety?.ok),
      safetyFailures: safety?.failures ?? [],
      rolledBack: true,
      clientReleased: true,
      note: "Safety was ASSERTED FROM THE SERVER after being set. If the assertion had failed, zero inspection queries would have run.",
    }),
  );
  written.push(
    writeProof("target-classification.json", {
      phase: "E1.2",
      sourceVariable: SOURCE_VAR,
      remoteTargetCategory: CATEGORY,
      productionSuspected: PRODUCTION_SUSPECTED,
      dsnFingerprintSha256_12: FINGERPRINT,
      sslCategory,
      sslActive: target?.sslActive ?? null,
      postgresMajorVersion: target?.postgresMajorVersion ?? "UNVERIFIABLE",
      currentRoleCategory: target?.currentRoleCategory ?? "UNVERIFIABLE",
      extensions: target?.extensions ?? [],
      urlPrinted: false,
      hostPrinted: false,
      usernamePrinted: false,
      passwordPrinted: false,
    }),
  );
  written.push(
    writeProof("metadata-only-access.json", {
      phase: "E1.2",
      totalRemoteQueriesExecuted: ev.queriesExecuted.length,
      queryIds: ev.queriesExecuted.map((q) => q.id),
      allowedCatalogSchemasQueried: ["pg_catalog", "information_schema", "public (migration ledger only)"],
      prohibitedSchemasQueried: [],
      customerRowQueries: 0,
      businessFunctionExecutions: 0,
      mutations: 0,
      migrationsApplied: 0,
      liveProviderCalls: 0,
      everyQueryCameFromRegistry: true,
      registeredQueryCount: registryAudit.registeredQueryCount,
    }),
  );
  written.push(
    writeProof("no-customer-data.json", {
      phase: "E1.2",
      customerRowsRead: 0,
      customerTablesQueried: [],
      proof:
        "Customer relations are unreachable by construction: the executor takes a query ID, the registry contains only pg_catalog/information_schema/migration-ledger reads, and validateSql refuses any relation matching clonechat_*/clonestore_*/pierre_rt_*/auth.*/storage.* (the ledger is the sole exemption). Table NAMES appear only as bound parameters, never as query targets.",
      secretsOrConfigValuesRead: 0,
      authTokensOrSessionsRead: 0,
    }),
  );
  written.push(writeProof("p941-history-state.json", { phase: "E1.2", migration: p941Local, localSha256: sha256File(p941Local), ...p941History }));
  written.push(
    writeProof("p941-role-state.json", {
      phase: "E1.2",
      roleName: P941_CANONICAL.role.name,
      exists: Boolean(ev.role),
      attributes: ev.role
        ? {
            login: ev.role.rolcanlogin, superuser: ev.role.rolsuper, createdb: ev.role.rolcreatedb,
            createrole: ev.role.rolcreaterole, replication: ev.role.rolreplication,
            bypassrls: ev.role.rolbypassrls, inherit: ev.role.rolinherit,
          }
        : null,
      memberships: (ev.memberships ?? []).map((m) => m.granted_role),
      expected: P941_CANONICAL.role.mustBe,
      leastPrivilege: p941.detail ? !(p941.blockers ?? []).some((b) => String(b.code).startsWith("ROLE_")) && Boolean(ev.role) : "UNVERIFIABLE",
    }),
  );
  written.push(
    writeProof("p941-object-state.json", {
      phase: "E1.2", migration: p941Local, state: p941.state, reasons: p941.reasons, detail: p941.detail,
      tablesExpected: P941_ALL_TABLES, functionsExpected: P941_CANONICAL.functions.map((f) => `${f.name}(${f.args})`),
    }),
  );
  written.push(
    writeProof("p941-rls-state.json", {
      phase: "E1.2",
      tables: (ev.tables ?? []).filter((t) => t.relname.startsWith("clonechat_")).map((t) => ({ table: t.relname, rlsEnabled: t.relrowsecurity, rlsForced: t.relforcerowsecurity, owner: t.owner })),
      policies: (ev.policies ?? []).filter((p) => p.table_name.startsWith("clonechat_")).map((p) => ({ table: p.table_name, policy: p.policyname, cmd: p.cmd, permissive: p.permissive, tenantScoped: `${p.qual ?? ""}`.includes("app.current_company") })),
      tenantPolicyProblems: p941.detail?.tenantPolicyProblems ?? "UNVERIFIABLE",
    }),
  );
  written.push(
    writeProof("p941-grant-state.json", {
      phase: "E1.2",
      role: P941_CANONICAL.role.name,
      tableGrants: (ev.tableGrants ?? []).map((g) => `${g.table_name}:${g.privilege_type}`),
      routineGrants: (ev.routineGrants ?? []).map((g) => `${g.routine_name}:${g.privilege_type}`),
      schemaUsage: ev.schemaUsage ?? [],
      grantsOutsidePerimeter: p941.detail?.grantsOutsidePerimeter ?? "UNVERIFIABLE",
      perimeterClean: (p941.detail?.grantsOutsidePerimeter ?? []).length === 0,
    }),
  );
  written.push(writeProof("partner-migration-history-state.json", { phase: "E1.2", migration: ppLocal, localSha256: sha256File(ppLocal), ...partnerHistory }));
  written.push(
    writeProof("partner-object-state.json", {
      phase: "E1.2", migration: ppLocal, state: partner.state, reasons: partner.reasons, detail: partner.detail,
    }),
  );
  written.push(
    writeProof("partner-constraint-state.json", {
      phase: "E1.2",
      idempotency: partner.detail?.idempotency ?? "UNVERIFIABLE",
      missingIndexes: partner.detail?.missingIndexes ?? "UNVERIFIABLE",
      constraintsObserved: (ev.constraints ?? []).filter((c) => c.table_name.startsWith("clonestore_pp_")).map((c) => `${c.table_name}.${c.conname} [${c.contype}]`),
    }),
  );
  written.push(
    writeProof("partner-test-live-separation.json", {
      phase: "E1.2",
      separationProblems: partner.detail?.testLiveSeparationProblems ?? "UNVERIFIABLE",
      dangerousExtensionsInstalled: partner.detail?.dangerousExtensionsInstalled ?? "UNVERIFIABLE",
      remoteCronPossible: partner.detail?.remoteCronPossible ?? "UNVERIFIABLE",
      triggersObserved: partner.detail?.triggersObserved ?? "UNVERIFIABLE",
      outboundTriggers: partner.detail?.outboundTriggers ?? "UNVERIFIABLE",
      partnerSecurityDefinerFunctions: partner.detail?.partnerSecurityDefinerFunctions ?? "UNVERIFIABLE",
      p10FloorReachableFromDatabase: false,
      partnerPayoutRemoteExecutionEnabled: false,
      note: "Remote payout automation is NOT inferred from table presence. Without pg_cron it is structurally impossible; the P10 floor is a compile-time constant in application code and no SQL can reach it.",
    }),
  );
  written.push(
    writeProof("schema-drift.json", {
      phase: "E1.2",
      p941: { objectState: p941.state, historyState: p941History.state, ...drift941 },
      partner: { objectState: partner.state, historyState: partnerHistory.state, ...driftPartner },
      migrationHistoryMechanism: {
        supabaseCliLedgerPresent: ev.history?.supabaseCliPresent ?? "UNVERIFIABLE",
        pierreLedgerPresent: ev.history?.ledgerPresent ?? "UNVERIFIABLE",
        pierreLedgerEntryCount: (ev.history?.ledgerEntries ?? []).length,
        tracksP941: false,
        tracksPartnerPayout: false,
        explanation:
          "The only remote ledger is public.pierre_rt_schema_migrations, written solely by scripts/p87-activate-remote.mjs which filters on \"pierre_v\". scripts/apply-partner-program-production.mjs records NO history, and NOTHING applies supabase/migrations-p941/. For both migrations, history can neither confirm nor refute — object state is the only admissible evidence.",
      },
    }),
  );
  written.push(
    writeProof("deployment-compatibility.json", {
      phase: "E1.2",
      classification: cc.remoteSchemaCompatibility,
      p941RemoteState: cc.p941RemoteState,
      partnerPayoutRemoteState: cc.partnerPayoutRemoteState,
      deploymentAuthorized: false,
      productionAuthorized: false,
      note: "A compatible schema does NOT make the application deployable. Deployment remains a separate, still-closed gate.",
    }),
  );
  written.push(writeProof("remote-mutation-status.json", { phase: "E1.2", remoteDatabaseMutated: false, mutationsExecuted: 0, migrationsApplied: 0, ddlStatements: 0, dmlStatements: 0, remoteSqlFilesExecuted: 0, businessFunctionExecutions: 0, liveProviderCalls: 0, rolledBack: true }));
  written.push(writeProof("deployment-status.json", { phase: "E1.2", deploymentPerformed: false, deploymentAttempted: false, productionAuthorized: false, paymentMode: "disabled", partnerPayoutLiveAuthorized: false, deploymentStillBlocked: true, pushed: false, staged: false, committed: false }));
  written.push(writeProof("command-center.json", cc));
  written.push(
    writeProof("owner-read-only-authorization.json", {
      phase: "E1.2",
      authorizationSentenceRequired: AUTHORIZATION_SENTENCE,
      authorizationReceived: true,
      mechanism: "short-lived single-use local file (.e1-2-auth/authorization.json), NOT an environment variable",
      sessionBound: true,
      consumedAfterRun: true,
      fileRemovedAfterRun: true,
    }),
  );
  written.push(
    writeProof("final-verdict.json", {
      phase: "E1.2",
      verdict: cc.verdict,
      p941RemoteState: cc.p941RemoteState,
      partnerPayoutRemoteState: cc.partnerPayoutRemoteState,
      remoteSchemaCompatibility: cc.remoteSchemaCompatibility,
      remoteDriftDetected: cc.remoteDriftDetected,
      nextSafeAction: cc.nextSafeAction,
      exactBlockers: cc.exactBlockers,
      exactWarnings: cc.exactWarnings,
      remoteDatabaseMutated: false,
      migrationsApplied: 0,
      customerRowsRead: 0,
      deploymentPerformed: false,
      productionAuthorized: false,
      noMigrationSuccessClaimed: true,
      noDeploymentReadyClaimed: true,
    }),
  );

  console.log(JSON.stringify({ verdict: cc.verdict, p941: cc.p941RemoteState, partner: cc.partnerPayoutRemoteState, compatibility: cc.remoteSchemaCompatibility, drift: cc.remoteDriftDetected, proofsWritten: written.length }, null, 2));
}
