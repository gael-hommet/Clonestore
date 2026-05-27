// B43 — GET /api/pierre/observability/events
// Internal route — requires internal secret. Returns recent observable events.

import { NextRequest, NextResponse } from "next/server";
import { getDefaultObservableSink } from "../../../../../lib/observability/runtime";
import type { ObservableEventDomain, ObservabilitySeverity, ObservableEventStatus } from "../../../../../lib/observability/types";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.PIERRE_INTERNAL_DIAGNOSTICS_SECRET;
  if (!secret || secret.trim().length === 0) return false;
  return req.headers.get("x-internal-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Forbidden. Internal events endpoint." },
      { status: 403, headers: SECURITY_HEADERS },
    );
  }

  const { searchParams } = req.nextUrl;

  const domain = searchParams.get("domain") as ObservableEventDomain | null;
  const severity = searchParams.get("severity") as ObservabilitySeverity | null;
  const status = searchParams.get("status") as ObservableEventStatus | null;
  const correlation_id = searchParams.get("correlation_id") ?? undefined;
  const company_id = searchParams.get("company_id") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

  if (isNaN(limit) || limit < 1) {
    return NextResponse.json(
      { error: "Invalid limit parameter." },
      { status: 400, headers: SECURITY_HEADERS },
    );
  }

  try {
    const sink = getDefaultObservableSink();

    const events = sink.list({
      domain: domain ?? undefined,
      severity: severity ?? undefined,
      status: status ?? undefined,
      correlation_id,
      company_id,
      limit,
    });

    const summary = sink.summarize({
      domain: domain ?? undefined,
      severity: severity ?? undefined,
      status: status ?? undefined,
    });

    return NextResponse.json(
      {
        total: events.length,
        events: events.map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          correlation_id: e.correlation_id,
          domain: e.domain,
          event_type: e.event_type,
          status: e.status,
          severity: e.severity,
          message: e.message,
          safe_user_message: e.safe_user_message,
          error_code: e.error_code,
          retry_count: e.retry_count,
          created_at: e.created_at,
        })),
        summary,
      },
      { headers: SECURITY_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to retrieve events." },
      { status: 500, headers: SECURITY_HEADERS },
    );
  }
}
