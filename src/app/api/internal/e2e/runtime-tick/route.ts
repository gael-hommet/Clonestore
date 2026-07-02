// src/app/api/internal/e2e/runtime-tick/route.ts — TEST-ONLY: run the real P8.5 runtime worker for a
// tenant (claim + execute under the worker role). No terminal state is fabricated directly.
import { NextResponse } from "next/server";
import { guardE2E, e2eRuntimeTick } from "@/lib/pierre/v1/e2e-control-plane";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = guardE2E(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { company_id?: string };
  if (!body.company_id) return NextResponse.json({ error: { code: "validation_failed", message: "company_id required" } }, { status: 422 });
  return NextResponse.json(await e2eRuntimeTick(body.company_id));
}
