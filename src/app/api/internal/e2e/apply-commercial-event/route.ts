// src/app/api/internal/e2e/apply-commercial-event/route.ts — TEST-ONLY: apply a persisted commercial
// event through the ordered governed path (billing role). No direct entitlement mutation.
import { NextResponse } from "next/server";
import { guardE2E, e2eApplyCommercialEvent } from "@/lib/pierre/v1/e2e-control-plane";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { event_id?: string };
  if (!body.event_id) return NextResponse.json({ error: { code: "validation_failed", message: "event_id required" } }, { status: 422 });
  return NextResponse.json(await e2eApplyCommercialEvent(body.event_id));
}
