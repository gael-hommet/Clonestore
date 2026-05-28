// B47 — Pierre Legal Validate Output Route
// POST /api/pierre/legal/validate-output
// Validates text content against legal/commercial guardrails.
// No Supabase required — pure computation.

import { NextRequest, NextResponse } from "next/server";
import { evaluateOutputLegalCommercialSafety } from "../../../../../lib/legal-commercial/output-guardrails";
import { assertNoForbiddenLegalCommercialPhrases } from "../../../../../lib/legal-commercial/forbidden-phrases";
import { assertDocumentDoesNotClaimLegalFinality } from "../../../../../lib/pierre/legal/pierre-document-legal-policy";
import type { OutputContext } from "../../../../../lib/legal-commercial/types";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : null; }
  return null;
}

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "1";
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

function buildContextFromBody(body: Record<string, unknown>): OutputContext {
  return {
    surface: (asString(body.surface) ?? "cockpit") as OutputContext["surface"],
    domain: (asString(body.domain) ?? "hr") as OutputContext["domain"],
    is_sensitive: asBool(body.is_sensitive),
    is_official_document: asBool(body.is_official_document),
    is_public_claim: asBool(body.is_public_claim),
    is_demo: asBool(body.is_demo),
    is_paid_customer: asBool(body.is_paid_customer),
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    const raw = await request.json();
    if (isObject(raw)) body = raw;
  } catch { /* empty body */ }

  const text = asString(body.text);
  if (!text) {
    return jsonError("Champ 'text' requis.", 400, { code: "TEXT_REQUIRED" });
  }

  const context = buildContextFromBody(body);
  const guardrailResult = evaluateOutputLegalCommercialSafety(text, context);
  const phraseCheck = assertNoForbiddenLegalCommercialPhrases(text);
  const legalFinalityCheck = assertDocumentDoesNotClaimLegalFinality(text);

  const isFullyOk = guardrailResult.ok && phraseCheck.ok && legalFinalityCheck.ok;

  return NextResponse.json({
    ok: isFullyOk,
    guardrail: guardrailResult,
    forbidden_phrases: {
      ok: phraseCheck.ok,
      violations: phraseCheck.violations,
    },
    legal_finality: {
      ok: legalFinalityCheck.ok,
      violations: legalFinalityCheck.violations,
    },
    meta: {
      text_length: text.length,
      context,
      validatedAt: new Date().toISOString(),
      route: "/api/pierre/legal/validate-output",
    },
  });
}
