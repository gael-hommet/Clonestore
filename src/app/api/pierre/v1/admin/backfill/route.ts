// src/app/api/pierre/v1/admin/backfill/route.ts
// PHASE 8.2 — POST tenancy backfill (admin/token-secured). Idempotent: maps the
// legacy per-user ownership model to canonical companies + owner memberships.
// Never trust a client; gated by a shared admin token.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { runTenancyBackfill } from "@/lib/pierre/v1/backfill";
import { toRuntimeError, errorBody } from "@/lib/pierre/v1/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("x-admin-token");
    if (!process.env.PIERRE_ADMIN_TOKEN || token !== process.env.PIERRE_ADMIN_TOKEN) {
      return NextResponse.json({ error: { code: "forbidden", message: "Invalid admin token" } }, { status: 403 });
    }
    const db = await getRuntimeDb();
    const result = await runTenancyBackfill(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const re = toRuntimeError(err);
    return NextResponse.json(errorBody(re), { status: re.status });
  }
}
