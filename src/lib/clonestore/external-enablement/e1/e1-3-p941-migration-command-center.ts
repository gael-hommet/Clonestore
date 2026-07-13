// src/lib/clonestore/external-enablement/e1/e1-3-p941-migration-command-center.ts
//
// E1.3 — P9.4.1 MIGRATION COMMAND CENTER (§15).
//
// Every migration-outcome field is DERIVED from the runner's evidence via the shared core
// (deriveE13CommandCenter) — the same logic the runner and the tests exercise, so there is no
// second brain. The only constants are the phase's HARD VALUES (the things E1.3 can never do:
// read a customer row, call a provider, deploy, authorize production, apply more than one
// migration), pinned as literal types so a future edit that tries to flip one fails to compile.

import {
  deriveE13CommandCenter,
  type E13CommandCenter,
  type E13Evidence,
} from "./e1-2-preflight-core.mjs";

export type { E13CommandCenter, E13Evidence };

/** The hard values E1.3 can never move, whatever the migration outcome. */
export const E1_3_HARD_VALUES = {
  customerRowsRead: 0,
  liveProviderCalls: 0,
  productionAuthorized: false,
  paymentMode: "disabled",
  partnerPayoutLiveAuthorized: false,
  deploymentPerformed: false,
} as const;

/**
 * Build the E1.3 command center from evidence.
 *
 * With no evidence it yields the "prepared, nothing applied" shape — `migrationsApplied: 0`,
 * `remoteDatabaseMutated: false`, `exactMutationPerformed: "NONE"` — which is exactly where
 * E1.3 sits before the owner authorizes.
 */
export function buildE13CommandCenter(evidence: E13Evidence = {}): E13CommandCenter {
  const cc = deriveE13CommandCenter(evidence);
  assertHardValues(cc);
  return cc;
}

function assertHardValues(cc: E13CommandCenter): void {
  const v: string[] = [];
  if (cc.customerRowsRead !== 0) v.push("customerRowsRead must be 0");
  if (cc.liveProviderCalls !== 0) v.push("liveProviderCalls must be 0");
  if (cc.productionAuthorized !== false) v.push("productionAuthorized must be false");
  if (cc.paymentMode !== "disabled") v.push("paymentMode must be disabled");
  if (cc.partnerPayoutLiveAuthorized !== false) v.push("partnerPayoutLiveAuthorized must be false");
  if (cc.deploymentPerformed !== false) v.push("deploymentPerformed must be false");
  if (cc.migrationsApplied !== 0 && cc.migrationsApplied !== 1) v.push("migrationsApplied must be 0 or 1");
  if (cc.exactMutationPerformed !== "NONE" && cc.exactMutationPerformed !== "P9.4.1_CANONICAL_MIGRATION_ONLY") {
    v.push("exactMutationPerformed must be NONE or P9.4.1_CANONICAL_MIGRATION_ONLY");
  }
  // remoteDatabaseMutated may be true ONLY when the migration committed.
  if (cc.remoteDatabaseMutated === true && cc.migrationCommitted !== true) v.push("remoteDatabaseMutated true without a commit");
  if (cc.remoteDatabaseMutated === true && cc.migrationsApplied !== 1) v.push("remoteDatabaseMutated true but migrationsApplied != 1");
  if (v.length) throw new Error(`E1.3 command center violated its hard values: ${v.join("; ")}`);
}

/** A committed migration does NOT authorize deployment — that is a separate, still-closed gate. */
export function isDeploymentAuthorized(_cc: E13CommandCenter): false {
  return false;
}
