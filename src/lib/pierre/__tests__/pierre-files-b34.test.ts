// src/lib/pierre/__tests__/pierre-files-b34.test.ts
// B34 — Pierre file bridge tests. Mock mode only.

import { describe, it, expect } from "vitest";
import type { CloneFileRecord, FileExtractionResult } from "../../cloneos/files/types";
import { classifyPierreHrFile } from "../files/classify-hr-file";
import { attachFileToPierre } from "../files/attach-file-to-pierre";
import { routeFileToPierre } from "../files/route-file-to-pierre";
import { buildPierreFileContext } from "../files/build-file-context";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeFile(overrides: Partial<CloneFileRecord> = {}): CloneFileRecord {
  return {
    id: "file_001",
    company_id: "co_acme",
    agent_slug: "pierre",
    source: "upload",
    kind: "pdf",
    original_filename: "document.pdf",
    safe_filename: "document.pdf",
    mime_type: "application/pdf",
    size_bytes: 80_000,
    storage_bucket: "pierre-documents",
    storage_path: null,
    checksum_sha256: "abc123",
    status: "classified",
    risk_level: "low",
    visibility: "internal",
    uploaded_by_user_id: null,
    channel_identity_id: null,
    envelope_id: null,
    related_mission_id: null,
    related_task_id: null,
    related_employee_id: null,
    site_id: null,
    category: "other",
    title: null,
    extracted_text_preview: null,
    extraction_status: "done",
    extraction_error: null,
    classification_confidence: 0.7,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    ...overrides,
  };
}

function makeExtraction(overrides: Partial<FileExtractionResult> = {}): FileExtractionResult {
  return {
    ok: true,
    text: null,
    preview: "Extrait du document.",
    page_count: 2,
    word_count: 150,
    table_count: 0,
    detected_dates: [],
    detected_people: [],
    detected_companies: [],
    detected_amounts: [],
    warnings: [],
    error: null,
    ...overrides,
  };
}

// ── classifyPierreHrFile ──────────────────────────────────────────────────────

describe("classifyPierreHrFile", () => {
  it("classifies CV correctly", () => {
    const file = makeFile({ original_filename: "cv_martin.pdf" });
    const result = classifyPierreHrFile(file, makeExtraction({ preview: "Curriculum vitae — expérience professionnelle" }));
    expect(result.category).toBe("cv");
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("classifies contract correctly", () => {
    const file = makeFile({ original_filename: "contrat-cdi.docx" });
    const result = classifyPierreHrFile(file, makeExtraction({ preview: "Contrat de travail CDI période d'essai" }));
    expect(result.category).toBe("contract");
    expect(result.risk_level).toBe("high");
  });

  it("escalates sick leave to SENSITIVE", () => {
    const file = makeFile({ original_filename: "arret-travail.pdf" });
    const result = classifyPierreHrFile(file, makeExtraction({ preview: "Arrêt de travail par le médecin traitant maladie" }));
    expect(result.category).toBe("sick_leave");
    expect(result.risk_level).toBe("sensitive");
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("escalates legal sensitive to SENSITIVE", () => {
    const file = makeFile({ original_filename: "note-disciplinaire.pdf" });
    const result = classifyPierreHrFile(file, makeExtraction({ preview: "Procédure disciplinaire faute grave prud'hommes" }));
    expect(result.category).toBe("legal_sensitive");
    expect(result.risk_level).toBe("sensitive");
  });

  it("classifies payroll export as high risk", () => {
    const file = makeFile({ original_filename: "export-paie.xlsx" });
    const result = classifyPierreHrFile(file, makeExtraction({ preview: "Bulletins de salaire brut net à payer cotisations" }));
    expect(["payroll_export", "payroll_variable"]).toContain(result.category);
    expect(["high", "sensitive"]).toContain(result.risk_level);
  });
});

// ── attachFileToPierre ────────────────────────────────────────────────────────

describe("attachFileToPierre", () => {
  const baseContext = { company_id: "co_acme", agent_slug: "pierre" };

  it("attaches to mission when mission_id provided", () => {
    const file = makeFile();
    const classification = { category: "contract" as const, confidence: 0.8, risk_level: "high" as const, visibility: "internal" as const, suggested_links: [], missing_info: [], warnings: [], reason: "" };
    const result = attachFileToPierre(file, classification, { ...baseContext, mission_id: "miss_001" });
    expect(result.action).toBe("attach_to_mission");
    expect(result.related_mission_id).toBe("miss_001");
    expect(result.approval_required).toBe(true);
  });

  it("attaches to task when task_id provided", () => {
    const file = makeFile();
    const classification = { category: "certificate" as const, confidence: 0.7, risk_level: "low" as const, visibility: "employee_related" as const, suggested_links: [], missing_info: [], warnings: [], reason: "" };
    const result = attachFileToPierre(file, classification, { ...baseContext, task_id: "task_001" });
    expect(result.action).toBe("attach_to_task");
    expect(result.related_task_id).toBe("task_001");
  });

  it("attaches to employee when employee_id provided", () => {
    const file = makeFile();
    const classification = { category: "absence_proof" as const, confidence: 0.7, risk_level: "medium" as const, visibility: "internal" as const, suggested_links: [], missing_info: [], warnings: [], reason: "" };
    const result = attachFileToPierre(file, classification, { ...baseContext, employee_id: "emp_001" });
    expect(result.action).toBe("attach_to_employee");
    expect(result.related_employee_id).toBe("emp_001");
  });

  it("block_sensitive for sensitive risk level", () => {
    const file = makeFile({ risk_level: "sensitive" });
    const classification = { category: "sick_leave" as const, confidence: 0.9, risk_level: "sensitive" as const, visibility: "restricted" as const, suggested_links: [], missing_info: [], warnings: [], reason: "" };
    const result = attachFileToPierre(file, classification, baseContext);
    expect(result.action).toBe("block_sensitive");
    expect(result.approval_required).toBe(true);
  });

  it("creates mission for CV without context", () => {
    const file = makeFile({ original_filename: "cv_candidat.pdf" });
    const classification = { category: "cv" as const, confidence: 0.8, risk_level: "medium" as const, visibility: "manager_visible" as const, suggested_links: [], missing_info: [], warnings: [], reason: "" };
    const result = attachFileToPierre(file, classification, baseContext);
    expect(result.action).toBe("create_new_mission");
  });

  it("asks for more info when no context and not clearly actionable", () => {
    const file = makeFile({ original_filename: "rapport-rh.pdf" });
    const classification = { category: "other" as const, confidence: 0.1, risk_level: "low" as const, visibility: "internal" as const, suggested_links: [], missing_info: [], warnings: [], reason: "" };
    const result = attachFileToPierre(file, classification, baseContext);
    expect(result.action).toBe("ask_for_more_info");
  });

  it("requires approval for payroll category", () => {
    const file = makeFile();
    const classification = { category: "payroll_export" as const, confidence: 0.85, risk_level: "high" as const, visibility: "restricted" as const, suggested_links: [], missing_info: [], warnings: [], reason: "" };
    const result = attachFileToPierre(file, classification, { ...baseContext, mission_id: "miss_002" });
    expect(result.approval_required).toBe(true);
  });
});

// ── routeFileToPierre ─────────────────────────────────────────────────────────

describe("routeFileToPierre", () => {
  it("full routing flow for a CV", () => {
    const file = makeFile({ original_filename: "cv_alice.pdf" });
    const result = routeFileToPierre(file, makeExtraction({ preview: "Curriculum vitae expérience professionnelle" }), { company_id: "co_acme", agent_slug: "pierre" });
    expect(result.classification_category).toBe("cv");
    expect(result.attach_decision.action).toBe("create_new_mission");
  });

  it("sets requires_validation=true for sensitive file", () => {
    const file = makeFile({ original_filename: "arret-maladie.pdf" });
    const result = routeFileToPierre(
      file,
      makeExtraction({ preview: "Arrêt de travail maladie médecin" }),
      { company_id: "co_acme", agent_slug: "pierre" },
    );
    expect(result.requires_validation).toBe(true);
  });
});

// ── buildPierreFileContext ────────────────────────────────────────────────────

describe("buildPierreFileContext", () => {
  it("builds context with summary and HR tags", () => {
    const file = makeFile({ original_filename: "contrat-cdi.pdf", kind: "pdf", size_bytes: 80_000 });
    const classification = { category: "contract" as const, confidence: 0.9, risk_level: "high" as const, visibility: "internal" as const, suggested_links: [], missing_info: [], warnings: [], reason: "" };
    const ctx = buildPierreFileContext(file, makeExtraction(), classification);
    expect(ctx.summary).toContain("PDF");
    expect(ctx.summary).toContain("contract");
    expect(ctx.hr_tags).toContain("contrat");
    expect(ctx.requires_validation).toBe(false);
  });

  it("sets requires_validation=true for sensitive classification", () => {
    const file = makeFile();
    const classification = { category: "sick_leave" as const, confidence: 0.9, risk_level: "sensitive" as const, visibility: "restricted" as const, suggested_links: [], missing_info: [], warnings: [], reason: "" };
    const ctx = buildPierreFileContext(file, makeExtraction(), classification);
    expect(ctx.requires_validation).toBe(true);
    expect(ctx.risk_summary).toMatch(/SENSIBLE/);
  });

  it("preserves original risk level from file record when no classification", () => {
    const file = makeFile({ risk_level: "medium" });
    const ctx = buildPierreFileContext(file, null, null, null);
    expect(ctx.risk_summary).toContain("modéré");
  });
});
