// E-R2 §14 — GET /api/internal/founder-access/clients (admin + porte, no-store, paginé).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { listFounderClients } from "@/lib/founder-access/command-center";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);
  const q = new URL(req.url).searchParams;
  const page = Math.max(1, Number(q.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize")) || 25));
  const db = await getRuntimeDb();
  const result = await listFounderClients(db, page, pageSize);
  return NextResponse.json({ ...result, page, pageSize }, { headers: { "cache-control": "private, no-store" } });
}
