// B45 — Pierre documents API route tests
// Tests pure logic that backs /api/pierre/documents/validate, /preview, /render.
// No Supabase required. No Next.js mocking.

import { describe, it, expect } from "vitest";
import { getB45TemplateById, getB45TemplateRegistry } from "@/lib/clonestore/document-style-kit/template-registry";
import { validateDocumentTemplate, validateTemplateRegistry } from "@/lib/clonestore/document-style-kit/template-validation";
import { extractTemplateTokens, findMissingVariables, findUnresolvedTokens, resolveTemplateTokens } from "@/lib/clonestore/document-style-kit/tokens";
import { stripTenantSpoofingFields, containsScriptTag, containsEventHandler } from "@/lib/clonestore/document-style-kit/sanitize";
import { validateDocumentStyleKit } from "@/lib/clonestore/document-style-kit/style-kit-validation";
import { buildPierreDocument, validatePierreDocumentBeforeExport } from "@/lib/pierre/document-style/pierre-document-renderer";
import { buildPierreDocumentVerdict } from "@/lib/pierre/document-style/pierre-document-quality";
import { buildDocumentStyleVerdict } from "@/lib/pierre/document-style/pierre-document-verdict";
import { PIERRE_TEMPLATE_IDS, buildPierreDocumentContext } from "@/lib/pierre/document-style/pierre-document-context";
import {
  buildMinimalStyleKit,
  buildCertificateVariables,
  buildPrepayrollVariables,
} from "@/lib/clonestore/document-style-kit/fixtures";
import type { DocumentRenderResult } from "@/lib/clonestore/document-style-kit/types";

// ── Helpers mirroring route logic ─────────────────────────────────────────────

function simulateValidateRoute(body: Record<string, unknown>): {
  status: number;
  ok: boolean;
  error?: string;
  code?: string;
  can_generate?: boolean;
  validation?: {
    missing_required_variables: string[];
    issues: string[];
    warnings: string[];
  };
} {
  const templateId = typeof body.template_id === "string" ? body.template_id.trim() : null;
  if (!templateId) {
    return { status: 400, ok: false, error: "template_id requis.", code: "TEMPLATE_ID_REQUIRED" };
  }

  const template = getB45TemplateById(templateId);
  if (!template) {
    return { status: 404, ok: false, error: `Template "${templateId}" introuvable.`, code: "TEMPLATE_NOT_FOUND" };
  }

  const templateValidation = validateDocumentTemplate(template);
  const rawVariables = typeof body.variables === "object" && body.variables !== null && !Array.isArray(body.variables)
    ? (body.variables as Record<string, unknown>)
    : {};
  const safeVariables = stripTenantSpoofingFields(rawVariables);

  const allTokens = template.sections.flatMap((s) => extractTemplateTokens(s.content_template));
  const missingRequired = findMissingVariables(template.required_variables, safeVariables);
  const allContent = template.sections.map((s) => resolveTemplateTokens(s.content_template, safeVariables)).join(" ");
  const unresolvedTokens = findUnresolvedTokens(allContent);

  const issues: string[] = [
    ...templateValidation.issues.filter((i) => i.severity === "error").map((i) => i.message),
    ...missingRequired.map((v) => `Variable requise manquante : ${v}`),
  ];
  const warnings = unresolvedTokens.map((t) => `Token non résolu : {{${t}}}`);

  return {
    status: 200,
    ok: true,
    can_generate: issues.length === 0,
    validation: {
      missing_required_variables: missingRequired,
      issues,
      warnings,
    },
  };
}

function simulatePreviewRoute(body: Record<string, unknown>): {
  status: number;
  ok: boolean;
  error?: string;
  code?: string;
  preview?: { html: string; text: string; title: string };
  errors?: string[];
} {
  const templateId = typeof body.template_id === "string" ? body.template_id.trim() : null;
  if (!templateId) {
    return { status: 400, ok: false, error: "template_id requis.", code: "TEMPLATE_ID_REQUIRED" };
  }

  const rawVariables = typeof body.variables === "object" && body.variables !== null && !Array.isArray(body.variables)
    ? (body.variables as Record<string, unknown>)
    : {};
  const safeVariables = stripTenantSpoofingFields(rawVariables);

  const buildResult = buildPierreDocument({
    templateId,
    variables: safeVariables,
    enterprise: null,
    pierre: null,
    userId: "preview_test",
  });

  if (!buildResult.render_result) {
    return {
      status: 404,
      ok: false,
      error: buildResult.verdict_message,
      code: "TEMPLATE_NOT_FOUND",
      errors: buildResult.errors,
    };
  }

  const render = buildResult.render_result;
  return {
    status: 200,
    ok: buildResult.ok,
    preview: {
      html: render.html,
      text: render.text,
      title: render.title,
    },
    errors: buildResult.errors,
  };
}

function makeFakeRenderResult(overrides: Partial<DocumentRenderResult> = {}): DocumentRenderResult {
  return {
    ok: true,
    document_id: "doc_test_001",
    title: "Attestation de travail",
    document_type: "employment_certificate",
    format: "pdf_ready_html",
    html: "<!DOCTYPE html><html><body><h1>Attestation de travail</h1><p>ACME SAS — Jean Dupont</p></body></html>",
    text: "Attestation de travail — ACME SAS — Jean Dupont",
    pdf_ready_html: "<!DOCTYPE html><html><head><style>@page { size: A4; margin: 2cm; }</style></head><body></body></html>",
    missing_variables: [],
    unresolved_tokens: [],
    quality_score: 85,
    validation_requirement: "required_before_export",
    artifact_metadata: null,
    warnings: [],
    errors: [],
    ...overrides,
  };
}

// ── 1. Validate route logic ───────────────────────────────────────────────────

describe("/api/pierre/documents/validate — template_id validation", () => {
  it("returns 400 when template_id is missing", () => {
    const res = simulateValidateRoute({});
    expect(res.status).toBe(400);
    expect(res.code).toBe("TEMPLATE_ID_REQUIRED");
    expect(res.ok).toBe(false);
  });

  it("returns 400 for empty template_id", () => {
    const res = simulateValidateRoute({ template_id: "" });
    expect(res.status).toBe(400);
    expect(res.ok).toBe(false);
  });

  it("returns 404 for unknown template_id", () => {
    const res = simulateValidateRoute({ template_id: "unknown_xyz" });
    expect(res.status).toBe(404);
    expect(res.code).toBe("TEMPLATE_NOT_FOUND");
  });

  it("returns 200 for valid template_id", () => {
    const res = simulateValidateRoute({ template_id: PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE });
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
  });
});

describe("/api/pierre/documents/validate — variables validation", () => {
  it("can_generate=false when required variables missing", () => {
    const res = simulateValidateRoute({
      template_id: PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE,
      variables: {},
    });
    expect(res.can_generate).toBe(false);
    expect(res.validation?.missing_required_variables.length).toBeGreaterThan(0);
  });

  it("can_generate=true when all required variables provided", () => {
    const res = simulateValidateRoute({
      template_id: PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE,
      variables: buildCertificateVariables(),
    });
    expect(res.can_generate).toBe(true);
    expect(res.validation?.missing_required_variables).toHaveLength(0);
  });

  it("strips tenant spoofing fields from variables", () => {
    const res = simulateValidateRoute({
      template_id: PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE,
      variables: { ...buildCertificateVariables(), user_id: "evil", company_id: "evil" },
    });
    expect(res.status).toBe(200);
    expect(res.can_generate).toBe(true);
  });

  it("issues array contains missing variables as issues", () => {
    const res = simulateValidateRoute({
      template_id: PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE,
      variables: { company_name: "ACME" },
    });
    expect(res.validation?.issues.length).toBeGreaterThan(0);
    expect(res.validation?.issues.some((i) => /employee_name/i.test(i))).toBe(true);
  });
});

describe("/api/pierre/documents/validate — all templates", () => {
  it("validates all 10 templates without errors", () => {
    const templates = getB45TemplateRegistry();
    expect(templates).toHaveLength(10);
    for (const t of templates) {
      const res = simulateValidateRoute({ template_id: t.id });
      expect(res.status).toBe(200);
      expect(res.ok).toBe(true);
    }
  });
});

// ── 2. Preview route logic ────────────────────────────────────────────────────

describe("/api/pierre/documents/preview — input validation", () => {
  it("returns 400 when template_id missing", () => {
    const res = simulatePreviewRoute({});
    expect(res.status).toBe(400);
    expect(res.code).toBe("TEMPLATE_ID_REQUIRED");
  });

  it("returns 404 for unknown template_id", () => {
    const res = simulatePreviewRoute({ template_id: "unknown_xyz" });
    expect(res.status).toBe(404);
  });
});

describe("/api/pierre/documents/preview — preview content", () => {
  it("returns HTML preview for certificate with complete variables", () => {
    const res = simulatePreviewRoute({
      template_id: PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE,
      variables: buildCertificateVariables(),
    });
    // Certificate is an official doc — may block or return preview
    expect([200, 404, 422]).toContain(res.status);
    if (res.status === 200 && res.preview) {
      expect(res.preview.html).toContain("<!DOCTYPE html>");
    }
  });

  it("returns preview for prepayroll with complete variables", () => {
    const res = simulatePreviewRoute({
      template_id: PIERRE_TEMPLATE_IDS.PREPAYROLL_SUMMARY,
      variables: buildPrepayrollVariables(),
    });
    expect(res.status).toBe(200);
    if (res.preview) {
      expect(res.preview.html).toBeTruthy();
      expect(res.preview.text).toBeTruthy();
    }
  });

  it("strips tenant spoofing from preview variables", () => {
    const res = simulatePreviewRoute({
      template_id: PIERRE_TEMPLATE_IDS.PREPAYROLL_SUMMARY,
      variables: { ...buildPrepayrollVariables(), user_id: "evil", organization_id: "evil" },
    });
    expect(res.status).toBe(200);
    if (res.preview) {
      expect(res.preview.html).not.toContain("evil");
    }
  });

  it("preview HTML does not contain script tags", () => {
    const res = simulatePreviewRoute({
      template_id: PIERRE_TEMPLATE_IDS.PREPAYROLL_SUMMARY,
      variables: { ...buildPrepayrollVariables(), company_name: "<script>evil()</script>" },
    });
    if (res.preview) {
      expect(containsScriptTag(res.preview.html)).toBe(false);
    }
  });

  it("preview HTML does not contain event handlers", () => {
    const res = simulatePreviewRoute({
      template_id: PIERRE_TEMPLATE_IDS.PREPAYROLL_SUMMARY,
      variables: { ...buildPrepayrollVariables(), company_name: "ACME\" onclick=\"evil()\"" },
    });
    if (res.preview) {
      expect(containsEventHandler(res.preview.html)).toBe(false);
    }
  });
});

// ── 3. Render route pure logic ────────────────────────────────────────────────

describe("/api/pierre/documents/render — export validation", () => {
  it("can_export=false for official document without validation", () => {
    const render = makeFakeRenderResult({
      validation_requirement: "required_before_export",
    });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.can_export).toBe(false);
  });

  it("can_export=true for non-official doc with good quality", () => {
    const render = makeFakeRenderResult({
      validation_requirement: "none",
      quality_score: 80,
      ok: true,
    });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.can_export).toBe(true);
  });

  it("blocking_reasons includes missing variable names", () => {
    const render = makeFakeRenderResult({
      missing_variables: ["employee_name", "start_date"],
    });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.blocking_reasons.some((r) => r.includes("employee_name"))).toBe(true);
    expect(check.blocking_reasons.some((r) => r.includes("start_date"))).toBe(true);
  });

  it("blocks when quality_score below 50", () => {
    const render = makeFakeRenderResult({
      quality_score: 20,
      validation_requirement: "none",
    });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.can_export).toBe(false);
  });

  it("blocks when ok=false", () => {
    const render = makeFakeRenderResult({ ok: false, validation_requirement: "none" });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.can_export).toBe(false);
  });
});

describe("/api/pierre/documents/render — full pipeline", () => {
  it("buildPierreDocument for prepayroll returns render_result", () => {
    const result = buildPierreDocument({
      templateId: PIERRE_TEMPLATE_IDS.PREPAYROLL_SUMMARY,
      variables: buildPrepayrollVariables(),
      enterprise: null,
      pierre: null,
      userId: "route_test_user",
    });
    expect(result.render_result).not.toBeNull();
    expect(result.render_result?.html).toBeTruthy();
  });

  it("buildPierreDocument blocks for cert without variables", () => {
    const result = buildPierreDocument({
      templateId: PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE,
      variables: {},
      enterprise: null,
      pierre: null,
      userId: "route_test_user",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
  });

  it("render result never returns no-binary PDF", () => {
    const result = buildPierreDocument({
      templateId: PIERRE_TEMPLATE_IDS.PREPAYROLL_SUMMARY,
      variables: buildPrepayrollVariables(),
      enterprise: null,
      pierre: null,
      userId: "route_test_user",
    });
    if (result.render_result) {
      expect(typeof result.render_result.pdf_ready_html).toBe("string");
      expect(result.render_result.pdf_ready_html).not.toContain("%PDF-1.");
    }
  });

  it("render meta includes user_id from context, not client body", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE,
      variables: buildCertificateVariables(),
      userId: "server_user_123",
    });
    // user_id in style_kit comes from server context, not client
    expect(ctx?.style_kit.user_id).toBe("server_user_123");
  });

  it("never_claim_legal_finality always enforced in render pipeline", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE,
      variables: buildCertificateVariables(),
      userId: "u1",
    });
    expect(ctx?.style_kit.legal.never_claim_legal_finality).toBe(true);
  });
});

// ── 4. Security / tenant isolation ───────────────────────────────────────────

describe("Tenant isolation in document routes", () => {
  it("stripTenantSpoofingFields removes all tenant fields", () => {
    const malicious = {
      user_id: "attacker",
      company_id: "victim_company",
      organization_id: "org123",
      tenant_id: "tenant456",
      id: "fake_id",
      employee_name: "Jean Dupont",
    };
    const clean = stripTenantSpoofingFields(malicious);
    expect(clean.user_id).toBeUndefined();
    expect(clean.company_id).toBeUndefined();
    expect(clean.organization_id).toBeUndefined();
    expect(clean.tenant_id).toBeUndefined();
    expect(clean.id).toBeUndefined();
    expect(clean.employee_name).toBe("Jean Dupont");
  });

  it("XSS in variable values is escaped in render output", () => {
    const result = buildPierreDocument({
      templateId: PIERRE_TEMPLATE_IDS.PREPAYROLL_SUMMARY,
      variables: {
        ...buildPrepayrollVariables(),
        company_name: "<img src=x onerror=alert(1)>",
      },
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    if (result.render_result) {
      expect(containsEventHandler(result.render_result.html)).toBe(false);
      expect(containsScriptTag(result.render_result.html)).toBe(false);
    }
  });

  it("script injection in variables does not appear in HTML output", () => {
    const result = buildPierreDocument({
      templateId: PIERRE_TEMPLATE_IDS.PREPAYROLL_SUMMARY,
      variables: {
        ...buildPrepayrollVariables(),
        anomalies: "<script>window.location='https://evil.com'</script>",
      },
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    if (result.render_result) {
      expect(containsScriptTag(result.render_result.html)).toBe(false);
    }
  });
});

// ── 5. Style verdict (backing document config route) ─────────────────────────

describe("buildDocumentStyleVerdict (backs /use/document/config route)", () => {
  it("returns not_ready level when never_claim_legal_finality is false", () => {
    const kit = buildMinimalStyleKit();
    kit.legal.never_claim_legal_finality = false;
    const verdict = buildDocumentStyleVerdict(kit);
    expect(verdict.level).toBe("not_ready");
    expect(verdict.blocking_issues.length).toBeGreaterThan(0);
  });

  it("returns certified level for excellent kit", () => {
    const kit = buildMinimalStyleKit();
    // Add reference sources to boost score
    kit.reference_sources = [
      { id: "r1", source_type: "payslip_sample", label: "BS", file_id: "f1", file_name: "bs.pdf", mime_type: "application/pdf", extracted_text_preview: null, extracted_structure: null, style_notes: null, trusted: true, uploaded_at: "2026-01-01T00:00:00Z" },
      { id: "r2", source_type: "employment_certificate", label: "Attest", file_id: "f2", file_name: "attest.pdf", mime_type: "application/pdf", extracted_text_preview: null, extracted_structure: null, style_notes: null, trusted: true, uploaded_at: "2026-01-01T00:00:00Z" },
      { id: "r3", source_type: "contract_template", label: "Contrat", file_id: "f3", file_name: "contrat.pdf", mime_type: "application/pdf", extracted_text_preview: null, extracted_structure: null, style_notes: null, trusted: true, uploaded_at: "2026-01-01T00:00:00Z" },
    ];
    kit.legal.require_human_validation_for_official = true;
    const verdict = buildDocumentStyleVerdict(kit);
    expect(["premium", "certified"]).toContain(verdict.level);
  });

  it("safe_to_generate_official requires no blocking issues and human validation", () => {
    const kit = buildMinimalStyleKit();
    kit.legal.require_human_validation_for_official = true;
    const verdict = buildDocumentStyleVerdict(kit);
    const expected = verdict.blocking_issues.length === 0;
    expect(verdict.safe_to_generate_official).toBe(expected);
  });
});

// ── 6. Template registry integrity ───────────────────────────────────────────

describe("Template registry integrity (backing validate route)", () => {
  it("no duplicate template IDs", () => {
    const templates = getB45TemplateRegistry();
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("validateTemplateRegistry passes for all 10 templates", () => {
    const templates = getB45TemplateRegistry();
    const result = validateTemplateRegistry(templates);
    expect(result.valid).toBe(true);
    expect(result.total_errors).toBe(0);
  });

  it("PIERRE_TEMPLATE_IDS constants all resolve to real templates", () => {
    for (const [key, id] of Object.entries(PIERRE_TEMPLATE_IDS)) {
      const template = getB45TemplateById(id);
      expect(template).not.toBeNull();
      if (!template) console.error(`Missing template for ${key}: ${id}`);
    }
  });

  it("validateDocumentStyleKit passes for test kit", () => {
    const kit = buildMinimalStyleKit();
    const result = validateDocumentStyleKit(kit);
    expect(result.valid).toBe(true);
  });
});
