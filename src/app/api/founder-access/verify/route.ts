// Phase E.2 — GET /api/founder-access/verify?rid=&token= (confirmation email).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { confirmReservation } from "@/lib/founder-access/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rid = url.searchParams.get("rid") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const dest = (state: string) => NextResponse.redirect(new URL(`/reserver/pierre?confirm=${state}`, url.origin));

  if (!UUID_RE.test(rid) || !token) return dest("invalid");
  try {
    const db = await getRuntimeDb();
    const res = await confirmReservation(db, rid, token);
    if (res.ok) return dest("ok");
    return dest(res.reason === "expired" ? "expired" : "invalid");
  } catch {
    return dest("error");
  }
}
