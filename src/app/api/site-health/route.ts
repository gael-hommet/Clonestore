// src/app/api/site-health/route.ts
// B31.6 — Read-only static health endpoint. No auth required. No secrets exposed.

import { NextResponse } from "next/server";
import {
  checkDefaultPostLoginPath,
  checkPrivatePathsNonEmpty,
  checkPierreTrialDays,
  checkTrialingGrantsAccess,
} from "@/lib/site-health/checks";
import type { SiteHealthReport } from "@/lib/site-health/types";
import { getDefaultPostLoginPath } from "@/lib/auth/redirects";
import { TRIAL_PERIOD_DAYS } from "@/lib/billing/stripe-activation";

export async function GET() {
  const checks = [
    checkDefaultPostLoginPath(getDefaultPostLoginPath()),
    checkPrivatePathsNonEmpty(),
    checkPierreTrialDays(TRIAL_PERIOD_DAYS),
    checkTrialingGrantsAccess(["active", "trialing"]),
  ];

  const ok = checks.every((check) => check.status !== "fail");

  const report: SiteHealthReport = {
    ok,
    checks,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(report, { status: ok ? 200 : 503 });
}
