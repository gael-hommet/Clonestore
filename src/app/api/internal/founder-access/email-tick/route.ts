// Phase E.3 — POST /api/internal/founder-access/email-tick
// Déclenche un tick du worker email. Protégé par un secret de cron en temps
// constant. En production sans Resend configuré : 503 explicite (aucun faux envoi).
// Chaque exécution est ENREGISTRÉE (clonestore_founder_cron_runs) : preuve réelle qui
// alimente l'état de la source « Cron email » du cockpit (jamais vert sur secret seul).

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { runEmailTick } from "@/lib/founder-access/email-worker";
import { resolveFounderEmailProvider, isFounderEmailConfigured } from "@/lib/founder-access/email-provider";
import { purgeExpiredRateLimits } from "@/lib/founder-access/request-utils";
import { recordCronRun, FOUNDER_EMAIL_CRON_JOB } from "@/lib/founder-access/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(provided: string | null): boolean {
  const expected = process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const provided = req.headers.get("x-cron-secret") ?? bearer;
  if (!secretMatches(provided)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Production : refuser plutôt que simuler un envoi.
  if (process.env.NODE_ENV === "production" && !isFounderEmailConfigured()) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
  }

  const db = await getRuntimeDb();
  let provider;
  try {
    provider = resolveFounderEmailProvider();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "provider" }, { status: 503 });
  }

  const startedAt = Date.now();
  let result;
  try {
    result = await runEmailTick(db, provider);
  } catch (e) {
    // Exécution en erreur → enregistrée comme telle (la source passe « dégradé »).
    await recordCronRun(db, {
      job_name: FOUNDER_EMAIL_CRON_JOB, status: "error",
      duration_ms: Date.now() - startedAt, error_safe: e instanceof Error ? e.name : "error",
    }).catch(() => {});
    throw e;
  }
  await purgeExpiredRateLimits(db);
  const processed = result.sent + result.skipped + result.retried + result.dead;
  await recordCronRun(db, {
    job_name: FOUNDER_EMAIL_CRON_JOB, status: "ok", processed,
    sent: result.sent, skipped: result.skipped, retried: result.retried, dead: result.dead,
    duration_ms: Date.now() - startedAt,
  }).catch(() => {});

  return NextResponse.json({ ok: true, mode: provider.mode, ...result });
}
