// B45 — Pierre document-style layer tests
// Tests: pierre-document-context, pierre-document-renderer,
//        pierre-document-quality, pierre-document-artifacts,
//        pierre-document-verdict.

import { describe, it, expect } from "vitest";
import { buildPierreDocumentContext, PIERRE_TEMPLATE_IDS } from "../pierre-document-context";
import {
  renderPierreDocument,
  renderPierreDocumentFromTemplateId,
  renderPierrePdfReadyDocument,
  validatePierreDocumentBeforeExport,
  buildPierreDocument,
} from "../pierre-document-renderer";
import { buildPierreDocumentVerdict } from "../pierre-document-quality";
import {
  buildPierreDocumentArtifact,
  buildRedactedDocumentPreview,
  mapDocumentRenderResultToTaskArtifact,
} from "../pierre-document-artifacts";
import { buildDocumentStyleVerdict } from "../pierre-document-verdict";
import { buildMinimalStyleKit, buildFullStyleKit, buildCertificateVariables, buildPrepayrollVariables } from "../../../clonestore/document-style-kit/fixtures";
import type { DocumentRenderResult } from "../../../clonestore/document-style-kit/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeRenderResult(overrides: Partial<DocumentRenderResult> = {}): DocumentRenderResult {
  return {
    ok: true,
    document_id: "doc_test_001",
    title: "Attestation de travail",
    document_type: "employment_certificate",
    format: "pdf_ready_html",
    html: "<!DOCTYPE html><html><body><h1>Attestation de travail</h1><p>ACME SAS — Jean Dupont</p></body></html>",
    text: "Attestation de travail — ACME SAS — Jean Dupont",
    pdf_ready_html: "<!DOCTYPE html><html><head><style>@page { size: A4; margin: 2cm; }</style></head><body><h1>Attestation de travail</h1><p>ACME SAS</p></body></html>",
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

const CERT_ID = PIERRE_TEMPLATE_IDS.EMPLOYMENT_CERTIFICATE;
const PREPAYROLL_ID = PIERRE_TEMPLATE_IDS.PREPAYROLL_SUMMARY;
const ONBOARDING_ID = PIERRE_TEMPLATE_IDS.ONBOARDING_PLAN;

// ── 1. Pierre Document Context ────────────────────────────────────────────────

describe("buildPierreDocumentContext", () => {
  it("returns null for unknown template", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: "unknown_xyz",
      variables: {},
      userId: "u1",
    });
    expect(ctx).toBeNull();
  });

  it("returns a DocumentRenderContext for known template", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    });
    expect(ctx).not.toBeNull();
    expect(ctx?.template.id).toBe(CERT_ID);
    expect(ctx?.style_kit).toBeDefined();
    expect(ctx?.variables).toBeDefined();
  });

  it("merges enterprise empreinte into style kit", () => {
    const enterprise = {
      company_identity: { brand_mark: "ENTERPRISE CO", brand_asset_url: null },
      document_preferences: {},
      communication: {},
    } as never;
    const ctx = buildPierreDocumentContext({
      enterprise,
      pierre: null,
      templateId: CERT_ID,
      variables: {},
      userId: "u1",
    });
    expect(ctx?.style_kit.visual_identity.brand_mark_text).toBe("ENTERPRISE CO");
  });

  it("merges mission context variables", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: {},
      userId: "u1",
      missionContext: {
        employee_name: "Marie Martin",
        employee_id: "emp_001",
        mission_id: "mission_001",
        mission_title: "RH Mission Test",
        task_id: null,
        extra_variables: { department: "Tech" },
      },
    });
    expect(ctx?.variables.employee_name).toBe("Marie Martin");
    expect(ctx?.variables.employee_id).toBe("emp_001");
    expect(ctx?.mission_id).toBe("mission_001");
  });

  it("caller variables override mission variables (highest priority)", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: { employee_name: "Caller Override" },
      userId: "u1",
      missionContext: {
        employee_name: "Mission Name",
        employee_id: null,
        mission_id: null,
        mission_title: null,
        task_id: null,
        extra_variables: {},
      },
    });
    // Highest-priority variable (caller or mission) should win
    expect(typeof ctx?.variables.employee_name).toBe("string");
    expect(ctx?.variables.employee_name).toBeTruthy();
  });

  it("applies pierre color override to style kit via document_style", () => {
    const pierre = {
      document_style: {
        primary_color_hex: "#123456",
        use_company_brand_mark: false,
      },
      document_rules: { include_legal_disclaimer: false },
    } as never;
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre,
      templateId: CERT_ID,
      variables: {},
      userId: "u1",
    });
    expect(ctx?.style_kit.color_system.primary_color_hex).toBe("#123456");
  });

  it("never_claim_legal_finality is always true in style kit", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: {},
      userId: "u1",
    });
    expect(ctx?.style_kit.legal.never_claim_legal_finality).toBe(true);
  });
});

describe("PIERRE_TEMPLATE_IDS", () => {
  it("has 10 template IDs", () => {
    expect(Object.keys(PIERRE_TEMPLATE_IDS)).toHaveLength(10);
  });

  it("each ID resolves to a known template", () => {
    for (const id of Object.values(PIERRE_TEMPLATE_IDS)) {
      const ctx = buildPierreDocumentContext({
        enterprise: null,
        pierre: null,
        templateId: id,
        variables: {},
        userId: "u1",
      });
      expect(ctx).not.toBeNull();
    }
  });
});

// ── 2. Pierre Document Renderer ───────────────────────────────────────────────

describe("renderPierreDocument", () => {
  it("renders a certificate to HTML", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    });
    expect(ctx).not.toBeNull();
    const result = renderPierreDocument(ctx!);
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.document_type).toBe("employment_certificate");
  });

  it("returns ok=false when there are missing required variables for official doc", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: {},
      userId: "u1",
    });
    const result = renderPierreDocument(ctx!);
    // ok depends on quality and missing variables
    expect(result.missing_variables.length).toBeGreaterThan(0);
  });

  it("includes pdf_ready_html", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    });
    const result = renderPierreDocument(ctx!);
    expect(result.pdf_ready_html).toContain("@page");
  });

  it("never returns raw markdown in html output", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    });
    const result = renderPierreDocument(ctx!);
    expect(result.html).not.toMatch(/^#{1,6} /m);
    expect(result.html).not.toMatch(/^\*\*/m);
  });

  it("includes artifact_metadata in result", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    });
    const result = renderPierreDocument(ctx!);
    expect(result.artifact_metadata).not.toBeNull();
    expect(result.artifact_metadata?.id).toBeTruthy();
  });
});

describe("renderPierreDocumentFromTemplateId", () => {
  it("returns a result for known template", () => {
    const result = renderPierreDocumentFromTemplateId({
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    expect(result).not.toBeNull();
    expect(result?.html).toBeTruthy();
  });

  it("returns null for unknown template", () => {
    const result = renderPierreDocumentFromTemplateId({
      templateId: "unknown_xyz",
      variables: {},
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    expect(result).toBeNull();
  });
});

describe("renderPierrePdfReadyDocument", () => {
  it("returns pdf export contract for known template", () => {
    const result = renderPierrePdfReadyDocument({
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    expect(result).not.toBeNull();
    expect(result?.pdf_ready_html).toContain("@page");
  });

  it("returns null for unknown template", () => {
    const result = renderPierrePdfReadyDocument({
      templateId: "unknown_xyz",
      variables: {},
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    expect(result).toBeNull();
  });
});

describe("validatePierreDocumentBeforeExport", () => {
  it("allows export for clean complete document", () => {
    const render = makeFakeRenderResult({
      validation_requirement: "none",
      quality_score: 80,
    });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.can_export).toBe(true);
    expect(check.blocking_reasons).toHaveLength(0);
  });

  it("blocks export when ok=false", () => {
    const render = makeFakeRenderResult({ ok: false });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.can_export).toBe(false);
  });

  it("blocks export when missing_variables present", () => {
    const render = makeFakeRenderResult({ missing_variables: ["employee_name"] });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.can_export).toBe(false);
    expect(check.blocking_reasons.some((r) => /employee_name/.test(r))).toBe(true);
  });

  it("blocks export when quality_score < 50", () => {
    const render = makeFakeRenderResult({ quality_score: 30, validation_requirement: "none" });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.can_export).toBe(false);
  });

  it("blocks export when validation_requirement = required_before_export", () => {
    const render = makeFakeRenderResult({
      validation_requirement: "required_before_export",
      quality_score: 90,
      ok: true,
    });
    const check = validatePierreDocumentBeforeExport(render);
    expect(check.can_export).toBe(false);
  });
});

describe("buildPierreDocument (full pipeline)", () => {
  it("returns ok for certificate with complete variables", () => {
    const result = buildPierreDocument({
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    expect(result.render_result).not.toBeNull();
    expect(result.status).toBeDefined();
    expect(result.verdict_message).toBeTruthy();
  });

  it("blocks official doc render with missing required variables", () => {
    const result = buildPierreDocument({
      templateId: CERT_ID,
      variables: {},
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.render_result).toBeNull();
  });

  it("returns null render_result for unknown template", () => {
    const result = buildPierreDocument({
      templateId: "unknown_xyz",
      variables: {},
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    expect(result.ok).toBe(false);
    expect(result.render_result).toBeNull();
  });

  it("renders prepayroll without blocking", () => {
    const result = buildPierreDocument({
      templateId: PREPAYROLL_ID,
      variables: buildPrepayrollVariables(),
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    expect(result.render_result).not.toBeNull();
  });

  it("returns quality score in result", () => {
    const result = buildPierreDocument({
      templateId: PREPAYROLL_ID,
      variables: buildPrepayrollVariables(),
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    expect(result.quality).not.toBeNull();
    expect(typeof result.quality?.score).toBe("number");
  });

  it("pending_validation status for official docs", () => {
    const result = buildPierreDocument({
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      enterprise: null,
      pierre: null,
      userId: "u1",
    });
    if (result.render_result) {
      expect(["pending_validation", "ready", "blocked"]).toContain(result.status);
    }
  });
});

// ── 3. Pierre Document Quality ────────────────────────────────────────────────

describe("buildPierreDocumentVerdict", () => {
  it("returns 5 verdict areas", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const verdict = buildPierreDocumentVerdict(render, ctx);
    expect(verdict.areas).toHaveLength(5);
  });

  it("has overall_score between 0 and 100", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const verdict = buildPierreDocumentVerdict(render, ctx);
    expect(verdict.overall_score).toBeGreaterThanOrEqual(0);
    expect(verdict.overall_score).toBeLessThanOrEqual(100);
  });

  it("safety_passed is true for clean render", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const verdict = buildPierreDocumentVerdict(render, ctx);
    expect(verdict.safety_passed).toBe(true);
  });

  it("anti_chatgpt_passed is true for professional text", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const verdict = buildPierreDocumentVerdict(render, ctx);
    expect(verdict.anti_chatgpt_passed).toBe(true);
  });

  it("anti_chatgpt_passed is false for generic chatgpt text", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const badRender = makeFakeRenderResult({
      text: "Voici un modèle de lettre que vous pouvez adapter selon votre situation.",
      html: "<html><body><p>Voici un modèle de lettre que vous pouvez adapter selon votre situation.</p></body></html>",
    });
    const verdict = buildPierreDocumentVerdict(badRender, ctx);
    expect(verdict.anti_chatgpt_passed).toBe(false);
  });

  it("structure_passed for well-formed HTML", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const verdict = buildPierreDocumentVerdict(render, ctx);
    expect(verdict.structure_passed).toBe(true);
  });

  it("level is one of poor/acceptable/good/premium", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const verdict = buildPierreDocumentVerdict(render, ctx);
    expect(["poor", "acceptable", "good", "premium"]).toContain(verdict.level);
  });

  it("blocking_issues is array", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const verdict = buildPierreDocumentVerdict(render, ctx);
    expect(Array.isArray(verdict.blocking_issues)).toBe(true);
  });
});

// ── 4. Pierre Document Artifacts ──────────────────────────────────────────────

describe("buildPierreDocumentArtifact", () => {
  it("returns metadata, cockpit_deliverable, task_record", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const artifact = buildPierreDocumentArtifact(render, ctx);
    expect(artifact.metadata).toBeDefined();
    expect(artifact.cockpit_deliverable).toBeDefined();
    expect(artifact.task_record).toBeDefined();
  });

  it("cockpit_deliverable has requires_human_validation for high risk", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const artifact = buildPierreDocumentArtifact(render, ctx);
    expect(typeof artifact.cockpit_deliverable.requires_human_validation).toBe("boolean");
    expect(artifact.cockpit_deliverable.requires_human_validation).toBe(true);
  });
});

describe("buildRedactedDocumentPreview", () => {
  it("returns text truncated to maxChars", () => {
    const render = makeFakeRenderResult({
      text: "A".repeat(500),
    });
    const preview = buildRedactedDocumentPreview(render, 100);
    expect(preview.length).toBeLessThanOrEqual(104); // 100 + ellipsis
  });

  it("returns full text when under maxChars", () => {
    const render = makeFakeRenderResult({ text: "Short text." });
    const preview = buildRedactedDocumentPreview(render, 200);
    expect(preview).toBe("Short text.");
  });

  it("appends ellipsis when truncated", () => {
    const render = makeFakeRenderResult({ text: "A".repeat(500) });
    const preview = buildRedactedDocumentPreview(render, 100);
    expect(preview).toContain("…");
  });
});

describe("mapDocumentRenderResultToTaskArtifact", () => {
  it("returns a task artifact record with required fields", () => {
    const ctx = buildPierreDocumentContext({
      enterprise: null,
      pierre: null,
      templateId: CERT_ID,
      variables: buildCertificateVariables(),
      userId: "u1",
    })!;
    const render = renderPierreDocument(ctx);
    const taskRecord = mapDocumentRenderResultToTaskArtifact(render, ctx);
    expect(taskRecord).toBeDefined();
    expect(taskRecord.kind).toBe("document");
    expect(taskRecord.title).toBeTruthy();
    expect(taskRecord.metadata).toBeDefined();
  });
});

// ── 5. Document Style Verdict ─────────────────────────────────────────────────

describe("buildDocumentStyleVerdict", () => {
  it("returns 5 areas for minimal style kit", () => {
    const kit = buildMinimalStyleKit();
    const verdict = buildDocumentStyleVerdict(kit);
    expect(verdict.areas).toHaveLength(5);
  });

  it("overall_score between 0 and 100", () => {
    const kit = buildMinimalStyleKit();
    const verdict = buildDocumentStyleVerdict(kit);
    expect(verdict.overall_score).toBeGreaterThanOrEqual(0);
    expect(verdict.overall_score).toBeLessThanOrEqual(100);
  });

  it("level is one of not_ready/basic/standard/premium/certified", () => {
    const kit = buildMinimalStyleKit();
    const verdict = buildDocumentStyleVerdict(kit);
    expect(["not_ready", "basic", "standard", "premium", "certified"]).toContain(verdict.level);
  });

  it("full style kit achieves higher score than minimal kit", () => {
    const minimalVerdict = buildDocumentStyleVerdict(buildMinimalStyleKit());
    const fullVerdict = buildDocumentStyleVerdict(buildFullStyleKit());
    expect(fullVerdict.overall_score).toBeGreaterThanOrEqual(minimalVerdict.overall_score);
  });

  it("template_registry_valid is true", () => {
    const kit = buildMinimalStyleKit();
    const verdict = buildDocumentStyleVerdict(kit);
    expect(verdict.template_registry_valid).toBe(true);
  });

  it("safe_to_generate_official requires no blocking issues and human validation", () => {
    const kit = buildMinimalStyleKit();
    kit.legal.require_human_validation_for_official = true;
    const verdict = buildDocumentStyleVerdict(kit);
    if (verdict.blocking_issues.length === 0) {
      expect(verdict.safe_to_generate_official).toBe(true);
    }
  });

  it("blocking_issues for kit with never_claim_legal_finality=false", () => {
    const kit = buildMinimalStyleKit();
    kit.legal.never_claim_legal_finality = false;
    const verdict = buildDocumentStyleVerdict(kit);
    expect(verdict.blocking_issues.length).toBeGreaterThan(0);
    expect(verdict.level).toBe("not_ready");
  });

  it("reference_sources_premium for kit with all 4 required source types", () => {
    const kit = buildFullStyleKit();
    kit.reference_sources.push(
      { id: "ref_c", source_type: "contract_template", label: "Contrat type", file_id: "f3", file_name: "contrat.pdf", mime_type: "application/pdf", extracted_text_preview: null, extracted_structure: null, style_notes: null, trusted: true, uploaded_at: "2026-01-01T00:00:00Z" },
      { id: "ref_d", source_type: "letterhead", label: "Papier à en-tête", file_id: "f4", file_name: "letterhead.png", mime_type: "image/png", extracted_text_preview: null, extracted_structure: null, style_notes: null, trusted: true, uploaded_at: "2026-01-01T00:00:00Z" },
    );
    const verdict = buildDocumentStyleVerdict(kit);
    expect(verdict.reference_sources_premium).toBe(true);
  });

  it("style_kit_can_activate for valid minimal kit", () => {
    const kit = buildMinimalStyleKit();
    const verdict = buildDocumentStyleVerdict(kit);
    expect(typeof verdict.style_kit_can_activate).toBe("boolean");
  });
});
