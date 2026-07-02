// src/app/api/internal/e2e/state/route.ts — TEST-ONLY: read-only snapshot of client state for assertions.
import { NextResponse } from "next/server";
import { guardE2E, e2eState } from "@/lib/pierre/v1/e2e-control-plane";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  return NextResponse.json(await e2eState());
}
