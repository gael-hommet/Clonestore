// B43 — GET /api/pierre/observability/diagnostics
// Internal route — requires internal secret, never exposed to end users.

import { NextRequest, NextResponse } from "next/server";
import { buildPierreDiagnosticsReport } from "../../../../../lib/pierre/observability/pierre-diagnostics";
import { getDefaultObservableSink, getDefaultDeadLetterSink } from "../../../../../lib/observability/runtime";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.PIERRE_INTERNAL_DIAGNOSTICS_SECRET;
  if (!secret || secret.trim().length === 0) return false;
  const header = req.headers.get("x-internal-secret");
  return header === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Forbidden. Internal diagnostics endpoint." },
      { status: 403, headers: SECURITY_HEADERS },
    );
  }

  try {
    const report = buildPierreDiagnosticsReport({
      sink: getDefaultObservableSink(),
      dead_letter_sink: getDefaultDeadLetterSink(),
    });

    const httpStatus =
      report.status === "ok" ? 200 :
      report.status === "degraded" ? 200 :
      503;

    return NextResponse.json(report, { status: httpStatus, headers: SECURITY_HEADERS });
  } catch (err) {
    return NextResponse.json(
      {
        status: "critical",
        safe_to_operate: false,
        error: "Diagnostics report failed to generate.",
      },
      { status: 503, headers: SECURITY_HEADERS },
    );
  }
}
