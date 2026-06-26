// E-R1 §11 — GET/POST /api/founder-access/unsubscribe (public, lien email signé).
// GET ne MUTE JAMAIS l'état (un scanner d'email ne doit pas désinscrire) : il vérifie
// le jeton HMAC et affiche une page de confirmation avec un formulaire POST.
// POST effectue la désinscription (idempotent). Jeton invalide → refus.
import { NextResponse } from "next/server";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { verifyUnsubscribeToken } from "@/lib/founder-access/mailing-links";
import { unsubscribeReservation } from "@/lib/founder-access/store";
import { distributedRateLimit, hashIp, getClientIp, readJsonBounded } from "@/lib/founder-access/request-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function htmlPage(status: number, inner: string): NextResponse {
  const body = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Désinscription</title><body style="font-family:system-ui;max-width:520px;margin:80px auto;padding:0 20px;color:#1a1f2b">${inner}</body>`;
  return new NextResponse(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function validParams(url: URL): { rid: string; token: string } | null {
  const rid = url.searchParams.get("rid") ?? "";
  const token = url.searchParams.get("token");
  if (!UUID_RE.test(rid) || !verifyUnsubscribeToken(rid, token)) return null;
  return { rid, token: token! };
}

// GET = confirmation SANS mutation.
export async function GET(req: Request) {
  const p = validParams(new URL(req.url));
  if (!p) return htmlPage(400, `<h1 style="font-size:20px">Lien invalide ou expiré.</h1><p style="color:#5c6675">Ce lien de désinscription n'est pas valide.</p>`);
  return htmlPage(200,
    `<h1 style="font-size:20px">Confirmer la désinscription</h1>
     <p style="color:#5c6675">Vous ne recevrez plus d'emails concernant l'accès fondateur à Pierre.</p>
     <form method="post" action="/api/founder-access/unsubscribe?rid=${encodeURIComponent(p.rid)}&token=${encodeURIComponent(p.token)}">
       <button type="submit" style="margin-top:16px;background:#6b63e8;color:#fff;border:0;border-radius:999px;padding:12px 22px;font-weight:700;cursor:pointer">Me désinscrire</button>
     </form>`);
}

// POST = désinscription effective (idempotent). Accepte le one-click (RFC 8058).
export async function POST(req: Request) {
  // Les paramètres peuvent venir de la query (formulaire) ou du corps (one-click).
  const url = new URL(req.url);
  let params = validParams(url);
  if (!params) {
    const body = await readJsonBounded<{ rid?: unknown; token?: unknown }>(req).catch(() => null);
    if (body && typeof body.rid === "string" && typeof body.token === "string"
      && UUID_RE.test(body.rid) && verifyUnsubscribeToken(body.rid, body.token)) {
      params = { rid: body.rid, token: body.token };
    }
  }
  if (!params) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400, headers: { "cache-control": "no-store" } });

  const db = await getRuntimeDb();
  const rl = await distributedRateLimit(db, `unsub:${hashIp(getClientIp(req)) ?? "anon"}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  await unsubscribeReservation(db, params.rid); // idempotent
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return htmlPage(200, `<h1 style="font-size:20px">Vous êtes désinscrit.</h1><p style="color:#5c6675">Votre réservation reste enregistrée si vous changez d'avis.</p>`);
  }
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
