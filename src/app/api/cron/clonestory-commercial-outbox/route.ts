// CloneStory — déclencheur du worker d'outbox COMMERCIALE (cron sécurisé, CS-FINAL 3).
// Protégé par un secret lu AU RUNTIME, comparé en temps constant. FAIL-CLOSED : sans
// secret configuré → 503 (jamais ouvert publiquement). Secret absent/erroné → 401.
// Déclenché périodiquement par Supabase Cron (pg_cron + pg_net, voir supabase/sql).
// Logs sans email complet ni secret.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processCommercialOutbox } from "@/lib/clonestory/founding-partners/server/commercial";
import { commercialOutboxCronSecret } from "@/lib/clonestory/founding-partners/server/config";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "no-store" };

function authorize(req: Request): "ok" | "unconfigured" | "denied" {
  const secret = commercialOutboxCronSecret();
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
    const result = await processCommercialOutbox(50);
    return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export const GET = run;
export const POST = run;
