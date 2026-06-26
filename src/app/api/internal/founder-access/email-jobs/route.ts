// E-R2 §14 — GET /api/internal/founder-access/email-jobs (admin + porte, no-store, paginé).
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { listEmailJobs } from "@/lib/founder-access/command-center";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["pending", "sending", "sent", "skipped", "failed", "dead"]);

export async function GET(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);
  const q = new URL(req.url).searchParams;
  const page = Math.max(1, Number(q.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize")) || 25));
  const st = q.get("status");
  const status = st && STATUSES.has(st) ? st : undefined;
  const db = await getRuntimeDb();
  const result = await listEmailJobs(db, page, pageSize, status);
  return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
}
