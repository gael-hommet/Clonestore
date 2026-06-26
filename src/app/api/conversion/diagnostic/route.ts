// BLOC 3 — API diagnostic RH (LeadForge-compatible).
//
// POST : reçoit les réponses, sanitize (refuse les champs interdits), calcule
//        DÉTERMINISTIQUEMENT via `compute()` (identique au Python LeadForge),
//        renvoie le résultat. Aucune donnée sensible. Aucun email obligatoire.

import { NextResponse, type NextRequest } from "next/server";
import { sanitizeDiagnosticAnswers } from "@/lib/clonestore/conversion/validation";
import { compute } from "@/lib/clonestore/conversion/diagnostic";
import { readConversionSessionId } from "@/lib/clonestore/conversion/session";
import {
  isConversionBackendAvailable,
  recordConversionEvent,
  updateConversionSession,
} from "@/lib/clonestore/conversion/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 8 * 1024) return json(413, { ok: false, error: "payload_too_large" });

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
  const sanitization = sanitizeDiagnosticAnswers(b.answers);
  if (!sanitization.ok) {
    return json(422, { ok: false, error: "diagnostic_invalid", details: sanitization.errors });
  }

  let hourly: number | null = null;
  const hourlyRaw = b.hourly_cost_eur;
  if (typeof hourlyRaw === "number" && Number.isFinite(hourlyRaw) && hourlyRaw > 0) {
    hourly = Math.min(500, hourlyRaw);
  }

  const result = compute({
    answers: sanitization.cleaned,
    monthly_cost_eur: hourly,
  });

  // Si une session conversion est présente ET que le backend est disponible :
  // on avance l'étape et on émet l'évènement.
  const cookieHeader = request.headers.get("cookie");
  const sessionId = readConversionSessionId(cookieHeader);
  if (sessionId && isConversionBackendAvailable()) {
    updateConversionSession(sessionId, { stage: "diagnostic_completed" });
    recordConversionEvent({
      sessionId,
      eventType: "diagnostic_completed",
      idempotencyKey: `diag_completed:${sessionId}:${Date.now().toString(36).slice(-6)}`,
      metadata: {
        compatibility: result.compatibility,
        missions_count: result.recommended_missions.length,
      },
    });
  }

  return json(200, { ok: true, result });
}

export async function GET() {
  return json(405, { ok: false, error: "method_not_allowed" });
}
