// B47 — Pierre Legal Readiness Route
// GET /api/pierre/legal/readiness
// Returns the B47 legal and commercial readiness verdict for Pierre.
// No Supabase required — pure computation.

import { NextResponse } from "next/server";
import { buildLegalCommercialVerdict } from "../../../../../lib/legal-commercial/legal-verdict";
import { buildPierreLegalVerdict } from "../../../../../lib/pierre/legal/pierre-legal-verdict";
import { buildB47AcceptanceChecklist, getB48LegalPrerequisites } from "../../../../../lib/legal-commercial/acceptance-checklist";
import { buildPayrollCapabilitySummary } from "../../../../../lib/pierre/legal/pierre-payroll-policy";
import { buildEmailCapabilitySummary } from "../../../../../lib/pierre/legal/pierre-email-legal-policy";
import { getAllPierreSafeClaims, getAllPierreForbiddenClaims } from "../../../../../lib/pierre/legal/pierre-commercial-claims";

export async function GET() {
  const legalVerdict = buildLegalCommercialVerdict();
  const pierreVerdict = buildPierreLegalVerdict();
  const checklist = buildB47AcceptanceChecklist();
  const prerequisites = getB48LegalPrerequisites();
  const payrollSummary = buildPayrollCapabilitySummary();
  const emailSummary = buildEmailCapabilitySummary();
  const safeClaims = getAllPierreSafeClaims();
  const forbiddenClaims = getAllPierreForbiddenClaims();

  return NextResponse.json({
    ok: true,
    legal_verdict: legalVerdict,
    pierre_verdict: pierreVerdict,
    checklist: {
      total: checklist.length,
      blocking_b48: prerequisites.length,
      items: checklist,
    },
    capabilities: {
      payroll: payrollSummary,
      email: emailSummary,
    },
    claims: {
      safe_count: safeClaims.length,
      forbidden_count: forbiddenClaims.length,
    },
    meta: {
      bloc: "B47",
      evaluatedAt: new Date().toISOString(),
      route: "/api/pierre/legal/readiness",
    },
  });
}
