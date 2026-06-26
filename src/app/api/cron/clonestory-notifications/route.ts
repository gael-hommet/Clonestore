// CloneStory — déclencheur du worker d'outbox de NOTIFICATIONS générales (cron sécurisé,
// CS-FINAL 4). Fail-closed : sans secret → 503 ; Bearer absent/erroné → 401. Logs sans
// email complet ni secret. Déclenché par Supabase Cron (pg_cron + pg_net).

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processNotificationsOutbox } from "@/lib/clonestory/founding-partners/server/notifications";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };

function cronSecret(): string {
  return (process.env.CLONESTORY_OUTBOX_CRON_SECRET ?? process.env.CRON_SECRET ?? "").trim();
}

function authorize(req: Request): "ok" | "unconfigured" | "denied" {
  const secret = cronSecret();
  if (!secret) return "unconfigured";
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
  if (state === "unconfigured") return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503, headers: NO_STORE });
  if (state === "denied") return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  try {
    const result = await processNotificationsOutbox(50);
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export const GET = run;
export const POST = run;
