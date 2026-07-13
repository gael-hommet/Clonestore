#!/usr/bin/env node
// scripts/e1-3-apply-p941-remote.mjs
//
// E1.3 — CONTROLLED single-use application of the canonical P9.4.1 CloneChat durable
// migration to the previously-verified managed Supabase remote. THE ONLY mutation this
// tool can perform is executing the EXACT bytes of the one hard-coded migration file,
// and only inside a transaction that commits solely if every role/table/function/RLS/
// grant assertion passes.
//
// It cannot run arbitrary SQL: every inspection statement comes from the shared E1.2
// registry (query ID, never SQL), and the single DDL payload is the checksum-verified
// canonical file — no other path, glob, inline SQL, or table name is accepted.
//
// Modes (all default to NO connection / NO mutation / NO authorization):
//   node scripts/e1-3-apply-p941-remote.mjs
//       → prepare-only readiness report. No connection.
//   node scripts/e1-3-apply-p941-remote.mjs --attest-backup --mechanism <cat> --at <iso> --operator <cat>
//       → record the owner's backup attestation (category + timestamp only). No connection.
//   node scripts/e1-3-apply-p941-remote.mjs --authorize --sentence "<exact sentence>"
//       → mint a short-lived, single-use migration authorization (requires backup attestation). No connection.
//   node scripts/e1-3-apply-p941-remote.mjs --apply --session <id>
//       → THE mutation: claim auth atomically, reconfirm target + NOT_APPLIED, BEGIN, apply the
//         canonical file, assert, COMMIT-or-ROLLBACK, then run a read-only post-migration certification.

import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";

import {
  MIGRATION_AUTHORIZATION_SENTENCE,
  MIGRATION_ALLOWED_ACTION,
  EXPECTED_TARGET_FINGERPRINT,
  P941_MIGRATION_PATH,
  P941_MIGRATION_SHA256,
  P941_CANONICAL,
  P941_ALL_TABLES,
  PARTNER_PAYOUT_CANONICAL,
  SESSION_SAFETY,
  QUERY_REGISTRY,
  auditRegistry,
  resolveRegisteredQuery,
  verifySessionSafety,
  detectLeaks,
  sanitizeError,
  classifyTarget,
  isProductionSuspected,
  validateAuthorization,
  classifyP941,
  classifyPartnerPayout,
  evaluateCompatibility,
  deriveE13CommandCenter,
} from "../src/lib/clonestore/external-enablement/e1/e1-2-preflight-core.mjs";

const ROOT = process.cwd();
const PROOF_DIR = resolve(ROOT, ".e1-3-proofs", "p941-remote-migration");
const AUTH_DIR = resolve(ROOT, ".e1-3-auth");
const AUTH_FILE = resolve(AUTH_DIR, "authorization.json");
const CLAIMED_FILE = AUTH_FILE + ".claimed";
const BACKUP_DIR = resolve(ROOT, ".e1-3-backup");
const BACKUP_FILE = resolve(BACKUP_DIR, "attestation.json");
const STABILITY_FILE = resolve(PROOF_DIR, "repository-freeze.json"); // written by the E1.3 freeze step

const MIGRATION_TTL_MS = 15 * 60 * 1000;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};

const APPLY = has("--apply");
const AUTHORIZE = has("--authorize");
const ATTEST_BACKUP = has("--attest-backup");

// ── target resolution — value read, never printed ────────────────────────────
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
const FINGERPRINT = DSN ? createHash("sha256").update(DSN).digest("hex").slice(0, 12) : null;

function secretParts() {
  const parts = { dsn: DSN || undefined };
  try {
    const u = new URL(DSN);
    parts.host = u.hostname || undefined;
    parts.user = decodeURIComponent(u.username || "") || undefined;
    parts.password = decodeURIComponent(u.password || "") || undefined;
    parts.userRaw = u.username || undefined;
    parts.passwordRaw = u.password || undefined;
    parts.database = (u.pathname || "").replace(/^\//, "") || undefined;
  } catch {
    /* unparseable → DSN still guarded */
  }
  return parts;
}

function writeProof(name, obj) {
  mkdirSync(PROOF_DIR, { recursive: true });
  const leak = detectLeaks(obj, secretParts());
  if (!leak.clean) {
    console.error(`E1.3 REFUSED: a secret would have leaked into ${name} (${leak.found.map((f) => f.id).join(", ")}). Nothing written.`);
    process.exit(3);
  }
  writeFileSync(resolve(PROOF_DIR, name), JSON.stringify(obj, null, 2) + "\n");
  return name;
}

// ── the canonical artifact — read + checksum ─────────────────────────────────
function migrationBytesAndSha() {
  const p = resolve(ROOT, P941_MIGRATION_PATH);
  if (!existsSync(p)) return { present: false, sha: null, bytes: null };
  const bytes = readFileSync(p);
  return { present: true, sha: createHash("sha256").update(bytes).digest("hex"), bytes };
}

function readBackupAttestation() {
  if (!existsSync(BACKUP_FILE)) return null;
  try {
    return JSON.parse(readFileSync(BACKUP_FILE, "utf8"));
  } catch {
    return null;
  }
}

const MAX_BACKUP_AGE_MS = 24 * 60 * 60 * 1000; // the attestation must be recent, not a leftover
const MAX_EVIDENCE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // the backup itself no older than a week

/** A backup attestation only counts if it is confirmed, bound to THIS target, and fresh. */
function validateBackup(backup, nowMs) {
  const failures = [];
  if (!backup || backup.backupConfirmed !== true) return { ok: false, failures: ["BACKUP_NOT_CONFIRMED"] };
  // Target binding: an attestation recorded against another database must not authorize this one.
  if (backup.targetFingerprint !== EXPECTED_TARGET_FINGERPRINT) failures.push("BACKUP_TARGET_MISMATCH");
  if (FINGERPRINT !== EXPECTED_TARGET_FINGERPRINT) failures.push("LIVE_TARGET_MISMATCH");
  // Freshness of the attestation record.
  if (typeof backup.recordedAtMs !== "number" || nowMs - backup.recordedAtMs > MAX_BACKUP_AGE_MS || backup.recordedAtMs > nowMs + 60_000) failures.push("BACKUP_ATTESTATION_STALE");
  // The evidence timestamp must be a real calendar date, not in the future, not ancient.
  const t = Date.parse(String(backup.evidenceTimestamp ?? ""));
  if (Number.isNaN(t) || t > nowMs + 60_000 || nowMs - t > MAX_EVIDENCE_AGE_MS) failures.push("BACKUP_EVIDENCE_TIMESTAMP_INVALID_OR_STALE");
  return { ok: failures.length === 0, failures };
}

/** A well-formed ISO calendar date (rejects 2026-99-99), not in the future, not ancient. */
function isValidRecentDate(s, nowMs) {
  if (!/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(String(s))) return false;
  const t = Date.parse(String(s));
  if (Number.isNaN(t)) return false;
  // round-trip the Y-M-D so 2026-99-99 (which Date.parse may coerce) is rejected
  const d = new Date(t);
  const [y, m, day] = String(s).slice(0, 10).split("-").map(Number);
  if (d.getUTCFullYear() !== y || d.getUTCMonth() + 1 !== m || d.getUTCDate() !== day) return false;
  return t <= nowMs + 60_000 && nowMs - t <= MAX_EVIDENCE_AGE_MS;
}

/** The repository-freeze proof must be structurally valid, recent, and still match the current source. */
function validateFreezeProof(nowMs) {
  if (!existsSync(STABILITY_FILE)) return { ok: false, failures: ["FREEZE_PROOF_ABSENT"] };
  let proof = null;
  try { proof = JSON.parse(readFileSync(STABILITY_FILE, "utf8")); } catch { return { ok: false, failures: ["FREEZE_PROOF_UNREADABLE"] }; }
  const failures = [];
  if (proof.frozen !== true) failures.push("FREEZE_NOT_FROZEN");
  if (proof.treeHashIdenticalABC !== true) failures.push("FREEZE_TREE_HASH_DIVERGED");
  if (proof.contentHashIdenticalABC !== true) failures.push("FREEZE_CONTENT_HASH_DIVERGED");
  if (typeof proof.recordedAtMs !== "number" || nowMs - proof.recordedAtMs > MAX_BACKUP_AGE_MS || proof.recordedAtMs > nowMs + 60_000) failures.push("FREEZE_PROOF_STALE");
  if (proof.migrationChecksum !== P941_MIGRATION_SHA256) failures.push("FREEZE_MIGRATION_CHECKSUM_MISMATCH");
  // Re-hash the relevant source files and compare to the frozen record: nothing load-bearing
  // may have changed after the freeze window.
  const sourceHashes = proof.sourceHashes ?? {};
  const relevant = [
    "scripts/e1-3-apply-p941-remote.mjs",
    "src/lib/clonestore/external-enablement/e1/e1-2-preflight-core.mjs",
    "src/lib/clonestore/external-enablement/e1/e1-3-p941-migration-command-center.ts",
    P941_MIGRATION_PATH,
  ];
  for (const rel of relevant) {
    const p = resolve(ROOT, rel);
    const now = existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : null;
    if (!sourceHashes[rel]) failures.push(`FREEZE_MISSING_SOURCE_HASH:${rel}`);
    else if (sourceHashes[rel] !== now) failures.push(`FREEZE_SOURCE_CHANGED:${rel}`);
  }
  return { ok: failures.length === 0, failures, proof };
}

// ─────────────────────────────────────────────────────────────────────────────
// registry audit — every mode
// ─────────────────────────────────────────────────────────────────────────────
const registryAudit = auditRegistry();
if (!registryAudit.ok) {
  console.error("E1.3 REFUSED: the query registry failed its own structural audit. No connection.");
  process.exit(5);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --attest-backup  (no connection)
// ─────────────────────────────────────────────────────────────────────────────
if (ATTEST_BACKUP) {
  const mechanism = val("--mechanism"); // e.g. supabase_pitr | supabase_daily_backup | operator_snapshot
  const at = val("--at"); // ISO timestamp of the backup / recovery point
  const operator = val("--operator") || "owner";
  const allowed = ["supabase_pitr", "supabase_daily_backup", "operator_snapshot", "managed_backup"];
  if (!mechanism || !allowed.includes(mechanism)) {
    console.error(`E1.3 REFUSED: --attest-backup requires --mechanism one of ${allowed.join("|")}.`);
    process.exit(4);
  }
  if (!at || !isValidRecentDate(at, Date.now())) {
    console.error("E1.3 REFUSED: --attest-backup requires --at <real ISO date within the last week, not in the future>.");
    process.exit(4);
  }
  if (FINGERPRINT !== EXPECTED_TARGET_FINGERPRINT) {
    console.error("E1.3 REFUSED: the configured target is not the E1.2-verified target; refusing to record a backup attestation against it.");
    process.exit(4);
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const attestation = {
    version: 1,
    backupConfirmed: true,
    mechanismCategory: mechanism,
    evidenceTimestamp: at,
    operatorCategory: operator,
    recordedAtMs: Date.now(),
    targetFingerprint: FINGERPRINT, // ties the attestation to THIS target
    note: "Owner attestation of backup/recovery readiness. No project id, URL, or credential is stored.",
  };
  writeFileSync(BACKUP_FILE, JSON.stringify(attestation, null, 2) + "\n");
  console.log(JSON.stringify({ backupAttestationRecorded: true, mechanismCategory: mechanism, evidenceTimestamp: at, storedIn: ".e1-3-backup/attestation.json" }, null, 2));
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --authorize  (no connection)
// ─────────────────────────────────────────────────────────────────────────────
if (AUTHORIZE) {
  const sentence = val("--sentence");
  if (sentence !== MIGRATION_AUTHORIZATION_SENTENCE) {
    console.error("E1.3 REFUSED: the migration authorization sentence does not match exactly. Nothing minted.");
    process.exit(4);
  }
  const { present, sha } = migrationBytesAndSha();
  if (!present) {
    console.error("E1.3 REFUSED: the canonical migration file is missing.");
    process.exit(4);
  }
  if (sha !== P941_MIGRATION_SHA256) {
    console.error("E1.3 REFUSED: the canonical migration checksum does not match the audited value. Nothing minted.");
    process.exit(4);
  }
  const backup = readBackupAttestation();
  const backupCheck = validateBackup(backup, Date.now());
  if (!backupCheck.ok) {
    console.error(`E1.3 REFUSED: backup attestation invalid (${backupCheck.failures.join(", ")}). Run --attest-backup for THIS target first.`);
    process.exit(4);
  }
  if (FINGERPRINT !== EXPECTED_TARGET_FINGERPRINT) {
    console.error("E1.3 REFUSED: the configured target fingerprint does not match the E1.2-verified target. Nothing minted.");
    process.exit(4);
  }
  const sessionId = randomUUID();
  const now = Date.now();
  const authorization = {
    version: 1,
    sessionId,
    allowedAction: MIGRATION_ALLOWED_ACTION,
    createdAtMs: now,
    expiresAtMs: now + MIGRATION_TTL_MS,
    consumedAtMs: null,
    targetFingerprint: EXPECTED_TARGET_FINGERPRINT,
    migrationChecksum: P941_MIGRATION_SHA256,
    backupConfirmed: true,
    sentenceSha256: createHash("sha256").update(sentence).digest("hex"),
  };
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(AUTH_FILE, JSON.stringify(authorization, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        migrationAuthorizationMinted: true,
        sessionId,
        allowedAction: MIGRATION_ALLOWED_ACTION,
        boundToFingerprint: EXPECTED_TARGET_FINGERPRINT,
        boundToChecksum: P941_MIGRATION_SHA256.slice(0, 12) + "…",
        backupConfirmed: true,
        expiresInMinutes: Math.round(MIGRATION_TTL_MS / 60000),
        singleUse: true,
        storedIn: ".e1-3-auth/authorization.json",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: default (no --apply) — prepare only, NEVER connect
// ─────────────────────────────────────────────────────────────────────────────
if (!APPLY) {
  const { present, sha } = migrationBytesAndSha();
  const backup = readBackupAttestation();
  console.log(
    JSON.stringify(
      {
        phase: "E1.3",
        mode: "PREPARE_ONLY",
        remoteConnectionAttempted: false,
        migrationsApplied: 0,
        target: { configured: Boolean(DSN), sourceVariable: SOURCE_VAR, category: CATEGORY, productionSuspected: PRODUCTION_SUSPECTED, fingerprintMatchesE12: FINGERPRINT === EXPECTED_TARGET_FINGERPRINT, dsnFingerprintSha256_12: FINGERPRINT },
        migration: { path: P941_MIGRATION_PATH, present, checksumMatches: sha === P941_MIGRATION_SHA256 },
        backupConfirmed: Boolean(backup && backup.backupConfirmed),
        registry: { ok: true, count: registryAudit.registeredQueryCount },
        note: "No --apply: no socket opened. Applying requires --attest-backup, then --authorize with the exact sentence, then --apply --session <id>.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --apply — the single controlled mutation
// ─────────────────────────────────────────────────────────────────────────────
const sessionId = val("--session");
if (!sessionId) { console.error("E1.3 REFUSED: --apply requires --session <id>."); process.exit(4); }
if (!existsSync(AUTH_FILE)) { console.error("E1.3 REFUSED: no migration authorization present."); process.exit(4); }

let authorization = null;
try { authorization = JSON.parse(readFileSync(AUTH_FILE, "utf8")); }
catch { console.error("E1.3 REFUSED: authorization unreadable."); process.exit(4); }

// generic checks (session/action/expiry/consumed) + E1.3 bindings
const authCheck = validateAuthorization(authorization, { sessionId, nowMs: Date.now(), action: MIGRATION_ALLOWED_ACTION });
const bindingFailures = [];
if (authorization.targetFingerprint !== EXPECTED_TARGET_FINGERPRINT) bindingFailures.push("FINGERPRINT_BINDING_MISMATCH");
if (authorization.migrationChecksum !== P941_MIGRATION_SHA256) bindingFailures.push("CHECKSUM_BINDING_MISMATCH");
if (authorization.backupConfirmed !== true) bindingFailures.push("BACKUP_NOT_CONFIRMED");
if (!authCheck.ok || bindingFailures.length) {
  console.error(`E1.3 REFUSED: authorization invalid (${[...authCheck.failures.map((f) => f.code), ...bindingFailures].join(", ")}).`);
  process.exit(4);
}
if (!DSN) { console.error("E1.3 REFUSED: no database configured."); process.exit(2); }
if (FINGERPRINT !== EXPECTED_TARGET_FINGERPRINT) { console.error("E1.3 REFUSED: live target fingerprint differs from the verified target."); process.exit(4); }

const { present, sha, bytes } = migrationBytesAndSha();
if (!present || sha !== P941_MIGRATION_SHA256) { console.error("E1.3 REFUSED: migration file missing or checksum drifted at apply time."); process.exit(4); }
const backup = readBackupAttestation();
const applyBackupCheck = validateBackup(backup, Date.now());
if (!applyBackupCheck.ok) { console.error(`E1.3 REFUSED: backup attestation invalid at apply time (${applyBackupCheck.failures.join(", ")}).`); process.exit(4); }

// Repository-stability evidence: the freeze proof must be structurally valid, recent, and still
// match the current source — not merely present. A forged/stale proof, or any edit to the
// runner/core/command-center/migration after the freeze, is rejected.
const freezeCheck = validateFreezeProof(Date.now());
if (!freezeCheck.ok) {
  console.error(`E1.3 REFUSED: repository-freeze proof invalid (${freezeCheck.failures.join(", ")}). Re-run the clean freeze.`);
  process.exit(4);
}

// ── ATOMICALLY CLAIM before any socket ───────────────────────────────────────
try { renameSync(AUTH_FILE, CLAIMED_FILE); }
catch { console.error("E1.3 REFUSED: authorization could not be atomically claimed (already consumed / concurrent run)."); process.exit(4); }

await applyMigration(bytes.toString("utf8"));

async function applyMigration(migrationSql) {
  const { default: pg } = await import("pg");
  const ssl = CATEGORY === "local" ? false : { rejectUnauthorized: false };

  // Mutation-session pool: TLS, ONE client, explicit name, short connect timeout.
  const pool = new pg.Pool({
    connectionString: DSN, ssl, max: 1,
    application_name: "e1-3-p941-migration",
    connectionTimeoutMillis: 15000,
    statement_timeout: 60000, // migration may create many objects
  });

  const state = {
    connected: false,
    fingerprintConfirmed: FINGERPRINT === EXPECTED_TARGET_FINGERPRINT,
    preStateP941: null, preStatePartner: null,
    transactionStarted: false,
    migrationExecuted: false, migrationExecutionCount: 0,
    assertions: null, assertionsPassed: false,
    committed: false, rolledBack: false,
    postcheck: null,
    sanitized: null,
    failure: null,
  };
  let client = null;

  async function runReg(id, params = [], c = client) {
    const entry = resolveRegisteredQuery(id);
    const res = await c.query(entry.sql, params);
    return res.rows;
  }

  // Build a full metadata evidence object from a client (used for pre-state + in-txn assert).
  async function sweep(c) {
    const ALL = [...P941_ALL_TABLES, ...PARTNER_PAYOUT_CANONICAL.baseTables, ...PARTNER_PAYOUT_CANONICAL.indexHostTables];
    const ev = { connected: true, safetyOk: true, inspectionComplete: false };
    ev.extensions = await runReg("target.extensions", [], c);
    ev.tables = await runReg("objects.tables", [ALL], c);
    ev.columns = await runReg("objects.columns", [ALL], c);
    ev.constraints = await runReg("objects.constraints", [ALL], c);
    ev.indexes = await runReg("objects.indexes", [ALL], c);
    ev.policies = await runReg("objects.policies", [ALL], c);
    ev.triggers = await runReg("objects.triggers", [ALL], c);
    ev.functions = await runReg("objects.functions", [P941_CANONICAL.functions.map((f) => f.name)], c);
    ev.ppFunctions = await runReg("objects.functions_like", ["clonestore\\_pp\\_%"], c);
    ev.role = (await runReg("p941.role", [P941_CANONICAL.role.name], c))[0] ?? null;
    ev.memberships = await runReg("p941.role_memberships", [P941_CANONICAL.role.name], c);
    ev.tableGrants = await runReg("grants.tables", [P941_CANONICAL.role.name], c);
    ev.routineGrants = await runReg("grants.routines", [P941_CANONICAL.role.name], c);
    ev.schemaUsage = await runReg("grants.schema_usage", [P941_CANONICAL.role.name], c);
    ev.inspectionComplete = true;
    return ev;
  }

  try {
    client = await pool.connect();
    state.connected = true;

    // ── (a) read-only pre-mutation reconfirmation (own read-only txn) ─────────
    await client.query("begin read only");
    await client.query("set local statement_timeout = 5000");
    await client.query("set local search_path = pg_catalog, information_schema");
    const preEv = await sweep(client);
    state.preStateP941 = classifyP941(preEv).state;
    state.preStatePartner = classifyPartnerPayout(preEv).state;
    await client.query("rollback");

    // Abort BEFORE mutating if the remote is not exactly the verified starting state.
    // No early return — set the failure and skip the mutation so the single emit +
    // authorization consumption at the bottom always runs.
    let proceed = true;
    if (state.preStateP941 !== "NOT_APPLIED") {
      state.failure = state.preStateP941 === "FULLY_APPLIED" ? "ALREADY_APPLIED" : "STATE_CHANGED_OR_PARTIAL";
      proceed = false;
    } else if (state.preStatePartner !== "FULLY_APPLIED") {
      state.failure = "PARTNER_STATE_UNEXPECTED";
      proceed = false;
    }

    if (proceed) {
      // ── (b) the mutation transaction (READ-WRITE) ──────────────────────────
      await client.query("begin");
      state.transactionStarted = true;
      await client.query("set local lock_timeout = 5000");
      await client.query("set local statement_timeout = 60000");
      await client.query("set local idle_in_transaction_session_timeout = 30000");
      await client.query("set local search_path = public"); // new objects must land in public

      // in-txn recheck via the registry (belt): still absent?
      const pre = (await runReg("precheck.p941_absent"))[0];
      if (pre?.any_table === true || pre?.role_exists === true) {
        await client.query("rollback");
        state.rolledBack = true;
        state.failure = "STATE_CHANGED_INSIDE_TXN";
      } else {
        // ── THE single permitted mutation: the exact canonical file bytes ────
        await client.query(migrationSql);
        state.migrationExecuted = true;
        state.migrationExecutionCount = 1;

        // ── in-transaction assertions (the commit gate) ──────────────────────
        const postEv = await sweep(client);
        const p941 = classifyP941(postEv);
        const partner = classifyPartnerPayout(postEv);
        const assertions = buildAssertions(p941, partner, postEv);
        state.assertions = assertions;
        state.assertionsPassed = assertions.allPassed;

        if (!assertions.allPassed) {
          await client.query("rollback");
          state.rolledBack = true;
          state.failure = "IN_TRANSACTION_ASSERTION_FAILED";
        } else {
          await client.query("commit");
          state.committed = true;
        }
      }
    }
  } catch (e) {
    state.sanitized = sanitizeError(e);
    state.failure = state.failure ?? "CONNECTION_OR_SQL_FAILURE";
    try { if (client && state.transactionStarted && !state.committed) await client.query("rollback"); } catch { /* */ }
    try { if (client && !state.transactionStarted) { /* nothing to roll back */ } } catch { /* */ }
    if (state.transactionStarted && !state.committed) state.rolledBack = true;
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }

  // ── (c) post-COMMIT read-only certification (fresh connection) ────────────
  if (state.committed) {
    try {
      state.postcheck = await postMigrationCertify(pg, ssl);
    } catch (e) {
      state.postcheck = { ok: false, transportError: sanitizeError(e), verdict: "POSTCHECK_BLOCKED" };
    }
  }

  // single-use: consume regardless of outcome
  consumeAuthorization();
  emit(state);
}

function buildAssertions(p941, partner, ev) {
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });

  // A/B/C/D/E via the classifier (the same logic tests exercise).
  // Absence of evidence FAILS CLOSED: the classifier must have returned FULLY_APPLIED (which
  // itself requires connected+safetyOk+inspectionComplete + full positive evidence), and the
  // detail object must be present for the granular checks to mean anything.
  add("p941_fully_applied", p941.state === "FULLY_APPLIED", `state=${p941.state}`);
  add("p941_detail_present", Boolean(p941.detail), "classifier detail present");
  add("partner_detail_present", Boolean(partner.detail), "partner detail present");
  add("no_p941_blockers", Array.isArray(p941.blockers) && p941.blockers.length === 0, `${(p941.blockers ?? [null]).length} blocker(s)`);
  const d = p941.detail ?? {};
  add("role_exists", d.roleExists === true, "clonechat_app present");
  add("role_least_privilege", ev.role && !ev.role.rolcanlogin && !ev.role.rolsuper && !ev.role.rolcreatedb && !ev.role.rolcreaterole && !ev.role.rolreplication, "NOLOGIN/no elevated attrs");
  add("role_no_bypassrls", ev.role && ev.role.rolbypassrls === false, "NOBYPASSRLS");
  add("ten_tables", (d.missingTables ?? P941_ALL_TABLES).length === 0, `${(d.missingTables ?? []).length} missing`);
  add("no_object_gaps", (d.objectGaps ?? []).length === 0, `${(d.objectGaps ?? []).length} gap(s)`);
  add("command_fingerprint_unique", !(d.objectGaps ?? []).some((g) => g.table === "clonechat_commands" && g.column === "fingerprint"), "exactly-once identity");
  add("three_functions", (d.missingFunctions ?? P941_CANONICAL.functions.map((f) => f.name)).length === 0, `${(d.missingFunctions ?? []).length} missing`);
  add("no_security_definer", (d.securityDefinerFunctions ?? []).length === 0, `${(d.securityDefinerFunctions ?? []).length} SECDEF`);
  add("rls_enabled_forced", (d.rlsMissing ?? []).length === 0 && (d.rlsNotForced ?? []).length === 0, "RLS enabled+forced");
  add("tenant_policies_scoped", (d.tenantPolicyProblems ?? []).length === 0, `${(d.tenantPolicyProblems ?? []).length} policy problem(s)`);
  add("grants_within_perimeter", (d.grantsOutsidePerimeter ?? []).length === 0 && (d.tablesWithoutGrant ?? []).length === 0, "clonechat_* only");

  // F — unrelated schema preserved
  add("partner_preserved", partner.state === "FULLY_APPLIED", `partner=${partner.state}`);

  return { checks, allPassed: checks.every((c) => c.pass) };
}

async function postMigrationCertify(pg, ssl) {
  const pool = new pg.Pool({ connectionString: DSN, ssl, max: 1, application_name: "e1-3-postcheck-readonly", connectionTimeoutMillis: 15000, statement_timeout: SESSION_SAFETY.statementTimeoutMs });
  let c = null;
  try {
    c = await pool.connect();
    for (const s of SESSION_SAFETY.statements) await c.query(s.sql);
    // node-postgres returns a Result object; the rows live on .rows (Result is NOT array-indexed).
    const safetyRow = (await c.query(resolveRegisteredQuery("safety.verify").sql)).rows[0];
    const safety = verifySessionSafety(safetyRow);
    if (!safety.ok) { await c.query("rollback"); return { ok: false, verdict: "POSTCHECK_SAFETY_FAILED", safety }; }

    const ALL = [...P941_ALL_TABLES, ...PARTNER_PAYOUT_CANONICAL.baseTables, ...PARTNER_PAYOUT_CANONICAL.indexHostTables];
    const ev = { connected: true, safetyOk: true, inspectionComplete: false };
    const q = async (id, p = []) => (await c.query(resolveRegisteredQuery(id).sql, p)).rows;
    ev.extensions = await q("target.extensions");
    ev.tables = await q("objects.tables", [ALL]);
    ev.columns = await q("objects.columns", [ALL]);
    ev.constraints = await q("objects.constraints", [ALL]);
    ev.indexes = await q("objects.indexes", [ALL]);
    ev.policies = await q("objects.policies", [ALL]);
    ev.triggers = await q("objects.triggers", [ALL]);
    ev.functions = await q("objects.functions", [P941_CANONICAL.functions.map((f) => f.name)]);
    ev.ppFunctions = await q("objects.functions_like", ["clonestore\\_pp\\_%"]);
    ev.role = (await q("p941.role", [P941_CANONICAL.role.name]))[0] ?? null;
    ev.memberships = await q("p941.role_memberships", [P941_CANONICAL.role.name]);
    ev.tableGrants = await q("grants.tables", [P941_CANONICAL.role.name]);
    ev.routineGrants = await q("grants.routines", [P941_CANONICAL.role.name]);
    ev.schemaUsage = await q("grants.schema_usage", [P941_CANONICAL.role.name]);
    ev.inspectionComplete = true;
    await c.query("rollback");

    const p941 = classifyP941(ev);
    const partner = classifyPartnerPayout(ev);
    const compatibility = evaluateCompatibility({ p941, partner, connected: true, safetyOk: true });
    return {
      ok: p941.state === "FULLY_APPLIED" && partner.state === "FULLY_APPLIED" && compatibility === "REMOTE_SCHEMA_COMPATIBLE",
      verdict: "POSTCHECK_COMPLETE",
      p941State: p941.state, partnerState: partner.state, compatibility,
      roleBypassesRls: ev.role ? ev.role.rolbypassrls : null,
      p941Detail: p941.detail, partnerDetail: partner.detail,
      dangerousExtensions: (partner.detail?.dangerousExtensionsInstalled ?? []),
    };
  } finally {
    if (c) c.release();
    await pool.end().catch(() => {});
  }
}

function consumeAuthorization() {
  try { rmSync(CLAIMED_FILE, { force: true }); } catch { /* not at AUTH_FILE path — cannot authorize a run */ }
}

function emit(state) {
  const committed = state.committed === true;

  const cc = deriveE13CommandCenter({
    e12RemoteStateVerified: true,
    repositoryStable: validateFreezeProof(Date.now()).ok, // derived, not asserted
    targetFingerprintMatched: state.fingerprintConfirmed,
    migrationFilePresent: true,
    migrationChecksumMatched: migrationBytesAndSha().sha === P941_MIGRATION_SHA256,
    migrationTransactional: true,
    backupConfirmed: validateBackup(readBackupAttestation(), Date.now()).ok, // derived, not asserted
    rollbackRunbookReady: existsSync(resolve(ROOT, "E1_3_P941_ROLLBACK_AND_RECOVERY_RUNBOOK.md")),
    ownerMigrationAuthorizationReceived: true,
    productionSuspected: PRODUCTION_SUSPECTED,
    migrationConnectionAttempted: true,
    migrationTransactionStarted: state.transactionStarted,
    migrationSqlExecuted: state.migrationExecuted,
    migrationSqlExecutionCount: state.migrationExecutionCount,
    inTransactionAssertionsPassed: state.assertionsPassed,
    migrationCommitted: committed,
    migrationRolledBack: state.rolledBack === true,
    p941RemoteStateBefore: state.preStateP941 ?? "UNVERIFIABLE",
    partnerPayoutStateBefore: state.preStatePartner ?? "UNVERIFIABLE",
    postcheck: state.postcheck,
    failure: state.failure,
    assertionBlockers: state.assertions && !state.assertionsPassed ? state.assertions.checks.filter((c) => !c.pass).map((c) => `${c.id}: ${c.detail}`) : [],
  });
  const verdict = cc.verdict;
  const nextSafeAction = cc.nextSafeAction;
  const p941After = cc.p941RemoteStateAfter;
  const partnerAfter = cc.partnerPayoutStateAfter;
  const postOk = cc.clonechatDurableTablesReady;
  const compatibility = cc.remoteSchemaCompatibility;

  const written = [];
  written.push(writeProof("migration-connection.json", { phase: "E1.3", connected: state.connected, fingerprintConfirmed: state.fingerprintConfirmed, sanitizedError: state.sanitized, failure: state.failure, urlPrinted: false }));
  written.push(writeProof("transaction-start.json", { phase: "E1.3", preStateP941: state.preStateP941, preStatePartner: state.preStatePartner, transactionStarted: state.transactionStarted, mutationSearchPath: "public" }));
  written.push(writeProof("migration-execution.json", { phase: "E1.3", migrationPath: P941_MIGRATION_PATH, migrationChecksum: P941_MIGRATION_SHA256, executed: state.migrationExecuted, executionCount: state.migrationExecutionCount, executedExactCanonicalBytes: true, arbitrarySqlAccepted: false }));
  const ck = (title, ids) => ({ phase: "E1.3", title, checks: (state.assertions?.checks ?? []).filter((c) => ids.some((p) => c.id.startsWith(p))), allPassed: state.assertionsPassed });
  written.push(writeProof("in-transaction-role-check.json", ck("role", ["role_"])));
  written.push(writeProof("in-transaction-object-check.json", ck("objects", ["ten_tables", "no_object_gaps", "command_fingerprint"])));
  written.push(writeProof("in-transaction-rls-check.json", ck("rls", ["rls_", "tenant_policies"])));
  written.push(writeProof("in-transaction-function-check.json", ck("functions", ["three_functions", "no_security_definer"])));
  written.push(writeProof("in-transaction-grant-check.json", ck("grants", ["grants_"])));
  written.push(writeProof("unrelated-schema-check.json", { phase: "E1.3", partnerPreserved: partnerAfter === "FULLY_APPLIED", partnerStateBefore: state.preStatePartner, partnerStateAfter: partnerAfter }));
  written.push(writeProof("transaction-result.json", { phase: "E1.3", committed, rolledBack: state.rolledBack === true, migrationsApplied: committed ? 1 : 0, assertionsPassed: state.assertionsPassed, failure: state.failure }));
  written.push(writeProof("authorization-consumption.json", { phase: "E1.3", consumed: true, fileRemoved: !existsSync(CLAIMED_FILE), sessionBound: true, singleUse: true, action: MIGRATION_ALLOWED_ACTION }));
  if (committed) {
    written.push(writeProof("post-migration-read-only-session.json", { phase: "E1.3", ran: Boolean(state.postcheck), verdict: state.postcheck?.verdict, safetyOk: state.postcheck?.verdict !== "POSTCHECK_SAFETY_FAILED", readOnly: true }));
    written.push(writeProof("p941-post-state.json", { phase: "E1.3", state: p941After, roleBypassesRls: state.postcheck?.roleBypassesRls ?? null, detail: state.postcheck?.p941Detail ?? null }));
    written.push(writeProof("partner-post-state.json", { phase: "E1.3", state: partnerAfter, detail: state.postcheck?.partnerDetail ?? null }));
    written.push(writeProof("remote-schema-compatibility.json", { phase: "E1.3", compatibility, postcheckOk: postOk }));
  }
  written.push(writeProof("no-customer-data.json", { phase: "E1.3", customerRowsRead: 0, customerTablesQueried: [], proof: "Only pg_catalog/information_schema metadata + the checksum-verified canonical DDL. No SELECT of any clonechat_*/clonestore_*/pierre_rt_*/auth.* row." }));
  written.push(writeProof("no-provider-call.json", { phase: "E1.3", liveProviderCalls: 0, stripe: 0, openai: 0, email: 0, voice: 0, signature: 0, telephony: 0 }));
  written.push(writeProof("deployment-status.json", { phase: "E1.3", deploymentPerformed: false, productionAuthorized: false, paymentMode: "disabled", partnerPayoutLiveAuthorized: false, pushed: false, staged: false, committed: false }));
  written.push(writeProof("command-center.json", cc));
  written.push(writeProof("final-verdict.json", {
    phase: "E1.3", verdict, nextSafeAction,
    migrationsApplied: cc.migrationsApplied, exactMutationPerformed: cc.exactMutationPerformed,
    remoteDatabaseMutated: cc.remoteDatabaseMutated,
    p941RemoteStateBefore: cc.p941RemoteStateBefore, p941RemoteStateAfter: cc.p941RemoteStateAfter,
    partnerPayoutStateAfter: cc.partnerPayoutStateAfter, remoteSchemaCompatibility: cc.remoteSchemaCompatibility,
    customerRowsRead: 0, liveProviderCalls: 0, productionAuthorized: false, deploymentPerformed: false,
  }));

  console.log(JSON.stringify({ verdict, migrationsApplied: cc.migrationsApplied, committed, p941After, partnerAfter, compatibility, postcheck: state.postcheck?.verdict ?? "n/a", proofsWritten: written.length }, null, 2));
}
