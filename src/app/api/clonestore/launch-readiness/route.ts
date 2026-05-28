// B48 — CloneStore Launch Readiness Route
// GET /api/clonestore/launch-readiness
// Returns the B48 final launch readiness verdict for CloneStore/Pierre.
// No Supabase required — pure computation.

import { NextRequest, NextResponse } from "next/server";
import { buildB48FinalVerdict, getB48VerdictSummary } from "../../../../lib/launch-readiness/launch-verdict";
import { buildAllReadinessReports, getBlockingChecks } from "../../../../lib/launch-readiness/readiness-checks";
import { getBlocRegistrySummary } from "../../../../lib/launch-readiness/block-registry";
import { getEnvReadinessSummary } from "../../../../lib/launch-readiness/env-readiness";
import { getAllProductionFlags } from "../../../../lib/launch-readiness/production-flags";
import type { ManualVerificationFlags } from "../../../../lib/launch-readiness/types";

function asBool(v: string | null): boolean {
  return v === "true" || v === "1";
}

function buildFlagsFromParams(params: URLSearchParams): Partial<ManualVerificationFlags> {
  const flags: Partial<ManualVerificationFlags> = {};
  const keys: Array<keyof ManualVerificationFlags> = [
    "cgu_cgu_validated",
    "privacy_policy_validated",
    "legal_review_done",
    "rls_production_verified",
    "stripe_production_configured",
    "domain_dns_configured",
    "smtp_production_configured",
    "rgpd_dpa_prepared",
    "security_audit_done",
  ];
  for (const key of keys) {
    const val = params.get(key);
    if (val !== null) {
      flags[key] = asBool(val);
    }
  }
  return flags;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const manualFlags = buildFlagsFromParams(searchParams);

  const verdict = buildB48FinalVerdict(manualFlags);
  const summary = getB48VerdictSummary(manualFlags);
  const reports = buildAllReadinessReports();
  const blockingChecks = getBlockingChecks();
  const blocsSummary = getBlocRegistrySummary();
  const envSummary = getEnvReadinessSummary();
  const productionFlags = getAllProductionFlags();

  return NextResponse.json({
    ok: true,
    verdict,
    summary,
    reports: reports.map((r) => ({
      surface: r.surface,
      status: r.status,
      blocking_count: r.blocking_count,
      warning_count: r.warning_count,
      ready_count: r.ready_count,
    })),
    blocking_checks: blockingChecks.map((c) => ({
      id: c.id,
      surface: c.surface,
      label: c.label,
      severity: c.severity,
      remediation: c.remediation,
    })),
    blocs: blocsSummary,
    env: {
      total: envSummary.total,
      set: envSummary.set,
      missing: envSummary.missing,
      required_missing: envSummary.required_missing,
    },
    production_flags: productionFlags.map((f) => ({
      key: f.key,
      label: f.label,
      blocking_public_launch: f.blocking_public_launch,
      surface: f.surface,
    })),
    meta: {
      bloc: "B48",
      evaluatedAt: verdict.evaluated_at,
      route: "/api/clonestore/launch-readiness",
    },
  });
}
