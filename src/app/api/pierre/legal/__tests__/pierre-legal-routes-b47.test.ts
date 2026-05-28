// B47 — Pierre Legal API Routes Tests
// Tests the pure logic behind /api/pierre/legal/guardrails (GET),
// /api/pierre/legal/validate-output (POST), and /api/pierre/legal/readiness (GET).
// Simulates route handlers without Next.js or Supabase.

import { describe, it, expect } from "vitest";

// Legal guardrails (route: GET /api/pierre/legal/guardrails)
import {
  evaluatePierreActionLegalSafety,
  enforcePierreLegalGuardrails,
} from "@/lib/pierre/legal/pierre-legal-guardrails";
import { classifyHrTextCategory } from "@/lib/pierre/legal/pierre-legal-taxonomy";

// Validate-output route logic (POST /api/pierre/legal/validate-output)
import { evaluateOutputLegalCommercialSafety } from "@/lib/legal-commercial/output-guardrails";
import { assertNoForbiddenLegalCommercialPhrases } from "@/lib/legal-commercial/forbidden-phrases";
import { assertDocumentDoesNotClaimLegalFinality } from "@/lib/pierre/legal/pierre-document-legal-policy";

// Readiness route logic (GET /api/pierre/legal/readiness)
import { buildLegalCommercialVerdict } from "@/lib/legal-commercial/legal-verdict";
import { buildPierreLegalVerdict } from "@/lib/pierre/legal/pierre-legal-verdict";
import { buildB47AcceptanceChecklist, getB48LegalPrerequisites } from "@/lib/legal-commercial/acceptance-checklist";
import { buildPayrollCapabilitySummary } from "@/lib/pierre/legal/pierre-payroll-policy";
import { buildEmailCapabilitySummary } from "@/lib/pierre/legal/pierre-email-legal-policy";
import {
  getAllPierreSafeClaims,
  getAllPierreForbiddenClaims,
} from "@/lib/pierre/legal/pierre-commercial-claims";

import type { OutputContext } from "@/lib/legal-commercial/types";

// ── Simulate-route helpers ────────────────────────────────────────────────────

function simulateGuardrailsGet(searchParams: { action?: string; text?: string }): {
  status: number;
  ok: boolean;
  error?: string;
  code?: string;
  allowed?: boolean;
  reason?: string | null;
  category?: string;
} {
  const action = searchParams.action?.trim() ?? null;
  const text = searchParams.text?.trim() ?? null;

  if (!action && !text) {
    return { status: 400, ok: false, error: "Paramètre 'action' ou 'text' requis.", code: "MISSING_PARAM" };
  }

  const input = action ?? text ?? "";
  const category = classifyHrTextCategory(input);
  const evaluation = evaluatePierreActionLegalSafety(input, text ?? undefined);
  const guardrail = enforcePierreLegalGuardrails(input, text ?? undefined);

  return {
    status: 200,
    ok: true,
    allowed: guardrail.allowed,
    reason: guardrail.reason,
    category,
  };
}

function simulateValidateOutputPost(body: Record<string, unknown>): {
  status: number;
  ok: boolean;
  error?: string;
  code?: string;
  guardrail?: ReturnType<typeof evaluateOutputLegalCommercialSafety>;
  forbidden_phrases?: { ok: boolean; violations: string[] };
  legal_finality?: { ok: boolean; violations: string[] };
} {
  const text = typeof body.text === "string" ? body.text.trim() : null;
  if (!text) {
    return { status: 400, ok: false, error: "Champ 'text' requis.", code: "TEXT_REQUIRED" };
  }

  const context: OutputContext = {
    surface: (typeof body.surface === "string" ? body.surface : "cockpit") as OutputContext["surface"],
    domain: typeof body.domain === "string" ? body.domain : "hr",
    is_sensitive: body.is_sensitive === true || body.is_sensitive === "true",
    is_official_document: body.is_official_document === true || body.is_official_document === "true",
    is_public_claim: body.is_public_claim === true || body.is_public_claim === "true",
    is_demo: body.is_demo === true || body.is_demo === "true",
    is_paid_customer: body.is_paid_customer === true || body.is_paid_customer === "true",
  };

  const guardrailResult = evaluateOutputLegalCommercialSafety(text, context);
  const phraseCheck = assertNoForbiddenLegalCommercialPhrases(text);
  const legalFinalityCheck = assertDocumentDoesNotClaimLegalFinality(text);

  return {
    status: 200,
    ok: guardrailResult.ok && phraseCheck.ok && legalFinalityCheck.ok,
    guardrail: guardrailResult,
    forbidden_phrases: { ok: phraseCheck.ok, violations: phraseCheck.violations },
    legal_finality: { ok: legalFinalityCheck.ok, violations: legalFinalityCheck.violations },
  };
}

function simulateReadinessGet(): {
  status: number;
  ok: boolean;
  legal_verdict: ReturnType<typeof buildLegalCommercialVerdict>;
  pierre_verdict: ReturnType<typeof buildPierreLegalVerdict>;
  checklist: { total: number; blocking_b48: number };
  capabilities: { payroll: ReturnType<typeof buildPayrollCapabilitySummary>; email: ReturnType<typeof buildEmailCapabilitySummary> };
  claims: { safe_count: number; forbidden_count: number };
} {
  const legalVerdict = buildLegalCommercialVerdict();
  const pierreVerdict = buildPierreLegalVerdict();
  const checklist = buildB47AcceptanceChecklist();
  const prerequisites = getB48LegalPrerequisites();
  const payrollSummary = buildPayrollCapabilitySummary();
  const emailSummary = buildEmailCapabilitySummary();
  const safeClaims = getAllPierreSafeClaims();
  const forbiddenClaims = getAllPierreForbiddenClaims();

  return {
    status: 200,
    ok: true,
    legal_verdict: legalVerdict,
    pierre_verdict: pierreVerdict,
    checklist: { total: checklist.length, blocking_b48: prerequisites.length },
    capabilities: { payroll: payrollSummary, email: emailSummary },
    claims: { safe_count: safeClaims.length, forbidden_count: forbiddenClaims.length },
  };
}

// ── 1. GET /api/pierre/legal/guardrails ───────────────────────────────────────

describe("GET /api/pierre/legal/guardrails — param validation", () => {
  it("returns 400 when no params provided", () => {
    const res = simulateGuardrailsGet({});
    expect(res.status).toBe(400);
    expect(res.code).toBe("MISSING_PARAM");
    expect(res.ok).toBe(false);
  });

  it("returns 400 when action and text are empty strings", () => {
    const res = simulateGuardrailsGet({ action: "", text: "" });
    expect(res.status).toBe(400);
    expect(res.ok).toBe(false);
  });

  it("returns 200 when action is provided", () => {
    const res = simulateGuardrailsGet({ action: "prepare_draft" });
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
  });

  it("returns 200 when text is provided", () => {
    const res = simulateGuardrailsGet({ text: "Licenciement d'un salarié" });
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
  });
});

describe("GET /api/pierre/legal/guardrails — allowed/blocked decisions", () => {
  it("allows prepare_draft for generic action", () => {
    const res = simulateGuardrailsGet({ action: "prepare_draft" });
    expect(res.allowed).toBe(true);
  });

  it("blocks auto_send for licenciement text", () => {
    const res = simulateGuardrailsGet({ action: "auto_send", text: "licenciement" });
    expect(res.allowed).toBe(false);
    expect(res.reason).toBeTruthy();
  });

  it("blocks auto_send_sanction", () => {
    const res = simulateGuardrailsGet({ action: "auto_send_sanction" });
    expect(res.allowed).toBe(false);
  });

  it("blocks auto_decide for dismissal text", () => {
    const res = simulateGuardrailsGet({ action: "auto_decide", text: "licenciement" });
    expect(res.allowed).toBe(false);
  });
});

describe("GET /api/pierre/legal/guardrails — category classification", () => {
  it("classifies licenciement as dismissal", () => {
    const res = simulateGuardrailsGet({ text: "licenciement d'un salarié" });
    expect(res.category).toBe("dismissal");
  });

  it("classifies sanction as sanction", () => {
    const res = simulateGuardrailsGet({ text: "avertissement disciplinaire" });
    expect(res.category).toBe("sanction");
  });

  it("classifies paie as payroll", () => {
    const res = simulateGuardrailsGet({ text: "bulletins de paie du mois" });
    expect(res.category).toBe("payroll");
  });

  it("classifies generic text as other", () => {
    const res = simulateGuardrailsGet({ text: "bonjour comment allez-vous" });
    expect(res.category).toBe("other");
  });
});

// ── 2. POST /api/pierre/legal/validate-output ─────────────────────────────────

describe("POST /api/pierre/legal/validate-output — input validation", () => {
  it("returns 400 when text is missing", () => {
    const res = simulateValidateOutputPost({});
    expect(res.status).toBe(400);
    expect(res.code).toBe("TEXT_REQUIRED");
    expect(res.ok).toBe(false);
  });

  it("returns 400 when text is empty string", () => {
    const res = simulateValidateOutputPost({ text: "" });
    expect(res.status).toBe(400);
    expect(res.ok).toBe(false);
  });

  it("returns 200 for valid text", () => {
    const res = simulateValidateOutputPost({ text: "Pierre assiste vos équipes RH." });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/pierre/legal/validate-output — safe content", () => {
  it("ok=true for safe text in cockpit context", () => {
    const res = simulateValidateOutputPost({
      text: "Pierre prépare des brouillons de documents RH sous validation humaine.",
      surface: "cockpit",
      domain: "hr",
    });
    expect(res.ok).toBe(true);
    expect(res.guardrail?.ok).toBe(true);
    expect(res.forbidden_phrases?.ok).toBe(true);
  });

  it("ok=true for safe automation claim in cockpit", () => {
    const res = simulateValidateOutputPost({
      text: "Pierre automatise une grande partie de la charge RH opérationnelle.",
      surface: "cockpit",
    });
    expect(res.ok).toBe(true);
  });
});

describe("POST /api/pierre/legal/validate-output — forbidden phrases", () => {
  it("ok=false when text contains 'remplace un avocat'", () => {
    const res = simulateValidateOutputPost({
      text: "Pierre remplace un avocat en droit du travail.",
      surface: "marketing",
      is_public_claim: true,
    });
    expect(res.ok).toBe(false);
    expect(res.forbidden_phrases?.ok).toBe(false);
  });

  it("ok=false when text contains 'garantit la conformité légale'", () => {
    const res = simulateValidateOutputPost({
      text: "Pierre garantit la conformité légale de vos documents.",
      surface: "marketing",
    });
    expect(res.ok).toBe(false);
  });

  it("ok=false when text contains 'garantit zéro erreur'", () => {
    const res = simulateValidateOutputPost({
      text: "Notre outil garantit zéro erreur.",
      surface: "cockpit",
    });
    expect(res.ok).toBe(false);
  });

  it("ok=false when text contains 'remplace la DSN'", () => {
    const res = simulateValidateOutputPost({
      text: "Pierre remplace la DSN.",
      surface: "cockpit",
    });
    expect(res.ok).toBe(false);
  });
});

describe("POST /api/pierre/legal/validate-output — legal finality check", () => {
  it("ok=false for 'valeur juridique garantie'", () => {
    const res = simulateValidateOutputPost({
      text: "Ce document a une valeur juridique garantie.",
      surface: "document",
    });
    expect(res.legal_finality?.ok).toBe(false);
    expect(res.ok).toBe(false);
  });

  it("ok=false for 'certifié par l'ia'", () => {
    const res = simulateValidateOutputPost({
      text: "Document certifié par l'IA.",
      surface: "document",
    });
    expect(res.legal_finality?.ok).toBe(false);
  });
});

describe("POST /api/pierre/legal/validate-output — context parsing", () => {
  it("accepts is_official_document=true", () => {
    const res = simulateValidateOutputPost({
      text: "Contrat de travail",
      is_official_document: true,
      is_paid_customer: true,
    });
    expect(res.status).toBe(200);
    expect(res.guardrail?.required_human_validation).toBe(true);
  });

  it("accepts is_demo=true", () => {
    const res = simulateValidateOutputPost({
      text: "Pierre aide.",
      is_demo: true,
    });
    expect(res.status).toBe(200);
  });
});

// ── 3. GET /api/pierre/legal/readiness ───────────────────────────────────────

describe("GET /api/pierre/legal/readiness — structure", () => {
  it("returns ok=true", () => {
    const res = simulateReadinessGet();
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("includes legal_verdict", () => {
    const res = simulateReadinessGet();
    expect(res.legal_verdict).toBeTruthy();
    expect(res.legal_verdict).toHaveProperty("safe_to_continue_to_b48");
  });

  it("includes pierre_verdict", () => {
    const res = simulateReadinessGet();
    expect(res.pierre_verdict).toBeTruthy();
    expect(res.pierre_verdict).toHaveProperty("safe_to_use_in_b48");
  });

  it("checklist.total is at least 10", () => {
    const res = simulateReadinessGet();
    expect(res.checklist.total).toBeGreaterThanOrEqual(10);
  });

  it("checklist.blocking_b48 is at least 5", () => {
    const res = simulateReadinessGet();
    expect(res.checklist.blocking_b48).toBeGreaterThanOrEqual(5);
  });

  it("capabilities includes payroll and email", () => {
    const res = simulateReadinessGet();
    expect(res.capabilities.payroll).toBeTruthy();
    expect(res.capabilities.email).toBeTruthy();
  });

  it("claims counts are positive", () => {
    const res = simulateReadinessGet();
    expect(res.claims.safe_count).toBeGreaterThan(0);
    expect(res.claims.forbidden_count).toBeGreaterThan(0);
  });
});

describe("GET /api/pierre/legal/readiness — verdicts content", () => {
  it("legal_verdict.safe_to_continue_to_b48 is true", () => {
    expect(simulateReadinessGet().legal_verdict.safe_to_continue_to_b48).toBe(true);
  });

  it("pierre_verdict.safe_to_use_in_b48 is true", () => {
    expect(simulateReadinessGet().pierre_verdict.safe_to_use_in_b48).toBe(true);
  });

  it("pierre_verdict.hard_limits is non-empty", () => {
    expect(simulateReadinessGet().pierre_verdict.hard_limits.length).toBeGreaterThan(0);
  });

  it("legal_verdict.legal_review_required is true", () => {
    expect(simulateReadinessGet().legal_verdict.legal_review_required).toBe(true);
  });

  it("pierre_verdict.legal_review_required is true", () => {
    expect(simulateReadinessGet().pierre_verdict.legal_review_required).toBe(true);
  });

  it("payroll summary has key_limit", () => {
    const res = simulateReadinessGet();
    expect(res.capabilities.payroll.key_limit.length).toBeGreaterThan(0);
  });

  it("email summary has key_limit mentioning approbation", () => {
    const res = simulateReadinessGet();
    expect(res.capabilities.email.key_limit.toLowerCase()).toContain("approbation");
  });
});
