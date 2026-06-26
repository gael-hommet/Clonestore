// CloneStory — diagnostic de SANTÉ interne (CS-FINAL 4). PROTÉGÉ : session admin
// propriétaire OU secret Bearer (monitoring). Aucune donnée sensible exposée : uniquement
// des compteurs/états (backlog outbox, dead-letters, events Stripe, migrations, flag).
// Fail-closed : sans aucun moyen d'authentification valide → 401.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { resolveFounderAdmin } from "@/lib/founder-access/admin-guard";
import { getHealthSnapshot, evaluateAlerts } from "@/lib/clonestory/founding-partners/server/observability";
import { registrationOpen } from "@/lib/clonestory/founding-partners/server/config";

export const dynamic = "force-dynamic";
const NO_STORE = { "cache-control": "private, no-store" };

function bearerOk(req: Request): boolean {
  const secret = (process.env.CLONESTORY_OUTBOX_CRON_SECRET ?? process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  const admin = await resolveFounderAdmin().catch(() => ({ ok: false }) as { ok: boolean });
  if (!admin.ok && !bearerOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  try {
    const health = await getHealthSnapshot(registrationOpen());
    const alerts = evaluateAlerts(health);
    return NextResponse.json({ ok: true, health, alerts }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable", databaseReachable: false }, { status: 503, headers: NO_STORE });
  }
}

export const GET = run;
export const POST = run;
