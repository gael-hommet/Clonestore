// Phase E.6 — GET /api/internal/founder-access/presence (admin + porte, no-store).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { presenceSnapshot } from "@/lib/founder-access/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);
  const db = await getRuntimeDb();
  return NextResponse.json(await presenceSnapshot(db), { headers: { "cache-control": "private, no-store" } });
}
