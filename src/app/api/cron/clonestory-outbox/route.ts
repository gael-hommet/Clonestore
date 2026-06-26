// CloneStory — déclencheur du worker d'outbox email (cron sécurisé).
// Protégé par un secret lu AU RUNTIME, comparé en temps constant. FAIL-CLOSED :
// sans secret configuré → 503 (jamais ouvert publiquement). Secret absent/erroné
// dans la requête → 401. Déclenché périodiquement par Vercel Cron (vercel.json).
// Logs sans email complet ni token.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processVerificationOutbox } from "@/lib/clonestory/founding-partners/server/store";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };

function cronSecret(): string {
  return (process.env.CLONESTORY_OUTBOX_CRON_SECRET ?? process.env.CRON_SECRET ?? "").trim();
}

function authorize(req: Request): "ok" | "unconfigured" | "denied" {
  const secret = cronSecret();
  if (!secret) return "unconfigured"; // fail-closed
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : (req.headers.get("x-cron-secret") ?? "");
  if (!provided) return "denied";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "denied";
  return "ok";
}

async function run(req: Request) {
  const state = authorize(req);
  if (state === "unconfigured") {
    return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503, headers: NO_STORE });
  }
  if (state === "denied") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  try {
    const result = await processVerificationOutbox(50);
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export const GET = run;
export const POST = run;
