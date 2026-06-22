// BLOC 3 — Endpoint conversion events (first-party).
//
// Accepte UNIQUEMENT les événements client de l'allowlist (cf. contract.ts).
// Les événements serveur (variant_assigned, checkout_*, onboarding_*,
// pierre_activated) ne peuvent JAMAIS être déclenchés via ce endpoint.
//
// La session est lue dans le cookie cs_conversion_session (signé). Toute
// session id présente dans le corps est IGNORÉE — politique "trust the cookie".

import { NextResponse, type NextRequest } from "next/server";
import { readConversionSessionId } from "@/lib/clonestore/conversion/session";
import { recordConversionEvent, getConversionSession } from "@/lib/clonestore/conversion/storage";
import { isClientAcceptedEvent, isIdempotencyKey } from "@/lib/clonestore/conversion/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, data: unknown) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const sessionId = readConversionSessionId(cookieHeader);
  if (!sessionId) {
    // Pas de session validée → on accepte silencieusement (204) sans rien
    // persister. Pas d'enrichissement basé sur des headers client.
    return new NextResponse(null, { status: 204 });
  }
  const session = getConversionSession(sessionId);
  if (!session) {
    return new NextResponse(null, { status: 204 });
  }

  // Limite de taille du payload pour éviter abuse (8 KB suffisent largement).
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 8 * 1024) {
    return json(413, { ok: false, error: "payload_too_large" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json(400, { ok: false, error: "invalid_payload" });
  }
  const b = body as Record<string, unknown>;
  const eventIdRaw = typeof b.event_id === "string" ? b.event_id : null;
  const idempotencyRaw = typeof b.idempotency_key === "string" ? b.idempotency_key : null;
  if (!eventIdRaw || !isClientAcceptedEvent(eventIdRaw)) {
    return json(422, { ok: false, error: "event_not_allowed_from_client" });
  }
  if (!idempotencyRaw || !isIdempotencyKey(idempotencyRaw)) {
    return json(400, { ok: false, error: "idempotency_key_invalid" });
  }

  const metaRaw = b.metadata;
  const meta: Record<string, string | number | boolean | null> = {};
  if (metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)) {
    for (const [k, v] of Object.entries(metaRaw as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
        meta[k] = v;
      }
    }
  }

  const result = recordConversionEvent({
    sessionId,
    eventId: eventIdRaw,
    idempotencyKey: idempotencyRaw,
    metadata: meta,
  });
  if (!result.ok) return json(409, { ok: false, error: result.reason ?? "conflict" });
  return json(200, { ok: true, duplicate: Boolean(result.duplicate) });
}

export async function GET() {
  return json(405, { ok: false, error: "method_not_allowed" });
}
