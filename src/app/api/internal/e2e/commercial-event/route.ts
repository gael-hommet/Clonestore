// src/app/api/internal/e2e/commercial-event/route.ts — TEST-ONLY: ingest a commercial proof (billing
// role) and, if it matches an awaiting activation, mark it provisioning. No direct truth fabrication.
import { NextResponse } from "next/server";
import { guardE2E, e2eCommercialEvent, type CommercialEventInput } from "@/lib/pierre/v1/e2e-control-plane";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as CommercialEventInput;
  if (!body.provider_event_id || !body.event_key) {
    return NextResponse.json({ error: { code: "validation_failed", message: "provider_event_id + event_key required" } }, { status: 422 });
  }
  return NextResponse.json(await e2eCommercialEvent(body));
}
