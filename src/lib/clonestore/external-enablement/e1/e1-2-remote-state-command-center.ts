// src/lib/clonestore/external-enablement/e1/e1-2-remote-state-command-center.ts
//
// E1.2 — REMOTE STATE COMMAND CENTER (§13).
//
// Every remote field is DERIVED from the evidence produced by the authorized read-only
// preflight. Nothing here is a hardcoded green value: with no evidence, every remote
// field resolves to "UNVERIFIABLE" and the verdict stays blocked. The only constants are
// the phase's HARD VALUES — the things E1.2 structurally cannot do (mutate, migrate,
// deploy, authorize production) — and those are pinned as literal types so a future edit
// that tries to set `productionAuthorized: true` fails to compile.
//
// It delegates the derivation to the shared core (e1-2-preflight-core.mjs) so the logic
// the tests exercise is the same logic the runner executes — there is no second brain.

import {
  deriveE12CommandCenter,
  type E12CommandCenter,
  type E12Evidence,
  type MigrationState,
  type CompatibilityState,
  type HistoryState,
  type Tri,
} from "./e1-2-preflight-core.mjs";

export type {
  E12CommandCenter,
  E12Evidence,
  MigrationState,
  CompatibilityState,
  HistoryState,
  Tri,
};

/** The hard values E1.2 can never move, whatever the remote database turns out to contain. */
export const E1_2_HARD_VALUES = {
  customerRowsRead: 0,
  mutationsExecuted: 0,
  migrationsApplied: 0,
  partnerPayoutRemoteExecutionEnabled: false,
  productionAuthorized: false,
  partnerPayoutLiveAuthorized: false,
  remoteDatabaseMutated: false,
  deploymentPerformed: false,
  deploymentStillBlocked: true,
  paymentMode: "disabled",
} as const;

/**
 * Build the command center from evidence.
 *
 * Passing no evidence is a legitimate, meaningful call: it yields the "prepared but not
 * authorized" state, which is exactly where E1.2 sits before the owner authorizes.
 */
export function buildE12CommandCenter(evidence: E12Evidence = {}): E12CommandCenter {
  const cc = deriveE12CommandCenter(evidence);

  // Fail closed, loudly: if a future refactor of the core ever tried to report a mutation,
  // an applied migration, a read customer row, or an authorized production, we refuse to
  // emit a command center at all rather than publish a false one.
  assertHardValues(cc);
  return cc;
}

function assertHardValues(cc: E12CommandCenter): void {
  const violations: string[] = [];
  if (cc.customerRowsRead !== 0) violations.push("customerRowsRead must be 0 in E1.2");
  if (cc.mutationsExecuted !== 0) violations.push("mutationsExecuted must be 0 in E1.2");
  if (cc.migrationsApplied !== 0) violations.push("migrationsApplied must be 0 in E1.2");
  if (cc.remoteDatabaseMutated !== false) violations.push("remoteDatabaseMutated must be false in E1.2");
  if (cc.deploymentPerformed !== false) violations.push("deploymentPerformed must be false in E1.2");
  if (cc.productionAuthorized !== false) violations.push("productionAuthorized must be false in E1.2");
  if (cc.partnerPayoutLiveAuthorized !== false) violations.push("partnerPayoutLiveAuthorized must be false in E1.2");
  if (cc.partnerPayoutRemoteExecutionEnabled !== false) violations.push("partnerPayoutRemoteExecutionEnabled must stay false unless independently proven");
  if (cc.deploymentStillBlocked !== true) violations.push("deploymentStillBlocked must be true in E1.2");
  if (cc.paymentMode !== "disabled") violations.push("paymentMode must be disabled in E1.2");
  if (violations.length > 0) {
    throw new Error(`E1.2 command center violated its hard values: ${violations.join("; ")}`);
  }
}

/**
 * A compatible remote schema does NOT make the application deployable — deployment is a
 * separate, still-closed gate. Kept as a named predicate so no caller can quietly conflate
 * "the schema matches" with "we may ship".
 */
export function isDeploymentAuthorized(_cc: E12CommandCenter): false {
  return false;
}
