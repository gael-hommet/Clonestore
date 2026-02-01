// src/app/api/cron/pierre/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET!;
const BASE_URL = (process.env.CLONESTORE_BASE_URL || "").replace(/\/$/, "");

export async function GET() {
  if (!CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Missing CRON_SECRET" }, { status: 500 });
  }
  if (!BASE_URL) {
    return NextResponse.json({ ok: false, error: "Missing CLONESTORE_BASE_URL" }, { status: 500 });
  }

  const url = `${BASE_URL}/api/pierre/tick?secret=${encodeURIComponent(CRON_SECRET)}&limit=5`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();

  return new NextResponse(text, { status: res.status, headers: { "content-type": "application/json" } });
}
