// B48 — Pierre Final Launch Verdict
// Aggregates all Pierre launch checks into a PierreLaunchVerdict.
// Pure: no Supabase, no Next, no async. No throw.
// CRITICAL: legal_review_complete is always false until manually set — never auto-clear.

import type { PierreLaunchVerdict } from "../../launch-readiness/types";
import { buildPierreLegalVerdict } from "../legal/pierre-legal-verdict";
import { getPierreLaunchChecks, getPierreLaunchChecksSummary } from "./pierre-launch-checks";

export function buildPierreFinalLaunchVerdict(
  legalReviewManuallyDone = false
): PierreLaunchVerdict {
  const legalVerdict = buildPierreLegalVerdict();
  const checksSummary = getPierreLaunchChecksSummary();
  const checks = getPierreLaunchChecks();

  const blocking_items: string[] = [];
  const warnings: string[] = [];

  // Legal review is always required — never auto-cleared
  const legal_review_complete = legalReviewManuallyDone;
  if (!legal_review_complete) {
    blocking_items.push("Revue juridique humaine non effectuée — requis avant lancement public.");
  }

  // Hard limits
  const hard_limits_ok = legalVerdict.hard_limits.length > 0;
  if (!hard_limits_ok) {
    blocking_items.push("Hard limits Pierre non documentés.");
  }

  // Failing blocking checks
  for (const check of checks) {
    if (!check.ok && check.blocking) {
      blocking_items.push(check.notes);
    }
  }

  // Warnings
  warnings.push("Pierre ne garantit pas la conformité juridique.");
  warnings.push("Les documents officiels nécessitent validation humaine.");
  warnings.push("Pierre ne remplace pas un avocat, juriste ou expert-comptable.");
  if (legalVerdict.legal_review_required) {
    warnings.push("Revue juridique requise — attendue en B47.");
  }

  const is_safe_for_demo = legalVerdict.safe_to_use_in_b48 && hard_limits_ok;
  const is_safe_for_paid_customers =
    is_safe_for_demo &&
    legal_review_complete &&
    checksSummary.blocking_failing === 0;

  // Status determination
  let status: PierreLaunchVerdict["status"];
  if (blocking_items.length === 0 && legal_review_complete) {
    status = "pierre_launch_ready";
  } else if (!legal_review_complete && checksSummary.blocking_failing === 0) {
    status = "pierre_internal_only";
  } else {
    status = "pierre_blocked";
  }

  const notes =
    `Score légal B47: ${legalVerdict.score_0_to_100}. ` +
    `Modules couverts: ${legalVerdict.covered_modules.length}. ` +
    `Claims interdites: ${legalVerdict.capabilities_summary.forbidden_commercial_claims}. ` +
    `Claims autorisées: ${legalVerdict.capabilities_summary.safe_commercial_claims}.`;

  return {
    status,
    is_safe_for_paid_customers,
    is_safe_for_demo,
    legal_review_complete,
    legal_review_required: legalVerdict.legal_review_required,
    hard_limits_ok,
    blocking_items,
    warnings,
    notes,
  };
}

export function isPierreSafeForDemo(): boolean {
  return buildPierreFinalLaunchVerdict(false).is_safe_for_demo;
}

export function isPierreSafeForPaidCustomers(legalReviewDone = false): boolean {
  return buildPierreFinalLaunchVerdict(legalReviewDone).is_safe_for_paid_customers;
}
