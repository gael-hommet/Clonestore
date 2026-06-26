// Phase E §4.4 — POST /api/internal/owner-gate/lock
// Verrouille la porte propriétaire : efface immédiatement le cookie signé.
import { NextResponse } from "next/server";
import { clearOwnerGateCookie } from "@/lib/founder-access/signed-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.append("set-cookie", clearOwnerGateCookie());
  return res;
}
