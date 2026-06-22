// BLOC 3 — API diagnostic RH (calcul serveur déterministe).
//
// POST : reçoit les réponses, valide, calcule, renvoie le résultat.
// Aucune donnée sensible n'est acceptée (cf. sanitizeDiagnosticAnswers).
// Pas d'email obligatoire pour obtenir le résultat.

import { NextResponse, type NextRequest } from "next/server";
import { sanitizeDiagnosticAnswers } from "@/lib/clonestore/conversion/validation";
import { computeDiagnostic } from "@/lib/clonestore/conversion/diagnostic";
import { DIAGNOSTIC_VERSION } from "@/lib/clonestore/conversion/contract";
import { readConversionSessionId } from "@/lib/clonestore/conversion/session";
import { updateConversionSession, recordConversionEvent } from "@/lib/clonestore/conversion/storage";

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
  const answers = b.answers;
  const hourlyCostRaw = b.hourly_cost_eur;
  const sanitization = sanitizeDiagnosticAnswers(answers);
  if (!sanitization.ok) {
    return json(422, { ok: false, error: "diagnostic_invalid", details: sanitization.errors });
  }

  let hourlyCost: number | null = null;
  if (typeof hourlyCostRaw === "number" && Number.isFinite(hourlyCostRaw) && hourlyCostRaw > 0) {
    hourlyCost = Math.min(500, hourlyCostRaw);
  }

  const result = computeDiagnostic({
    version: DIAGNOSTIC_VERSION,
    answers: sanitization.cleaned,
    hourlyCostHypothesis: hourlyCost,
  });

  // Si une session de conversion est présente, on avance son étape et on
  // émet un événement serveur. Sinon, on calcule simplement le résultat.
  const cookieHeader = request.headers.get("cookie");
  const sessionId = readConversionSessionId(cookieHeader);
  if (sessionId) {
    updateConversionSession(sessionId, { stage: "diagnostic_completed" });
    recordConversionEvent({
      sessionId,
      eventId: "diagnostic_completed",
      idempotencyKey: `diag_completed:${sessionId}:${Date.now().toString(36).slice(-6)}`,
      metadata: {
        compatibility: result.compatibilityLevel,
        has_financial: result.estimatedFinancialRangeEur !== null,
      },
    });
  }

  return json(200, { ok: true, result });
}

export async function GET() {
  return json(405, { ok: false, error: "method_not_allowed" });
}
