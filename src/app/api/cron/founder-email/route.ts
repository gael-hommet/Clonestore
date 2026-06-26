// Supabase Cron → moteur email Founder Access. Le déclencheur appelle ce GET avec
// `Authorization: Bearer ${CRON_SECRET}` ; on relaie ensuite vers la route interne
// email-tick (POST) en présentant CLONESTORE_FOUNDER_EMAIL_CRON_SECRET.
// AUTH : UNIQUEMENT l'en-tête `Authorization: Bearer …` (jamais de `?secret=`, pour
// qu'aucun secret n'apparaisse dans une URL ni dans les journaux HTTP).

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${cronSecret}`;
}

function getOrigin(req: Request): string | null {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : null;
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "Missing CRON_SECRET" }, { status: 500 });
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const emailSecret = process.env.CLONESTORE_FOUNDER_EMAIL_CRON_SECRET;
  if (!emailSecret) return NextResponse.json({ ok: false, error: "email_cron_secret_missing" }, { status: 503 });

  const origin = getOrigin(req);
  if (!origin) return NextResponse.json({ ok: false, error: "Cannot determine origin" }, { status: 500 });

  const res = await fetch(`${origin}/api/internal/founder-access/email-tick`, {
    method: "POST",
    headers: { "x-cron-secret": emailSecret },
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "content-type": "application/json" } });
}
