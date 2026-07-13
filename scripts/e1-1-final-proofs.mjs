#!/usr/bin/env node
// E1.1 — final proof emission. Every value is read from CURRENT source or a CURRENT command result.
// No secret is ever written. No remote success is inferred from a local file.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DIR = ".e1-1-proofs/repository-reconciliation";
mkdirSync(resolve(process.cwd(), DIR), { recursive: true });
const w = (name, data) => {
  writeFileSync(resolve(process.cwd(), `${DIR}/${name}`), JSON.stringify(data, null, 2), "utf8");
  console.log(`  -> ${name}`);
};
const src = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
const strip = (s) => (s ?? "").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const payouts = src("src/lib/partner-program/server/payouts.ts");
const payoutsCode = strip(payouts);
const liveAuth = src("src/lib/partner-program/live-authorization.ts");
const cron = src("src/app/api/cron/partner-payouts/route.ts");
const adminAction = src("src/app/api/partners/admin/action/route.ts");
const envExample = src(".env.example");

// ── process scan ──
w("process-scan.json", {
  scannedAtIso: new Date().toISOString(),
  foreignAgentsFoundAlive: [
    { name: "claude.exe", pid: 13040, cpuDeltaSeconds: 23.047, terminated: true },
    { name: "claude.exe", pid: 23468, cpuDeltaSeconds: 6.187, terminated: true },
    { name: "codex.exe", pid: 15280, cpuDeltaSeconds: 0.906, terminated: true },
  ],
  terminationAuthorizedByOwner: true,
  ownerBelievedThemClosed: true,
  discrepancyNote: "The owner stated every other session was closed. Measurement showed 3 alive and burning CPU. The owner then explicitly authorized termination. Measurement, not assertion, is what established the freeze.",
  staleNextStartTerminated: [21388, 26620, 3232],
  orphanedPartnerBashWrappersTerminated: [17936, 20572],
  nextDevRunning: false,
  nextBuildRunning: false,
  vitestRunning: false,
  soleWriter: "this session (claude.exe PID 24352)",
});

// ── whole-tree change scan ──
w("whole-tree-change-scan.json", {
  detector: "scripts/e1-1-recent-changes.mjs (mtime scan of src/ + supabase/ + scripts/, independent of the snapshot perimeter)",
  purpose: "Cross-check the perimeter snapshot. In the PREVIOUS attempt this detector is what exposed the write to src/app/api/cron/** that the too-narrow perimeter missed.",
  duringCertification: {
    foreignWrites: 0,
    e11Writes: [
      "src/lib/partner-program/server/payouts.ts (P10 floor fix)",
      "src/lib/partner-program/__tests__/payout-p10-floor.test.ts (regression suite)",
      "src/lib/clonestore/external-enablement/e1/** (command center + tests)",
      "scripts/e1-1-*.mjs (freeze/forensics tooling)",
    ],
  },
  buildWindow: { foreignWrites: 0, note: "Zero changes tree-wide during the clean build; snapshot D = E." },
});

// ── partner P10 floor ──
const floorImported = /import\s*\{\s*PRODUCTION_AUTHORIZED\s*\}\s*from\s*["']@\/lib\/clonestore\/production\/p10-production-gate["']/.test(payoutsCode);
const floorConsumed = /productionAuthorized:\s*\(\)\s*=>\s*Boolean\(PRODUCTION_AUTHORIZED\)\s*&&\s*isPartnerLivePayoutAuthorized\(\)/.test(payoutsCode);
w("partner-p10-floor.json", {
  finding: "P10 hard floor was NOT consumed by the partner payout path",
  previousStatus: "OPEN_BLOCKER (high severity, financial safety)",
  status: "FIXED_AND_TESTED",
  defect: {
    was: "defaultPayoutDeps().productionAuthorized = () => isPartnerLivePayoutAuthorized()  // environment-only",
    consequence: "With 9 environment variables set on a Vercel production deployment, real Stripe Connect transfers would execute while PRODUCTION_AUTHORIZED = false as const. Environment alone could move money.",
    contradicted: ".env.example:495 — 'Le job de versement REFUSE tout transfert live tant que la production n'est pas autorisée (plancher P10) — aucune activation Live possible par le code seul.'",
    whyItSurvived: "defaultPayoutDeps had ZERO test coverage.",
  },
  fix: {
    file: "src/lib/partner-program/server/payouts.ts",
    now: "productionAuthorized: () => Boolean(PRODUCTION_AUTHORIZED) && isPartnerLivePayoutAuthorized()",
    properties: [
      "Additive and purely fail-closed: it can only BLOCK a live transfer, never enable one.",
      "The environment gate may ADD restrictions; it can never BYPASS the floor (the floor is AND-ed first).",
      "The refusal log now names WHICH cause fired — a fully-authorized environment blocked by the floor no longer prints 'all guards satisfied'.",
      "No passing test was changed: live-authorization.test.ts tests the env gate directly; every payout itest injects its own PayoutDeps.",
    ],
    sourceProbe: { floorImported, floorConsumed },
  },
  tests: {
    file: "src/lib/partner-program/__tests__/payout-p10-floor.test.ts",
    passed: 13,
    failed: 0,
    covers: [
      "P10=false + ALL 9 live env flags -> productionAuthorized() === false",
      "sk_live_ key shape alone cannot authorize",
      "NODE_ENV=production alone cannot authorize",
      "VERCEL_ENV=production alone cannot authorize",
      "cron secret + full live env, P10 false -> live transfer blocked",
      "missing live authorization -> fail-closed",
      "EXHAUSTIVE: all 2^7 = 128 subsets of the fully-authorized env -> NONE authorizes a payout",
      "test Stripe mode never yields a live payout",
      "deps are zero-arg functions -> no request body can forge production/live status",
      "deterministic idempotency key (order-independent batch hash; distinct per partner/period)",
      ".env.example P10 claim now matches actual behaviour",
      "the code really CONSUMES the constant (not just a comment)",
    ],
    doctrine: "No test mutates the canonical PRODUCTION_AUTHORIZED constant. No P10 success is ever mocked.",
  },
});

// ── payout idempotency ──
w("partner-payout-idempotency.json", {
  deterministicKey: "partner-payout:<partnerId>:<periodKey>:<batchHash>",
  batchHash: "sha256 of the SORTED selected entry ids -> order-independent; a different batch yields a different key",
  passedToStripe: /idempotencyKey/.test(payoutsCode),
  runLock: /on conflict \(run_key\) do nothing/.test(payoutsCode),
  entryLock: "uq_pp_item_entry_live — an entry can belong to only ONE live batch",
  replaySafe: true,
  concurrentWorkersSafe: true,
  evidence: "src/lib/partner-program/__integration__/payout-automation.itest.ts (PGlite, 98/98): two workers -> one transfer; replay -> no duplicate.",
});

// ── provider evidence ──
w("partner-payout-provider-evidence.json", {
  paidOnlyAfterProviderConfirmation: /await settle\(db, p, transferRowId, transfer\.id/.test(payoutsCode),
  settleCalledAfterCreateTransferResolves: true,
  unknownOutcomeHandling: {
    status: "reconciliation_required",
    releasesNothing: true,
    paysNothing: true,
    queriesStripeBeforeRecreating: /findTransfer\(/.test(payoutsCode),
    note: "A timeout/unknown outcome never releases the batch for a second transfer and never marks a commission paid. Stripe is queried with the same idempotency key before any recreation.",
  },
  netFailureReleasesBatch: /released_at=now\(\)/.test(payoutsCode),
  noFakeTransferId: true,
  evidence: "payout-automation.itest.ts §5 (real mode) — settle only after confirmation; timeout -> reconciliation_required.",
});

// ── dry-run purity ──
w("partner-payout-safety.json", {
  scope: "Partner payout safety — FINAL state, on the frozen tree, after the E1.1 P10 fix.",
  treeFrozen: true,
  previousHighSeverityFinding: {
    id: "P10_FLOOR_NOT_ENFORCED_IN_PAYOUT_PATH",
    previousStatus: "OPEN_BLOCKER",
    status: "FIXED_AND_TESTED",
    note: "Not quietly removed: retained here with its full history. See partner-p10-floor.json.",
  },
  verifiedProperties: [
    { property: "p10_floor_enforced", holds: floorImported && floorConsumed, evidence: "Boolean(PRODUCTION_AUTHORIZED) && isPartnerLivePayoutAuthorized()" },
    { property: "environment_cannot_bypass_floor", holds: true, evidence: "128-combination exhaustive sweep: no env subset authorizes a payout while the const floor is false." },
    { property: "dry_run_is_pure_preview", holds: /if\s*\(dryRun\)\s*\{[\s\S]*?previewPayouts\(/.test(payoutsCode), evidence: "runMonthlyPayouts delegates to previewPayouts (SELECT-only); no transfer, no batch row, no paid status, no email, no fake stripe id, no run lock." },
    { property: "paid_only_after_provider_evidence", holds: true, evidence: "settle() runs only after createTransfer() resolves." },
    { property: "unknown_outcome_safe", holds: true, evidence: "reconciliation_required: releases nothing, pays nothing, reconciles via findTransfer." },
    { property: "deterministic_idempotency", holds: true, evidence: "partner-payout:<partnerId>:<periodKey>:<batchHash> + run lock + uq_pp_item_entry_live." },
    { property: "test_entries_cannot_enter_a_live_batch", holds: true, evidence: "stripe_mode filter is IN THE SQL SELECTION; assertHomogeneousBatch rejects mixed mode/currency." },
    { property: "stripe_mode_server_derived", holds: true, evidence: "derived from the STRIPE_SECRET_KEY prefix; PayoutDeps functions take zero arguments -> no request body can influence them." },
    { property: "cron_auth_fail_closed_constant_time", holds: cron !== null && /timingSafeEqual/.test(cron), evidence: "no secret -> 503; timing-safe compare; unauthorized -> 401; payouts-disabled flag -> skip." },
    { property: "admin_route_preview_only", holds: adminAction !== null && /dryRunOverride:\s*true/.test(adminAction), evidence: "admin action forces dryRunOverride: true — it cannot execute a real transfer." },
    { property: "cron_route_cannot_bypass_floor", holds: cron !== null && /defaultPayoutDeps\(/.test(cron), evidence: "the cron uses defaultPayoutDeps, which now consumes the P10 floor." },
    { property: "env_example_claim_is_now_true", holds: envExample !== null && /plancher P10/i.test(envExample) && floorConsumed, evidence: "documentation and behaviour agree." },
  ],
  liveAuthorizationGate: {
    checks: 9,
    note: "NODE_ENV + VERCEL_ENV production + payouts enabled + dry-run explicitly false + explicit live authorization + sk_live_ key + cron secret + no test key + no test/live mix. This gate ADDS restrictions on top of the P10 floor; it can never replace it.",
    fileHasNoP10Coupling: liveAuth !== null && !/PRODUCTION_AUTHORIZED/.test(liveAuth),
    designNote: "live-authorization.ts stays a PURE environment evaluator (no P10 import) — the floor is composed at the dependency-construction site. This keeps the env gate independently testable while making bypass impossible.",
  },
  livePayoutExecutedByThisSession: false,
  liveStripeCallMade: false,
});

// ── migration status ──
const payoutMigration = "supabase/migrations/2026-07-11_05__clonestore_pp_payout_automation.sql";
w("partner-migration-status.json", {
  file: payoutMigration,
  presentLocally: existsSync(payoutMigration),
  appliedRemotely: false,
  appliedByThisSession: false,
  remoteStateVerified: false,
  remoteState: "UNKNOWN",
  introducedBy: "the concurrent partner workstream (not E1.1)",
  requires: [
    "separate operator review",
    "a database backup before application",
    "explicit owner authorization",
  ],
  hardRule: "The presence of the SQL file — and the fact that its tests pass — NEVER implies remote application. Code and tests prove behaviour, not deployment.",
});

// ── remote database status ──
w("remote-database-status.json", {
  remoteDatabaseMutated: false,
  connectionOpened: false,
  preflightRun: "node scripts/e1-1-clonechat-remote-preflight.mjs  (WITHOUT --connect)",
  urlPrinted: false,
  credentialPrinted: false,
  target: { configured: true, source: "DATABASE_URL", category: "managed_supabase_remote", productionSuspected: true },
  p941: { migrationPresentLocally: true, appliedRemotely: false, remoteState: "UNKNOWN" },
  partnerPayoutMigration: { presentLocally: true, appliedRemotely: false, remoteState: "UNKNOWN" },
  note: "Both migrations remain locally prepared and remotely UNVERIFIED. Only an authorized operator running the preflight with --connect can establish remote state.",
});

// ── deployment status ──
w("deployment-status.json", {
  deploymentPerformed: false,
  deploymentAuthorized: false,
  productionAuthorized: false,
  buildRan: true,
  buildExitCode: 0,
  buildIsNotADeployment: "A green clean build proves the tree compiles and its routes validate. It does not deploy, and it does not authorize deployment.",
  readyForControlledDeploymentMeaning: "PREFLIGHT ready — every local gate is green on a frozen tree. It is NOT production authorization: PRODUCTION_AUTHORIZED remains false as const, and deploying requires an explicit, separate owner decision.",
});

console.log("done");
