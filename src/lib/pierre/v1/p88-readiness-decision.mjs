// src/lib/pierre/v1/p88-readiness-decision.mjs
// PHASE 8.8 — read-only aggregation of the FINAL Production-unblock gates into a single, automatable
// decision. It NEVER modifies a flag, never deploys, never touches a provider. It only READS gate
// results and returns READY_FOR_OWNER_UNBLOCK_DECISION or BLOCKED with structured reasons.
//
// Hard invariants (fail-closed):
//   • While P8.7.4 is not 24/24 (VERIFIED), the decision is ALWAYS BLOCKED.
//   • Any OPEN external blocker (e.g. the Yousign sandbox membership blocker) forces BLOCKED.
//   • If the deploy-block was disabled BEFORE this decision, that is an anomaly → BLOCKED.
//   • Missing owner approval → BLOCKED (the human decision is the last gate).

export const READY = "READY_FOR_OWNER_UNBLOCK_DECISION";
export const BLOCKED = "BLOCKED";

/**
 * Evaluate the final unblock readiness from already-collected gate results (pure; no I/O).
 * @param {object} g gate results
 * @returns {{decision: string, ready: boolean, blockers: Array<{gate:string, reason:string, owner?:string}>, gates: object}}
 */
export function evaluateReadiness(g = {}) {
  const blockers = [];
  const add = (gate, reason, owner) => blockers.push({ gate, reason, owner: owner || "engineering" });

  // ── engineering gates ─────────────────────────────────────────────────────
  if (!g.tests?.passed) add("tests", "targeted P8.7.4 + P8.8 tests are not all green");
  if (!g.build?.passed) add("build", "clean production build did not pass (exit != 0)");
  if (!g.preflight?.green) add("preflight", "read-only production preflight is not 17/17 GREEN");

  // ── provider readiness (mode-correct, not live) ───────────────────────────
  if (!g.providers?.stripe_test) add("stripe", "Stripe is not in TEST mode");
  if (!g.providers?.resend) add("resend", "Resend is not configured (provider/key/from)");
  if (!g.providers?.yousign_sandbox) add("yousign", "Yousign is not in Sandbox mode");

  // ── THE hard invariant: P8.7.4 must be 24/24 VERIFIED ─────────────────────
  if (!g.p874?.verified_24_24) add("p8_7_4", "P8.7.4 controlled live journey is not 24/24 VERIFIED", "engineering+yousign");
  if (g.p874?.final_report_ok === false) add("p8_7_4_report", "P8.7.4 final-report.json ok is not true");

  // ── external blockers (open ones force BLOCKED) ───────────────────────────
  for (const b of g.externalBlockers || []) {
    if (String(b.state).toUpperCase() !== "CLOSED") add(`external:${b.id}`, `external blocker ${b.id} is ${b.state}`, b.owner || "external");
  }

  // ── safety: deploy-block must STILL be active until the owner decision ─────
  if (!g.deployBlock?.active) add("deploy_block", "NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE is NOT active — premature unblock anomaly", "security");

  // ── clean state + operational readiness ───────────────────────────────────
  if (!g.residue?.zero) add("residue", "synthetic residue is not zero (tenants/entitlements/deliveries/Stripe/Yousign)");
  if (!g.rollback?.ready) add("rollback", "rollback runbook / capability not ready");
  if (!g.observability?.ready) add("observability", "observability + alerting not verified");

  // ── final human gate ──────────────────────────────────────────────────────
  if (!g.ownerApproval?.granted) add("owner_approval", "owner has not granted the final unblock approval", "owner");

  const ready = blockers.length === 0;
  return { decision: ready ? READY : BLOCKED, ready, blockers, gates: g };
}

/** Render a short human summary (no secrets; pure). */
export function renderDecision(result) {
  const lines = [`P8.8 UNBLOCK DECISION: ${result.decision}`];
  if (result.blockers.length) { lines.push(`blockers (${result.blockers.length}):`); for (const b of result.blockers) lines.push(`  - [${b.owner}] ${b.gate}: ${b.reason}`); }
  else lines.push("all gates green — awaiting explicit owner unblock action.");
  return lines.join("\n");
}
