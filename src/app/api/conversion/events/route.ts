// BLOC 3 — Endpoint conversion events (first-party, LeadForge db9b166).
//
// Politique stricte :
//   • Allowlist d'événements client (cf. CLIENT_ALLOWED_EVENT_TYPES).
//   • Allowlist de metadata (cf. EVENT_METADATA_ALLOWED) — defense in depth.
//   • Idempotency par `idempotency_key` au format `[A-Za-z0-9_\-:.]{8,80}`.
//   • Session lue UNIQUEMENT depuis le cookie signé `cs_conversion_session`.
//     Tout id de session présent dans le corps est IGNORÉ.
//   • Aucune persistance silencieuse en production sans backend — `204` retourné.

import { NextResponse, type NextRequest } from "next/server";
import { readConversionSessionId } from "@/lib/clonestore/conversion/session";
import {
  isConversionBackendAvailable,
  recordConversionEvent,
  getConversionSession,
} from "@/lib/clonestore/conversion/storage";
import {
  isClientAcceptedEvent,
  isIdempotencyKey,
} from "@/lib/clonestore/conversion/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, data: unknown) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  // Backend absent → on accepte silencieusement (204) sans rien persister.
  if (!isConversionBackendAvailable()) {
    return new NextResponse(null, { status: 204 });
  }

  const cookieHeader = request.headers.get("cookie");
  const sessionId = readConversionSessionId(cookieHeader);
  if (!sessionId) return new NextResponse(null, { status: 204 });
  const session = getConversionSession(sessionId);
  if (!session) return new NextResponse(null, { status: 204 });

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
  const eventTypeRaw = typeof b.event_type === "string" ? b.event_type : null;
  const idempotencyRaw = typeof b.idempotency_key === "string" ? b.idempotency_key : null;
  if (!eventTypeRaw || !isClientAcceptedEvent(eventTypeRaw)) {
    return json(422, { ok: false, error: "event_not_allowed_from_client" });
  }
  if (!idempotencyRaw || !isIdempotencyKey(idempotencyRaw)) {
    return json(400, { ok: false, error: "idempotency_key_invalid" });
  }

  const meta = b.metadata;
  const result = recordConversionEvent({
    sessionId,
    eventType: eventTypeRaw,
    idempotencyKey: idempotencyRaw,
    sourcePage: typeof b.source_page === "string" ? b.source_page.slice(0, 80) : null,
    metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {},
  });
  if (!result.ok) return json(409, { ok: false, error: result.reason ?? "conflict" });
  return json(200, { ok: true, duplicate: Boolean(result.duplicate) });
}

export async function GET() {
  return json(405, { ok: false, error: "method_not_allowed" });
}
