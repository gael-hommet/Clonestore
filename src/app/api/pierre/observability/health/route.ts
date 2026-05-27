// B43 — GET /api/pierre/observability/health

import { NextResponse } from "next/server";
import { buildPierreHealthReport } from "../../../../../lib/pierre/observability/pierre-health";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET() {
  try {
    const report = buildPierreHealthReport();

    const httpStatus =
      report.status === "ok" ? 200 :
      report.status === "degraded" ? 200 :
      503;

    return NextResponse.json(
      {
        status: report.status,
        safe_to_operate: report.safe_to_operate,
        generated_at: report.generated_at,
        checks: report.checks.map((c) => ({
          service: c.service,
          status: c.status,
          message: c.message,
          latency_ms: c.latency_ms,
          checked_at: c.checked_at,
        })),
        degraded_services: report.degraded_services,
        down_services: report.down_services,
      },
      { status: httpStatus, headers: SECURITY_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "down",
        safe_to_operate: false,
        error: "Health check failed to run.",
      },
      { status: 503, headers: SECURITY_HEADERS },
    );
  }
}
