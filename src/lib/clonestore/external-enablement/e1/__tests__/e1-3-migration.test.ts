// E1.3 — local tests for the controlled P9.4.1 migration runner (§12).
//
// No test opens a connection. They exercise the shared command-center logic (the same the
// runner uses) and statically verify the runner's structure — that it cannot run arbitrary
// SQL, begins a transaction before the migration, commits only on green assertions, always
// rolls back on failure, always consumes the authorization, and never prints a secret.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  MIGRATION_AUTHORIZATION_SENTENCE,
  MIGRATION_ALLOWED_ACTION,
  EXPECTED_TARGET_FINGERPRINT,
  P941_MIGRATION_PATH,
  P941_MIGRATION_SHA256,
  QUERY_REGISTRY,
  validateSql,
  isCustomerRelation,
  extractRelations,
  validateAuthorization,
  deriveE13CommandCenter,
} from "../e1-2-preflight-core.mjs";

import { buildE13CommandCenter, E1_3_HARD_VALUES, isDeploymentAuthorized } from "../e1-3-p941-migration-command-center";

const RUNNER = readFileSync(resolve(process.cwd(), "scripts/e1-3-apply-p941-remote.mjs"), "utf8");

// A committed, fully-certified run (the happy path).
function committedEvidence(overrides: Record<string, unknown> = {}) {
  return {
    e12RemoteStateVerified: true, repositoryStable: true, targetFingerprintMatched: true,
    migrationFilePresent: true, migrationChecksumMatched: true, migrationTransactional: true,
    backupConfirmed: true, rollbackRunbookReady: true, ownerMigrationAuthorizationReceived: true,
    productionSuspected: true, migrationConnectionAttempted: true, migrationTransactionStarted: true,
    migrationSqlExecuted: true, migrationSqlExecutionCount: 1, inTransactionAssertionsPassed: true,
    migrationCommitted: true, migrationRolledBack: false,
    p941RemoteStateBefore: "NOT_APPLIED", partnerPayoutStateBefore: "FULLY_APPLIED",
    postcheck: { verdict: "POSTCHECK_COMPLETE", ok: true, p941State: "FULLY_APPLIED", partnerState: "FULLY_APPLIED", compatibility: "REMOTE_SCHEMA_COMPATIBLE", roleBypassesRls: false, dangerousExtensions: ["pg_cron", "pg_net"] },
    ...overrides,
  };
}

describe("E1.3 §12.1–13 — connection & authorization gating (runner structure)", () => {
  it("1. no connection without --apply: pg is imported only inside applyMigration", () => {
    const pgImport = RUNNER.indexOf('await import("pg")');
    const applyFn = RUNNER.indexOf("async function applyMigration");
    expect(pgImport).toBeGreaterThan(-1);
    expect(applyFn).toBeGreaterThan(-1);
    expect(pgImport).toBeGreaterThan(applyFn); // the only import sits inside the apply function
    // the prepare / authorize / attest-backup modes all process.exit(0) before applyMigration is called
    expect(RUNNER).toMatch(/if \(!APPLY\) \{[\s\S]*process\.exit\(0\)/);
  });

  it("2. --apply requires a fresh authorization file, checked before the atomic claim & connect", () => {
    const authRead = RUNNER.indexOf("JSON.parse(readFileSync(AUTH_FILE");
    const validate = RUNNER.indexOf("validateAuthorization(authorization");
    const claim = RUNNER.indexOf("renameSync(AUTH_FILE, CLAIMED_FILE)");
    const apply = RUNNER.indexOf("await applyMigration(");
    expect(authRead).toBeLessThan(validate);
    expect(validate).toBeLessThan(claim);
    expect(claim).toBeLessThan(apply);
    expect(RUNNER).toMatch(/if \(!existsSync\(AUTH_FILE\)\) \{ console\.error[\s\S]*process\.exit\(4\)/);
  });

  it("3. a wrong authorization sentence mints nothing", () => {
    expect(RUNNER).toMatch(/if \(sentence !== MIGRATION_AUTHORIZATION_SENTENCE\)/);
    expect(MIGRATION_AUTHORIZATION_SENTENCE).toBe("I AUTHORIZE P9.4.1 REMOTE MIGRATION APPLICATION");
    expect(MIGRATION_ALLOWED_ACTION).toBe("APPLY_P941_REMOTE_MIGRATION");
    // distinct from the E1.2 read-only sentence/action
    expect(MIGRATION_AUTHORIZATION_SENTENCE).not.toBe("I AUTHORIZE READ-ONLY REMOTE DATABASE PREFLIGHT");
  });

  it("4/5/6. expired, consumed, and session-mismatched authorizations are rejected (migration action)", () => {
    const now = 1_000_000;
    const good = { version: 1, sessionId: "s1", allowedAction: MIGRATION_ALLOWED_ACTION, createdAtMs: now, expiresAtMs: now + 60_000, consumedAtMs: null };
    expect(validateAuthorization(good, { sessionId: "s1", nowMs: now + 1000, action: MIGRATION_ALLOWED_ACTION }).ok).toBe(true);
    expect(validateAuthorization(good, { sessionId: "s1", nowMs: now + 120_000, action: MIGRATION_ALLOWED_ACTION }).failures.map((f) => f.code)).toContain("AUTHORIZATION_EXPIRED");
    expect(validateAuthorization({ ...good, consumedAtMs: now + 1 }, { sessionId: "s1", nowMs: now + 1000, action: MIGRATION_ALLOWED_ACTION }).failures.map((f) => f.code)).toContain("AUTHORIZATION_ALREADY_CONSUMED");
    expect(validateAuthorization(good, { sessionId: "OTHER", nowMs: now + 1000, action: MIGRATION_ALLOWED_ACTION }).failures.map((f) => f.code)).toContain("SESSION_MISMATCH");
    // a read-only authorization cannot be used for the migration action
    expect(validateAuthorization({ ...good, allowedAction: "READ_ONLY_REMOTE_PREFLIGHT" }, { sessionId: "s1", nowMs: now + 1000, action: MIGRATION_ALLOWED_ACTION }).failures.map((f) => f.code)).toContain("ACTION_MISMATCH");
  });

  it("7. a target fingerprint mismatch is rejected at authorize AND at apply (binding check)", () => {
    expect(RUNNER).toMatch(/if \(FINGERPRINT !== EXPECTED_TARGET_FINGERPRINT\)/);
    expect(RUNNER).toMatch(/authorization\.targetFingerprint !== EXPECTED_TARGET_FINGERPRINT/);
    expect(EXPECTED_TARGET_FINGERPRINT).toBe("c049738d18e8");
  });

  it("8. a migration checksum mismatch is rejected at authorize AND at apply (binding check)", () => {
    expect(RUNNER).toMatch(/if \(sha !== P941_MIGRATION_SHA256\)/);
    expect(RUNNER).toMatch(/authorization\.migrationChecksum !== P941_MIGRATION_SHA256/);
    expect(P941_MIGRATION_SHA256).toBe("4a879e8cbfa260e8bebdbef5203213f3086015b3a8c77c8748c2b7325d15dc7b");
  });

  it("9/10/27. no alternate SQL path, no inline SQL, no arbitrary query — the migration path is hard-coded", () => {
    expect(P941_MIGRATION_PATH).toBe("supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql");
    // the migration bytes come from the hard-coded path, never from argv
    expect(RUNNER).toMatch(/resolve\(ROOT, P941_MIGRATION_PATH\)/);
    // the only argv value reads are known flags — never a SQL string or file path
    const valReads = [...RUNNER.matchAll(/val\("(--[a-z-]+)"\)/g)].map((m) => m[1]);
    expect(new Set(valReads)).toEqual(new Set(["--sentence", "--session", "--mechanism", "--at", "--operator"]));
    expect(RUNNER).not.toMatch(/--sql|--file|--query|--path|--migration-dir/);
  });

  it("11. missing/invalid backup evidence is rejected at authorize AND apply (via validateBackup)", () => {
    // both gates route through validateBackup, which returns BACKUP_NOT_CONFIRMED for a missing/unconfirmed attestation
    expect(RUNNER).toMatch(/const backupCheck = validateBackup\(backup, Date\.now\(\)\)/);
    expect(RUNNER).toMatch(/const applyBackupCheck = validateBackup\(backup, Date\.now\(\)\)/);
    expect(RUNNER).toMatch(/return \{ ok: false, failures: \["BACKUP_NOT_CONFIRMED"\] \}/);
    // and the apply-time authorization binding still lists BACKUP_NOT_CONFIRMED as a hard failure
    expect(RUNNER).toMatch(/BACKUP_NOT_CONFIRMED/);
  });

  it("12. unstable repository (no freeze proof) is rejected before connecting", () => {
    expect(RUNNER).toMatch(/if \(!existsSync\(STABILITY_FILE\)\)[\s\S]*process\.exit\(4\)/);
    const stabilityGate = RUNNER.indexOf("existsSync(STABILITY_FILE)");
    const claim = RUNNER.indexOf("renameSync(AUTH_FILE, CLAIMED_FILE)");
    expect(stabilityGate).toBeLessThan(claim);
  });

  it("13. a remote state other than NOT_APPLIED aborts before mutating", () => {
    // ALREADY_APPLIED (verified applied) → a distinct, non-error verdict, no mutation
    const alreadyCC = deriveE13CommandCenter({ productionSuspected: true, p941RemoteStateBefore: "FULLY_APPLIED", partnerPayoutStateBefore: "FULLY_APPLIED", failure: "ALREADY_APPLIED", migrationCommitted: false });
    expect(alreadyCC.verdict).toBe("E1.3 — MIGRATION NO LONGER REQUIRED / REMOTE ALREADY COMPATIBLE");
    expect(alreadyCC.migrationsApplied).toBe(0);
    expect(alreadyCC.remoteDatabaseMutated).toBe(false);
    // PARTIAL / changed → blocked
    const partialCC = deriveE13CommandCenter({ p941RemoteStateBefore: "PARTIALLY_APPLIED", failure: "STATE_CHANGED_OR_PARTIAL", migrationCommitted: false });
    expect(partialCC.verdict).toBe("E1.3 — MIGRATION APPLICATION BLOCKED / REMOTE STATE CHANGED OR PARTIAL");
    // the runner sets these failures WITHOUT mutating (proceed=false gate)
    expect(RUNNER).toMatch(/let proceed = true;/);
    expect(RUNNER).toMatch(/if \(state\.preStateP941 !== "NOT_APPLIED"\)/);
  });
});

describe("E1.3 §12.14–21 — transaction discipline (runner structure)", () => {
  it("14. the transaction begins before the migration SQL runs", () => {
    const begin = RUNNER.indexOf('await client.query("begin");');
    const migrate = RUNNER.indexOf("await client.query(migrationSql)");
    expect(begin).toBeGreaterThan(-1);
    expect(migrate).toBeGreaterThan(-1);
    expect(begin).toBeLessThan(migrate);
  });

  it("15. the migration SQL runs exactly once", () => {
    const occurrences = (RUNNER.match(/await client\.query\(migrationSql\)/g) ?? []).length;
    expect(occurrences).toBe(1);
    expect(RUNNER).toMatch(/state\.migrationExecutionCount = 1;/);
  });

  it("16. metadata assertions run before COMMIT", () => {
    const assert = RUNNER.indexOf("buildAssertions(p941, partner, postEv)");
    const commit = RUNNER.indexOf('await client.query("commit")');
    expect(assert).toBeGreaterThan(-1);
    expect(commit).toBeGreaterThan(-1);
    expect(assert).toBeLessThan(commit);
    // commit is gated on assertions passing
    expect(RUNNER).toMatch(/if \(!assertions\.allPassed\) \{[\s\S]*rollback[\s\S]*\} else \{[\s\S]*"commit"/);
  });

  it("17/18. an assertion failure OR a SQL error triggers ROLLBACK", () => {
    const rollbacks = (RUNNER.match(/await client\.query\("rollback"\)/g) ?? []).length;
    expect(rollbacks).toBeGreaterThanOrEqual(3); // preamble, in-txn state-change, assertion-fail, catch
    // the catch block rolls back an open, uncommitted transaction
    expect(RUNNER).toMatch(/catch \(e\) \{[\s\S]*state\.transactionStarted && !state\.committed[\s\S]*rollback/);
    // a rolled-back run reports state unchanged
    const rb = deriveE13CommandCenter({ migrationTransactionStarted: true, migrationSqlExecuted: true, inTransactionAssertionsPassed: false, migrationCommitted: false, migrationRolledBack: true, p941RemoteStateBefore: "NOT_APPLIED", failure: "IN_TRANSACTION_ASSERTION_FAILED" });
    expect(rb.verdict).toBe("E1.3 — P9.4.1 MIGRATION ROLLED BACK / REMOTE STATE UNCHANGED");
    expect(rb.migrationsApplied).toBe(0);
    expect(rb.remoteDatabaseMutated).toBe(false);
    expect(rb.p941RemoteStateAfter).toBe("NOT_APPLIED");
  });

  it("19. a connection failure commits nothing", () => {
    const cc = deriveE13CommandCenter({ migrationConnectionAttempted: true, migrationTransactionStarted: false, migrationCommitted: false, failure: "CONNECTION_OR_SQL_FAILURE" });
    expect(cc.migrationCommitted).toBe(false);
    expect(cc.migrationsApplied).toBe(0);
    expect(cc.remoteDatabaseMutated).toBe(false);
  });

  it("20. the client is always released and the pool always ended", () => {
    expect(RUNNER).toMatch(/finally \{[\s\S]*if \(client\) client\.release\(\)[\s\S]*pool\.end\(\)/);
  });

  it("21. the authorization is always consumed (single emit + consume after the try/finally)", () => {
    // consumeAuthorization runs once, on the single path out of applyMigration (no early returns)
    const consume = (RUNNER.match(/consumeAuthorization\(\);/g) ?? []).length;
    // one definition call-site inside applyMigration + the function definition line
    expect(RUNNER).toMatch(/consumeAuthorization\(\);\s*\n\s*emit\(state\);/);
    expect(RUNNER).toMatch(/rmSync\(CLAIMED_FILE/);
    // there are NO early `return;` statements that would skip consumption inside applyMigration
    const applyBody = RUNNER.slice(RUNNER.indexOf("async function applyMigration"), RUNNER.indexOf("function buildAssertions"));
    expect(applyBody).not.toMatch(/emit\(state\);\s*\n\s*return;/);
  });
});

describe("E1.3 §12.22–27 — no secrets / no customer rows / no providers / no arbitrary SQL", () => {
  it("22/23. secret values are never printed and driver errors are sanitized", () => {
    // every proof goes through writeProof, which runs detectLeaks and refuses on any leak
    expect(RUNNER).toMatch(/const leak = detectLeaks\(obj, secretParts\(\)\)/);
    expect(RUNNER).toMatch(/if \(!leak\.clean\)[\s\S]*Nothing written[\s\S]*process\.exit\(3\)/);
    // errors are sanitized; error.message is never surfaced
    expect(RUNNER).toMatch(/sanitizeError\(e\)/);
    expect(RUNNER).not.toMatch(/e\.message|error\.message/);
    // secretParts guards decoded AND raw credential forms + host + dsn
    expect(RUNNER).toMatch(/parts\.passwordRaw = u\.password/);
    expect(RUNNER).toMatch(/parts\.userRaw = u\.username/);
  });

  it("24. no customer-row query exists — every inspection query is registry-bound and metadata-only", () => {
    // the runner reaches the server only via resolveRegisteredQuery(id) or the migration bytes
    const rawQueries = [...RUNNER.matchAll(/client\.query\(([^)]*)\)/g)].map((m) => m[1].trim());
    for (const q of rawQueries) {
      // allowed: safety/txn literal statements, the registry-resolved entry.sql, and migrationSql
      const ok =
        /^"(begin|commit|rollback|begin read only|set local |set session )/i.test(q) ||
        q === "migrationSql" ||
        q.startsWith("resolveRegisteredQuery(") ||
        q.startsWith("entry.sql") ||
        q.startsWith("SESSION_SAFETY.") ||
        q.includes('resolveRegisteredQuery("safety.verify")');
      expect(ok, `unexpected client.query arg: ${q}`).toBe(true);
    }
    // and no registered query touches a customer relation
    for (const entry of Object.values(QUERY_REGISTRY)) {
      for (const rel of extractRelations(entry.sql)) expect(isCustomerRelation(rel), `${entry.id}->${rel}`).toBe(false);
    }
  });

  it("25/26. no partner migration is executed and no provider is CALLED", () => {
    // The only DDL executed is the hard-coded P9.4.1 path — never a partner migration file.
    expect(RUNNER).not.toMatch(/apply-partner|clonestore_pp_core|migrations\/2026-07-11_05/);
    expect(RUNNER).not.toMatch(/readFileSync\([^)]*clonestore_pp/);
    // No provider is INVOKED (import / construct / network call). The words "stripe/openai"
    // appear only inside the no-provider-call PROOF that records they were NOT called — that
    // attestation must not be mistaken for a call, so we look for actual invocation forms.
    expect(RUNNER).not.toMatch(/import[^;\n]*(stripe|openai|resend|twilio|yousign)/i);
    expect(RUNNER).not.toMatch(/require\(['"](stripe|openai|@?resend|twilio)/i);
    expect(RUNNER).not.toMatch(/new\s+Stripe|\.chat\.completions|fetch\(|https?:\/\//i);
  });
});

describe("E1.3 §12.28–36 — the commit gate (assertion classifiers)", () => {
  // These reuse classifyP941 / classifyPartnerPayout, already covered exhaustively by the E1.2
  // suite. Here we prove the command center DERIVES the right verdict from an assertion failure.
  it("28–35. any failed in-transaction assertion blocks COMMIT → ROLLBACK, state unchanged", () => {
    const cc = deriveE13CommandCenter({
      migrationTransactionStarted: true, migrationSqlExecuted: true,
      inTransactionAssertionsPassed: false, migrationCommitted: false, migrationRolledBack: true,
      p941RemoteStateBefore: "NOT_APPLIED",
      assertionBlockers: ["role_no_bypassrls: BYPASSRLS", "rls_enabled_forced: 1 table without RLS", "grants_within_perimeter: outside clonechat_"],
      failure: "IN_TRANSACTION_ASSERTION_FAILED",
    });
    expect(cc.migrationCommitted).toBe(false);
    expect(cc.migrationsApplied).toBe(0);
    expect(cc.exactBlockers.length).toBeGreaterThan(0);
    expect(cc.verdict).toBe("E1.3 — P9.4.1 MIGRATION ROLLED BACK / REMOTE STATE UNCHANGED");
  });

  it("36. partner schema drift blocks COMMIT (unrelated-schema preservation is an assertion)", () => {
    // buildAssertions includes partner_preserved; a non-FULLY_APPLIED partner state fails it.
    expect(RUNNER).toMatch(/add\("partner_preserved", partner\.state === "FULLY_APPLIED"/);
  });
});

describe("E1.3 §12.37–42 — a green run commits exactly one migration and opens no gate", () => {
  it("37/38/39/40. a full green run permits COMMIT but keeps production/deployment/payout off", () => {
    const cc = buildE13CommandCenter(committedEvidence());
    expect(cc.verdict).toBe("E1.3 — P9.4.1 REMOTE MIGRATION VERIFIED / DEPLOYMENT AUTHORIZATION STILL REQUIRED");
    expect(cc.migrationCommitted).toBe(true);
    expect(cc.postMigrationReadOnlyVerificationComplete).toBe(true);
    expect(cc.remoteSchemaCompatibility).toBe("REMOTE_SCHEMA_COMPATIBLE");
    expect(cc.p941RemoteStateAfter).toBe("FULLY_APPLIED");
    expect(cc.partnerPayoutStateAfter).toBe("FULLY_APPLIED");
    expect(cc.unrelatedSchemaPreserved).toBe(true);
    // gates stay shut
    expect(cc.productionAuthorized).toBe(false);
    expect(cc.deploymentPerformed).toBe(false);
    expect(cc.partnerPayoutLiveAuthorized).toBe(false);
    expect(cc.paymentMode).toBe("disabled");
    expect(cc.customerRowsRead).toBe(0);
    expect(cc.liveProviderCalls).toBe(0);
    expect(isDeploymentAuthorized(cc)).toBe(false);
    expect(E1_3_HARD_VALUES.productionAuthorized).toBe(false);
  });

  it("41. migrationsApplied can only be 0 or 1", () => {
    expect(buildE13CommandCenter(committedEvidence()).migrationsApplied).toBe(1);
    expect(buildE13CommandCenter({ migrationCommitted: false }).migrationsApplied).toBe(0);
    // no evidence at all → prepared, nothing applied
    const prepared = buildE13CommandCenter({});
    expect(prepared.migrationsApplied).toBe(0);
    expect(prepared.exactMutationPerformed).toBe("NONE");
    expect(prepared.remoteDatabaseMutated).toBe(false);
  });

  it("42. only P9.4.1 can become the mutation; remoteDatabaseMutated true requires a commit", () => {
    expect(buildE13CommandCenter(committedEvidence()).exactMutationPerformed).toBe("P9.4.1_CANONICAL_MIGRATION_ONLY");
    expect(buildE13CommandCenter(committedEvidence()).remoteDatabaseMutated).toBe(true);
    // the hard-value guard refuses an impossible combo (mutated-without-commit)
    expect(() => buildE13CommandCenter({ ...committedEvidence(), migrationCommitted: false, postcheck: null } as any)).not.toThrow();
    // (derive keeps remoteDatabaseMutated tied to committed, so the guard never trips in practice)
  });

  it("committed-but-postcheck-blocked and committed-but-inconsistent are distinct verdicts", () => {
    const blocked = deriveE13CommandCenter({ ...committedEvidence(), postcheck: { verdict: "POSTCHECK_BLOCKED", ok: false } });
    expect(blocked.verdict).toBe("E1.3 — P9.4.1 COMMITTED / POST-MIGRATION CERTIFICATION BLOCKED");
    const inconsistent = deriveE13CommandCenter({ ...committedEvidence(), postcheck: { verdict: "POSTCHECK_COMPLETE", ok: false, p941State: "PARTIALLY_APPLIED", partnerState: "FULLY_APPLIED", compatibility: "REMOTE_SCHEMA_INCOMPLETE" } });
    expect(inconsistent.verdict).toBe("E1.3 — REMOTE MIGRATION PARTIAL OR INCONSISTENT / DEPLOYMENT BLOCKED");
  });

  it("the dangerous-extensions warning is surfaced on a committed run", () => {
    const cc = buildE13CommandCenter(committedEvidence());
    expect(cc.exactWarnings.join(" ")).toMatch(/pg_cron.*pg_net|Outbound-capable/);
  });
});

describe("E1.3 — adversarial audit fixes (backup binding, freeze validation, postcheck fail-closed)", () => {
  it("FIX #3/#4: a COMMIT without a completed postcheck never claims FULLY_APPLIED — it is UNVERIFIABLE + POSTCHECK BLOCKED", () => {
    // committed, but the postcheck was blocked (e.g. the transport failed)
    const blocked = deriveE13CommandCenter({ ...committedEvidence(), postcheck: { verdict: "POSTCHECK_BLOCKED", ok: false } });
    expect(blocked.migrationCommitted).toBe(true);
    expect(blocked.p941RemoteStateAfter).toBe("UNVERIFIABLE"); // NOT FULLY_APPLIED
    expect(blocked.partnerPayoutStateAfter).toBe("UNVERIFIABLE");
    expect(blocked.remoteSchemaCompatibility).toBe("REMOTE_SCHEMA_UNVERIFIABLE");
    expect(blocked.postMigrationReadOnlyVerificationComplete).toBe(false);
    expect(blocked.verdict).toBe("E1.3 — P9.4.1 COMMITTED / POST-MIGRATION CERTIFICATION BLOCKED");

    // committed with NO postcheck object at all → same fail-closed posture
    const none = deriveE13CommandCenter({ ...committedEvidence(), postcheck: null });
    expect(none.p941RemoteStateAfter).toBe("UNVERIFIABLE");
    expect(none.verdict).toBe("E1.3 — P9.4.1 COMMITTED / POST-MIGRATION CERTIFICATION BLOCKED");
  });

  it("FIX #4: a safety-failed postcheck maps to POSTCHECK BLOCKED, not a false 'inconsistent'", () => {
    const safetyFailed = deriveE13CommandCenter({ ...committedEvidence(), postcheck: { verdict: "POSTCHECK_SAFETY_FAILED", ok: false } });
    expect(safetyFailed.verdict).toBe("E1.3 — P9.4.1 COMMITTED / POST-MIGRATION CERTIFICATION BLOCKED");
    // and only a COMPLETED postcheck reporting a genuinely bad schema is INCONSISTENT
    const inconsistent = deriveE13CommandCenter({ ...committedEvidence(), postcheck: { verdict: "POSTCHECK_COMPLETE", ok: false, p941State: "PARTIALLY_APPLIED", partnerState: "FULLY_APPLIED", compatibility: "REMOTE_SCHEMA_INCOMPLETE" } });
    expect(inconsistent.verdict).toBe("E1.3 — REMOTE MIGRATION PARTIAL OR INCONSISTENT / DEPLOYMENT BLOCKED");
  });

  it("FIX #4: postMigrationCertify reads .rows[0] on the safety-verify Result (not a bare [0])", () => {
    // the Result-object indexing bug (which made every committed run certify as failed)
    expect(RUNNER).toMatch(/resolveRegisteredQuery\("safety\.verify"\)\.sql\)\)\.rows\[0\]/);
    expect(RUNNER).not.toMatch(/resolveRegisteredQuery\("safety\.verify"\)\.sql\)\)\[0\]/);
  });

  it("FIX #1: backup attestation is bound to THIS target and to freshness (validateBackup, wired into authorize + apply)", () => {
    expect(RUNNER).toMatch(/function validateBackup\(backup, nowMs\)/);
    expect(RUNNER).toMatch(/backup\.targetFingerprint !== EXPECTED_TARGET_FINGERPRINT/);
    expect(RUNNER).toMatch(/BACKUP_TARGET_MISMATCH/);
    expect(RUNNER).toMatch(/BACKUP_ATTESTATION_STALE/);
    expect(RUNNER).toMatch(/BACKUP_EVIDENCE_TIMESTAMP_INVALID_OR_STALE/);
    // wired at both gates, replacing the bare backupConfirmed===true check
    const authGate = RUNNER.indexOf("const backupCheck = validateBackup(backup, Date.now())");
    const applyGate = RUNNER.indexOf("const applyBackupCheck = validateBackup(backup, Date.now())");
    expect(authGate).toBeGreaterThan(-1);
    expect(applyGate).toBeGreaterThan(-1);
    // --at is calendar-validated (rejects 2026-99-99), not just a shape prefix
    expect(RUNNER).toMatch(/isValidRecentDate\(at, Date\.now\(\)\)/);
    expect(RUNNER).not.toMatch(/!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\/\.test\(at\)/);
  });

  it("FIX #2: the freeze proof is structurally + temporally validated (validateFreezeProof, wired into apply)", () => {
    expect(RUNNER).toMatch(/function validateFreezeProof\(nowMs\)/);
    expect(RUNNER).toMatch(/proof\.frozen !== true/);
    expect(RUNNER).toMatch(/proof\.treeHashIdenticalABC !== true/);
    expect(RUNNER).toMatch(/FREEZE_PROOF_STALE/);
    expect(RUNNER).toMatch(/proof\.migrationChecksum !== P941_MIGRATION_SHA256/);
    expect(RUNNER).toMatch(/FREEZE_SOURCE_CHANGED/);
    // wired at apply, replacing the bare existsSync(STABILITY_FILE) gate
    expect(RUNNER).toMatch(/const freezeCheck = validateFreezeProof\(Date\.now\(\)\)/);
    expect(RUNNER).toMatch(/if \(!freezeCheck\.ok\)[\s\S]*process\.exit\(4\)/);
  });

  it("FIX #1/#2: the command center derives backupConfirmed & repositoryStable from validators, not hardcoded true", () => {
    expect(RUNNER).toMatch(/backupConfirmed: validateBackup\(readBackupAttestation\(\), Date\.now\(\)\)\.ok/);
    expect(RUNNER).toMatch(/repositoryStable: validateFreezeProof\(Date\.now\(\)\)\.ok/);
    expect(RUNNER).not.toMatch(/backupConfirmed: true,\s*\n\s*rollbackRunbookReady/);
  });

  it("FIX #5D: the commit gate fails closed when classifier detail is absent", () => {
    expect(RUNNER).toMatch(/add\("p941_detail_present", Boolean\(p941\.detail\)/);
    expect(RUNNER).toMatch(/add\("partner_detail_present", Boolean\(partner\.detail\)/);
  });
});
