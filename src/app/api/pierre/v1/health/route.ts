// src/app/api/pierre/v1/health/route.ts
// PHASE 8.1 — GET runtime readiness (DB reachable + queue depth). No tenant data.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { queueDepth } from "@/lib/pierre/v1/queue";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getRuntimeDb();
    await db.query("select 1");
    const depth = await queueDepth(db);
    return NextResponse.json({ status: "ok", db: "reachable", queue: depth });
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503 });
  }
}
