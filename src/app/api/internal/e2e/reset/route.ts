// src/app/api/internal/e2e/reset/route.ts — TEST-ONLY: virgin v1→v28 DB + empty mailbox between scenarios.
import { NextResponse } from "next/server";
import { guardE2E, e2eReset } from "@/lib/pierre/v1/e2e-control-plane";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  return NextResponse.json(await e2eReset());
}
