// src/app/api/internal/e2e/activation-tick/route.ts — TEST-ONLY: run the real customer-activation worker
// (claim + lease + fencing + atomic provision). No direct company/membership/entitlement fabrication.
import { NextResponse } from "next/server";
import { guardE2E, e2eActivationTick } from "@/lib/pierre/v1/e2e-control-plane";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  return NextResponse.json(await e2eActivationTick());
}
