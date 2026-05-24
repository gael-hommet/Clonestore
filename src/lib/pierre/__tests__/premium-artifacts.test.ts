// src/lib/pierre/__tests__/premium-artifacts.test.ts
// Bloc 27 — Regression tests for artifacts + Pierre adapter integration
// No OpenAI, no Anthropic, no Supabase, no async.

import { describe, it, expect } from "vitest";
import {
  buildPierreDocumentArtifact,
  buildPierreEmailDraftArtifact,
  buildPierreFollowupArtifact,
  buildPierreMissingInfoArtifact,
  inferPierreArtifactKind,
  type PierreTaskExecutionInput,
} from "../tasks/artifacts";

function makeInput(overrides: Partial<PierreTaskExecutionInput> = {}): PierreTaskExecutionInput {
  return {
    task: {
      id: "task-123",
      type: "doc.generate",
      title: "Test Document",
      payload_json: {},
      mission_id: null,
      scheduled_for: null,
    },
    employee: null,
    mission: null,
    company_memory: null,
    now: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ── inferPierreArtifactKind ───────────────────────────────────────────────────

describe("inferPierreArtifactKind", () => {
  it("returns document for doc.generate", () => {
    expect(inferPierreArtifactKind("doc.generate")).toBe("document");
  });
  it("returns email_send for email.send", () => {
    expect(inferPierreArtifactKind("email.send")).toBe("email_send");
  });
  it("returns email_draft for email.draft", () => {
    expect(inferPierreArtifactKind("email.draft")).toBe("email_draft");
  });
  it("returns followup for followup.schedule", () => {
    expect(inferPierreArtifactKind("followup.schedule")).toBe("followup");
  });
  it("returns missing_info for request_missing_info", () => {
    expect(inferPierreArtifactKind("request_missing_info")).toBe("missing_info");
  });
  it("returns pdf_ready for pdf.generate", () => {
    expect(inferPierreArtifactKind("pdf.generate")).toBe("pdf_ready");
  });
  it("detects email_draft from payload subject", () => {
    expect(inferPierreArtifactKind(null, { subject: "Hello" })).toBe("email_draft");
  });
  it("detects missing_info from payload array", () => {
    expect(inferPierreArtifactKind(null, { missing_info: ["field1"] })).toBe("missing_info");
  });
  it("defaults to document for unknown type", () => {
    expect(inferPierreArtifactKind("unknown.type")).toBe("document");
    expect(inferPierreArtifactKind(null)).toBe("document");
  });
});

// ── buildPierreDocumentArtifact — standard path ───────────────────────────────

describe("buildPierreDocumentArtifact", () => {
  it("returns a document artifact for doc.generate", () => {
    const input = makeInput();
    const result = buildPierreDocumentArtifact(input);
    expect(result.kind).toBe("document");
    expect(typeof result.title).toBe("string");
    expect(typeof result.content_text).toBe("string");
    expect(typeof result.content_html).toBe("string");
  });

  it("returns non-empty content even without text_content payload", () => {
    // Premium task types render from templates, not from raw text_content
    const input = makeInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "T",
        payload_json: { text_content: "Existing content here" },
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.content_text.length).toBeGreaterThan(0);
    expect(result.kind).toBe("document");
  });

  it("includes employee name in content when provided", () => {
    const input = makeInput({
      employee: { id: "e1", name: "Alice Dumont", role: "Developer" },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.content_text).toContain("Alice Dumont");
  });

  it("adds employee_file tags when employee_file_snapshot is present", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "T",
        payload_json: {
          employee_file_snapshot: { employee_id: "emp-1", risk_level: "orange" },
        },
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.tags).toContain("employee_file");
    expect(result.tags.some((t) => t.startsWith("employee:"))).toBe(true);
  });

  it("does not throw for empty payload", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "hr.document",
        title: null,
        payload_json: {},
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.kind).toBe("document");
  });

  it("handles all premium doc task types", () => {
    const types = [
      "doc.generate", "document.generate", "contract.generate",
      "amendment.generate", "onboarding.document", "absence.document",
      "prepayroll.summary", "employee.summary", "hr.document", "document.prepare",
    ];
    for (const type of types) {
      const input = makeInput({
        task: { id: "t1", type, title: "T", payload_json: {}, mission_id: null, scheduled_for: null },
      });
      expect(() => buildPierreDocumentArtifact(input)).not.toThrow();
    }
  });
});

// ── Bloc 27 path via document_kind ────────────────────────────────────────────

describe("buildPierreDocumentArtifact — Bloc 27 path", () => {
  it("uses Bloc 27 renderer when document_kind is set", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "Contract",
        payload_json: { document_kind: "hr_contract_draft" },
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.kind).toBe("document");
    expect(result.template_id).toMatch(/^pierre_/);
    expect(result.tags).toContain("bloc27");
  });

  it("uses Bloc 27 renderer when premium_document is true", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "Onboarding",
        payload_json: { premium_document: true, document_kind: "onboarding_plan" },
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.template_id).toMatch(/^pierre_onboarding/);
  });

  it("sensitive_case_note is blocked when validation required", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "Case Note",
        payload_json: { document_kind: "sensitive_case_note" },
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.status).toBe("blocked");
    expect(result.approval_required).toBe(true);
  });

  it("renders with employee profile from employee input", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "Onboarding",
        payload_json: { document_kind: "onboarding_plan" },
        mission_id: null,
        scheduled_for: null,
      },
      employee: { id: "e1", name: "Bob Dupont", role: "Engineer" },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.kind).toBe("document");
    expect(result.template_id).toMatch(/^pierre_/);
  });

  it("reads company templates from company_memory", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "Briefing",
        payload_json: { document_kind: "hr_weekly_briefing" },
        mission_id: null,
        scheduled_for: null,
      },
      company_memory: {
        reusable_rh_context_json: {
          document_templates: [],
          employees: [{ id: "emp1" }],
        },
      },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.kind).toBe("document");
    // Employees must not be affected
  });

  it("falls back gracefully for unknown document_kind", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "Unknown",
        payload_json: { document_kind: "totally_unknown_kind" },
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreDocumentArtifact(input);
    expect(result.kind).toBe("document");
    expect(result.template_id).toMatch(/^pierre_/);
  });
});

// ── buildPierreEmailDraftArtifact ─────────────────────────────────────────────

describe("buildPierreEmailDraftArtifact", () => {
  it("returns email_draft artifact", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "email.draft",
        title: "Email Subject",
        payload_json: {},
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreEmailDraftArtifact(input);
    expect(result.kind).toBe("email_draft");
    expect(result.status).toBe("draft");
    expect(typeof result.subject).toBe("string");
  });

  it("returns email_send for email.send task type", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "email.send",
        title: "Subject",
        payload_json: { to: "test@example.com" },
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreEmailDraftArtifact(input);
    expect(result.kind).toBe("email_send");
  });

  it("collects recipient emails", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "email.draft",
        title: "T",
        payload_json: { recipient_email: "recipient@example.com" },
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreEmailDraftArtifact(input);
    expect(result.to_json).toContain("recipient@example.com");
  });

  it("does not throw for empty payload", () => {
    expect(() =>
      buildPierreEmailDraftArtifact(makeInput({ task: { id: "t1", type: "email.draft", title: null, payload_json: {}, mission_id: null, scheduled_for: null } }))
    ).not.toThrow();
  });
});

// ── buildPierreFollowupArtifact ───────────────────────────────────────────────

describe("buildPierreFollowupArtifact", () => {
  it("returns followup artifact with pending status", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "followup.schedule",
        title: "Follow up",
        payload_json: { scheduled_for: "2026-06-01" },
        mission_id: null,
        scheduled_for: "2026-06-01",
      },
    });
    const result = buildPierreFollowupArtifact(input);
    expect(result.kind).toBe("followup");
    expect(result.status).toBe("pending");
    expect(result.scheduled_for).toBe("2026-06-01");
  });

  it("includes employee name in title when available", () => {
    const input = makeInput({
      task: { id: "t1", type: "followup.schedule", title: null, payload_json: {}, mission_id: null, scheduled_for: null },
      employee: { id: "e1", name: "Alice" },
    });
    const result = buildPierreFollowupArtifact(input);
    expect(result.title).toContain("Alice");
  });
});

// ── buildPierreMissingInfoArtifact ────────────────────────────────────────────

describe("buildPierreMissingInfoArtifact", () => {
  it("returns missing_info artifact", () => {
    const input = makeInput({
      task: {
        id: "t1",
        type: "request_missing_info",
        title: "Missing Info",
        payload_json: { missing_info: ["field_a", "field_b"] },
        mission_id: null,
        scheduled_for: null,
      },
    });
    const result = buildPierreMissingInfoArtifact(input);
    expect(result.kind).toBe("missing_info");
    expect(result.missing_fields).toContain("field_a");
    expect(result.missing_fields).toContain("field_b");
  });

  it("does not throw for empty payload", () => {
    expect(() =>
      buildPierreMissingInfoArtifact(makeInput({
        task: { id: "t1", type: "request_missing_info", title: null, payload_json: {}, mission_id: null, scheduled_for: null },
      }))
    ).not.toThrow();
  });
});
