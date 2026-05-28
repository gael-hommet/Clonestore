// B48 — Final Launch Verdict
// Aggregates all readiness checks into a single B48FinalVerdict.
// Pure: no Supabase, no Next, no async. No throw.
// CRITICAL: Must never claim "public_launch_ready" when manual blockers are unresolved.

import type { B48FinalVerdict, ManualVerificationFlags, LaunchSurface } from "./types";
import { buildAllReadinessReports, getBlockingChecks } from "./readiness-checks";
import { evaluateManualFlags, getDefaultManualFlags } from "./production-flags";
import { areAllBlocsComplete, getBlocRegistrySummary } from "./block-registry";
import { isEnvProductionReady } from "./env-readiness";

export function buildB48FinalVerdict(
  manualFlags?: Partial<ManualVerificationFlags>
): B48FinalVerdict {
  const flags = { ...getDefaultManualFlags(), ...(manualFlags ?? {}) };
  const flagEval = evaluateManualFlags(flags);
  const reports = buildAllReadinessReports();
  const blockingChecks = getBlockingChecks();
  const blocsComplete = areAllBlocsComplete();
  const blocsSummary = getBlocRegistrySummary();

  const surfaces_blocked: LaunchSurface[] = reports
    .filter((r) => r.status === "blocked")
    .map((r) => r.surface);

  const surfaces_ready: LaunchSurface[] = reports
    .filter((r) => r.status === "ready")
    .map((r) => r.surface);

  // Non-manual blocking checks are code-level invariants that are always enforced.
  // Manual blocking checks are resolved by the corresponding production flag.
  const codeBlockingChecks = blockingChecks.filter((c) => !c.is_manual);

  const blocking_items: string[] = [
    ...codeBlockingChecks.map((c) => c.label),
    ...flagEval.blocking_unverified,
  ];

  const manual_items_pending: string[] = flagEval.non_blocking_unverified;

  const warnings: string[] = [
    "Pierre n'est pas un avocat, juriste, expert-comptable ou logiciel de paie officiel.",
    "La conformité juridique finale n'est pas garantie par B47/B48 — revue humaine requise.",
    "Les documents officiels générés nécessitent validation humaine avant usage.",
    ...(blocsComplete ? [] : [`${blocsSummary.missing + blocsSummary.partial} blocs incomplets.`]),
  ];

  const is_technically_complete =
    blocsComplete &&
    blockingChecks.filter((c) => !c.is_manual).length === 0;

  const all_manual_blockers_resolved = flagEval.all_blocking_done;

  const is_publicly_launchable =
    is_technically_complete &&
    all_manual_blockers_resolved &&
    blocking_items.length === 0;

  // Score: start at 100, -10 per blocking item, -3 per warning
  const score = Math.max(
    0,
    100 -
      blocking_items.length * 10 -
      warnings.length * 3
  );

  let status: B48FinalVerdict["status"];
  if (is_publicly_launchable) {
    status = "public_launch_ready";
  } else if (is_technically_complete && !all_manual_blockers_resolved) {
    status = "technical_ready_public_blocked";
  } else if (blocking_items.length > 0) {
    status = "launch_blocked";
  } else {
    status = "not_evaluated";
  }

  return {
    status,
    score_0_to_100: score,
    is_technically_complete,
    is_publicly_launchable,
    blocking_items,
    manual_items_pending,
    warnings,
    surfaces_ready,
    surfaces_blocked,
    evaluated_at: new Date().toISOString(),
  };
}

export function getB48VerdictSummary(manualFlags?: Partial<ManualVerificationFlags>): {
  status: B48FinalVerdict["status"];
  score: number;
  blocking_count: number;
  is_technically_complete: boolean;
  is_publicly_launchable: boolean;
} {
  const verdict = buildB48FinalVerdict(manualFlags);
  return {
    status: verdict.status,
    score: verdict.score_0_to_100,
    blocking_count: verdict.blocking_items.length,
    is_technically_complete: verdict.is_technically_complete,
    is_publicly_launchable: verdict.is_publicly_launchable,
  };
}

export function isPublicLaunchReady(manualFlags?: Partial<ManualVerificationFlags>): boolean {
  return buildB48FinalVerdict(manualFlags).is_publicly_launchable;
}

export function getTechnicalReadinessStatus(): "complete" | "incomplete" {
  return areAllBlocsComplete() ? "complete" : "incomplete";
}
