// src/app/api/cron/pierre/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET || "";

function getOrigin(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return null;
  return `${proto}://${host}`;
}

function checkCronAuth(req: Request): boolean {
  const secret = CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  try {
    if (!CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "Missing CRON_SECRET" }, { status: 500 });
    }

    if (!checkCronAuth(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const origin = getOrigin(req);
    if (!origin) {
      return NextResponse.json({ ok: false, error: "Cannot determine origin" }, { status: 500 });
    }

    // Appelle tick sur la même instance (prod)
    const url = `${origin}/api/pierre/tick?secret=${encodeURIComponent(CRON_SECRET)}&limit=5`;
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "cron_failed") }, { status: 500 });
  }
}

