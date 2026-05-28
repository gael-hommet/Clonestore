// B47 — Pierre Legal Guardrails Route
// GET /api/pierre/legal/guardrails?action=<action>&text=<text>
// Evaluates an action or text for legal safety using Pierre guardrails.
// No Supabase required — pure computation.

import { NextRequest, NextResponse } from "next/server";
import { evaluatePierreActionLegalSafety, enforcePierreLegalGuardrails } from "../../../../../lib/pierre/legal/pierre-legal-guardrails";
import { classifyHrTextCategory } from "../../../../../lib/pierre/legal/pierre-legal-taxonomy";

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action")?.trim() ?? null;
  const text = searchParams.get("text")?.trim() ?? null;

  if (!action && !text) {
    return jsonError("Paramètre 'action' ou 'text' requis.", 400, { code: "MISSING_PARAM" });
  }

  const input = action ?? text ?? "";
  const category = classifyHrTextCategory(input);
  const evaluation = evaluatePierreActionLegalSafety(input, text ?? undefined);
  const guardrail = enforcePierreLegalGuardrails(input, text ?? undefined);

  return NextResponse.json({
    ok: true,
    allowed: guardrail.allowed,
    reason: guardrail.reason,
    category,
    evaluation,
    meta: {
      action: action ?? null,
      text_excerpt: text ? text.slice(0, 100) : null,
      evaluatedAt: new Date().toISOString(),
      route: "/api/pierre/legal/guardrails",
    },
  });
}
