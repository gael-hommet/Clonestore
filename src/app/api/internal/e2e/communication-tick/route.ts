// src/app/api/internal/e2e/communication-tick/route.ts — TEST-ONLY: the Fake provider drains enqueued
// communications (e.g. invitation links) into the mailbox. No terminal state is fabricated directly.
import { NextResponse } from "next/server";
import { guardE2E, e2eCommunicationTick } from "@/lib/pierre/v1/e2e-control-plane";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  return NextResponse.json(await e2eCommunicationTick());
}
