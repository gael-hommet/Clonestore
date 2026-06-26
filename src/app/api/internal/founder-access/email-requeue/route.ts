// E-R1 §20 — POST /api/internal/founder-access/email-requeue (admin + porte gouvernée).
// Relance gouvernée des jobs email en dead-letter → pending. Audité. no-store.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { guardInternalRequest, founderAdminDeniedResponse } from "@/lib/founder-access/admin-guard";
import { requeueDeadEmailJobs, recordAdminAudit } from "@/lib/founder-access/store";
import { readJsonBounded } from "@/lib/founder-access/request-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await guardInternalRequest(req);
  if (!auth.ok) return founderAdminDeniedResponse(auth.reason);

  const body = await readJsonBounded<{ jobId?: unknown }>(req);
  const jobId = body && typeof body.jobId === "number" && Number.isInteger(body.jobId) ? body.jobId : undefined;

  const db = await getRuntimeDb();
  const requeued = await requeueDeadEmailJobs(db, jobId);
  await recordAdminAudit(db, { actor_email: auth.email, action: "email.requeue_dead", result: "ok", context_safe: { requeued, jobId: jobId ?? "all" } });
  return NextResponse.json({ ok: true, requeued }, { headers: { "cache-control": "private, no-store" } });
}
