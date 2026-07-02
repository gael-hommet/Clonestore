// src/app/api/internal/e2e/seed-user/route.ts — TEST-ONLY: allocate a minimal test identity only.
import { NextResponse } from "next/server";
import { guardE2E, e2eSeedUser } from "@/lib/pierre/v1/e2e-control-plane";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  return NextResponse.json(e2eSeedUser(body));
}
