import { describe, it, expect } from "vitest";
import {
  inferPierreArtifactKind,
  buildPierreDocumentArtifact,
  buildPierreEmailDraftArtifact,
  buildPierreFollowupArtifact,
  buildPierreMissingInfoArtifact,
  buildPierrePdfReadyArtifact,
  scorePierreArtifactQuality,
  buildPierreTaskExecutionResult,
  type PierreTaskExecutionInput,
} from "../tasks/artifacts";

// ── Helpers ──────────────────────────────────────────────────

function baseInput(overrides?: Partial<PierreTaskExecutionInput>): PierreTaskExecutionInput {
  return {
    task: {
      id: "task-123",
      type: "doc.generate",
      title: "Test task",
      payload_json: {},
      mission_id: "mission-456",
    },
    employee: null,
    company_memory: null,
    now: new Date("2025-01-15T10:00:00Z"),
    ...overrides,
  };
}

function withEmployee(
  input: PierreTaskExecutionInput,
  employee: NonNullable<PierreTaskExecutionInput["employee"]>,
): PierreTaskExecutionInput {
  return { ...input, employee };
}

// ── inferPierreArtifactKind ───────────────────────────────────

describe("inferPierreArtifactKind", () => {
  it("returns email_send for email.send", () => {
    expect(inferPierreArtifactKind("email.send")).toBe("email_send");
  });

  it("returns email_send for send_email", () => {
    expect(inferPierreArtifactKind("send_email")).toBe("email_send");
  });

  it("returns email_draft for email.draft", () => {
    expect(inferPierreArtifactKind("email.draft")).toBe("email_draft");
  });

  it("returns email_draft for prepare_email", () => {
    expect(inferPierreArtifactKind("prepare_email")).toBe("email_draft");
  });

  it("returns pdf_ready for pdf.generate", () => {
    expect(inferPierreArtifactKind("pdf.generate")).toBe("pdf_ready");
  });

  it("returns pdf_ready for generate_pdf", () => {
    expect(inferPierreArtifactKind("generate_pdf")).toBe("pdf_ready");
  });

  it("returns followup for followup.schedule", () => {
    expect(inferPierreArtifactKind("followup.schedule")).toBe("followup");
  });

  it("returns followup for reminder.create", () => {
    expect(inferPierreArtifactKind("reminder.create")).toBe("followup");
  });

  it("returns followup for schedule_follow_up", () => {
    expect(inferPierreArtifactKind("schedule_follow_up")).toBe("followup");
  });

  it("returns missing_info for request_missing_info", () => {
    expect(inferPierreArtifactKind("request_missing_info")).toBe("missing_info");
  });

  it("returns missing_info for ask_missing_info", () => {
    expect(inferPierreArtifactKind("ask_missing_info")).toBe("missing_info");
  });

  it("returns document for doc.generate", () => {
    expect(inferPierreArtifactKind("doc.generate")).toBe("document");
  });

  it("returns document for doc.rewrite", () => {
    expect(inferPierreArtifactKind("doc.rewrite")).toBe("document");
  });

  it("returns document for generate_document", () => {
    expect(inferPierreArtifactKind("generate_document")).toBe("document");
  });

  it("falls back to document for unknown type without payload hints", () => {
    expect(inferPierreArtifactKind("unknown_type")).toBe("document");
  });

  it("falls back to document for null type", () => {
    expect(inferPierreArtifactKind(null)).toBe("document");
  });

  it("infers missing_info from payload missing_info array", () => {
    expect(
      inferPierreArtifactKind("unknown", { missing_info: ["field1", "field2"] }),
    ).toBe("missing_info");
  });

  it("infers email_draft from payload recipient_email", () => {
    expect(
      inferPierreArtifactKind("unknown", { recipient_email: "test@example.com" }),
    ).toBe("email_draft");
  });

  it("infers followup from payload scheduled_for", () => {
    expect(
      inferPierreArtifactKind("unknown", { scheduled_for: "2025-02-01" }),
    ).toBe("followup");
  });

  it("infers pdf_ready from payload pdf_url", () => {
    expect(
      inferPierreArtifactKind("unknown", { pdf_url: "https://example.com/doc.pdf" }),
    ).toBe("pdf_ready");
  });
});

// ── buildPierreDocumentArtifact ───────────────────────────────

describe("buildPierreDocumentArtifact", () => {
  it("returns kind document", () => {
    const artifact = buildPierreDocumentArtifact(baseInput());
    expect(artifact.kind).toBe("document");
  });

  it("returns status generated", () => {
    const artifact = buildPierreDocumentArtifact(baseInput());
    expect(artifact.status).toBe("generated");
  });

  it("uses existing text_content from payload when content is long enough", () => {
    const longContent = "Contenu existant du document RH. ".repeat(5); // >80 chars
    const input = baseInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: null,
        payload_json: { text_content: longContent },
      },
    });
    const artifact = buildPierreDocumentArtifact(input);
    expect(artifact.content_text).toContain("Contenu existant du document RH.");
  });

  it("uses title from payload", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "Task title",
        payload_json: { title: "Payload title" },
      },
    });
    const artifact = buildPierreDocumentArtifact(input);
    expect(artifact.title).toBe("Payload title");
  });

  it("falls back to task title when no payload title", () => {
    const input = baseInput({
      task: { id: "t1", type: "doc.generate", title: "Task title", payload_json: {} },
    });
    const artifact = buildPierreDocumentArtifact(input);
    expect(artifact.title).toBe("Task title");
  });

  it("detects onboarding domain from instructions", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: null,
        payload_json: { instructions: "Préparer le document d'onboarding pour le nouveau salarié." },
      },
    });
    const artifact = buildPierreDocumentArtifact(input);
    expect(artifact.domain).toBe("onboarding");
    expect(artifact.doc_type).toBe("document_onboarding");
  });

  it("detects recruitment domain", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "Convocation entretien",
        payload_json: {},
      },
    });
    const artifact = buildPierreDocumentArtifact(input);
    expect(artifact.domain).toBe("recruitment");
  });

  it("detects disciplinary domain", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: "Avertissement",
        payload_json: {},
      },
    });
    const artifact = buildPierreDocumentArtifact(input);
    expect(artifact.domain).toBe("disciplinary");
  });

  it("includes employee name in content when employee provided", () => {
    const input = withEmployee(
      baseInput({ task: { id: "t1", type: "doc.generate", title: null, payload_json: {} } }),
      { id: "emp-1", name: "Marie Dupont", role: "RH Manager" },
    );
    const artifact = buildPierreDocumentArtifact(input);
    expect(artifact.content_text).toContain("Marie Dupont");
  });

  it("includes tags array with pierre", () => {
    const artifact = buildPierreDocumentArtifact(baseInput());
    expect(artifact.tags).toContain("pierre");
  });

  it("has empty to_json and cc_json", () => {
    const artifact = buildPierreDocumentArtifact(baseInput());
    expect(artifact.to_json).toHaveLength(0);
    expect(artifact.cc_json).toHaveLength(0);
  });

  it("generates html content", () => {
    const artifact = buildPierreDocumentArtifact(baseInput());
    expect(artifact.content_html).toContain("pierre-wrapper");
  });
});

// ── buildPierreEmailDraftArtifact ─────────────────────────────

describe("buildPierreEmailDraftArtifact", () => {
  it("returns kind email_draft for email.draft type", () => {
    const input = baseInput({
      task: { id: "t1", type: "email.draft", title: null, payload_json: {} },
    });
    const artifact = buildPierreEmailDraftArtifact(input);
    expect(artifact.kind).toBe("email_draft");
  });

  it("returns kind email_send for email.send type", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "email.send",
        title: null,
        payload_json: { subject: "Test", body_text: "Bonjour" },
      },
    });
    const artifact = buildPierreEmailDraftArtifact(input);
    expect(artifact.kind).toBe("email_send");
  });

  it("uses subject from payload", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "email.draft",
        title: null,
        payload_json: { subject: "Convocation entretien" },
      },
    });
    const artifact = buildPierreEmailDraftArtifact(input);
    expect(artifact.subject).toBe("Convocation entretien");
    expect(artifact.title).toBe("Convocation entretien");
  });

  it("collects recipient from payload to field", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "email.draft",
        title: null,
        payload_json: { to: "candidat@example.com" },
      },
    });
    const artifact = buildPierreEmailDraftArtifact(input);
    expect(artifact.to_json).toContain("candidat@example.com");
  });

  it("collects recipient from employee email", () => {
    const input = withEmployee(
      baseInput({ task: { id: "t1", type: "email.draft", title: null, payload_json: {} } }),
      { id: "emp-1", name: "Jean Martin", email: "jean@example.com" },
    );
    const artifact = buildPierreEmailDraftArtifact(input);
    expect(artifact.to_json).toContain("jean@example.com");
  });

  it("deduplicates recipients", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "email.draft",
        title: null,
        payload_json: {
          to: "a@example.com",
          recipient_email: "a@example.com",
        },
      },
    });
    const artifact = buildPierreEmailDraftArtifact(input);
    expect(artifact.to_json.filter((e) => e === "a@example.com")).toHaveLength(1);
  });

  it("uses existing body_text from payload", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "email.draft",
        title: null,
        payload_json: { body_text: "Corps de l'email personnalisé." },
      },
    });
    const artifact = buildPierreEmailDraftArtifact(input);
    expect(artifact.content_text).toBe("Corps de l'email personnalisé.");
  });

  it("status is always draft", () => {
    const artifact = buildPierreEmailDraftArtifact(baseInput());
    expect(artifact.status).toBe("draft");
  });
});

// ── buildPierreFollowupArtifact ───────────────────────────────

describe("buildPierreFollowupArtifact", () => {
  it("returns kind followup", () => {
    const artifact = buildPierreFollowupArtifact(baseInput());
    expect(artifact.kind).toBe("followup");
  });

  it("returns status pending", () => {
    const artifact = buildPierreFollowupArtifact(baseInput());
    expect(artifact.status).toBe("pending");
  });

  it("captures scheduled_for from payload", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "followup.schedule",
        title: null,
        payload_json: { scheduled_for: "2025-03-01T09:00:00Z" },
      },
    });
    const artifact = buildPierreFollowupArtifact(input);
    expect(artifact.scheduled_for).toBe("2025-03-01T09:00:00Z");
  });

  it("includes employee name in title when employee provided", () => {
    const input = withEmployee(
      baseInput({ task: { id: "t1", type: "followup.schedule", title: null, payload_json: {} } }),
      { id: "emp-1", name: "Sophie Bernard" },
    );
    const artifact = buildPierreFollowupArtifact(input);
    expect(artifact.title).toContain("Sophie Bernard");
  });

  it("doc_type is relance_rh", () => {
    const artifact = buildPierreFollowupArtifact(baseInput());
    expect(artifact.doc_type).toBe("relance_rh");
  });

  it("tags include followup", () => {
    const artifact = buildPierreFollowupArtifact(baseInput());
    expect(artifact.tags).toContain("followup");
  });
});

// ── buildPierreMissingInfoArtifact ────────────────────────────

describe("buildPierreMissingInfoArtifact", () => {
  it("returns kind missing_info", () => {
    const artifact = buildPierreMissingInfoArtifact(baseInput());
    expect(artifact.kind).toBe("missing_info");
  });

  it("returns status blocked", () => {
    const artifact = buildPierreMissingInfoArtifact(baseInput());
    expect(artifact.status).toBe("blocked");
  });

  it("extracts missing_info from payload", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "request_missing_info",
        title: null,
        payload_json: {
          missing_info: ["Date de naissance", "Numéro de sécurité sociale"],
        },
      },
    });
    const artifact = buildPierreMissingInfoArtifact(input);
    expect(artifact.missing_fields).toContain("Date de naissance");
    expect(artifact.missing_fields).toContain("Numéro de sécurité sociale");
    expect(artifact.content_text).toContain("Date de naissance");
  });

  it("deduplicates missing fields across missing_info and missing_fields", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "request_missing_info",
        title: null,
        payload_json: {
          missing_info: ["field_a"],
          missing_fields: ["field_a", "field_b"],
        },
      },
    });
    const artifact = buildPierreMissingInfoArtifact(input);
    expect(artifact.missing_fields.filter((f) => f === "field_a")).toHaveLength(1);
  });

  it("doc_type is note_manque_info", () => {
    const artifact = buildPierreMissingInfoArtifact(baseInput());
    expect(artifact.doc_type).toBe("note_manque_info");
  });
});

// ── buildPierrePdfReadyArtifact ───────────────────────────────

describe("buildPierrePdfReadyArtifact", () => {
  it("returns kind pdf_ready", () => {
    const artifact = buildPierrePdfReadyArtifact(baseInput());
    expect(artifact.kind).toBe("pdf_ready");
  });

  it("returns status generated", () => {
    const artifact = buildPierrePdfReadyArtifact(baseInput());
    expect(artifact.status).toBe("generated");
  });

  it("doc_type is pdf_export", () => {
    const artifact = buildPierrePdfReadyArtifact(baseInput());
    expect(artifact.doc_type).toBe("pdf_export");
  });

  it("uses existing text_content from payload", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "pdf.generate",
        title: null,
        payload_json: { text_content: "Contenu PDF original." },
      },
    });
    const artifact = buildPierrePdfReadyArtifact(input);
    expect(artifact.content_text).toBe("Contenu PDF original.");
  });

  it("tags include pdf", () => {
    const artifact = buildPierrePdfReadyArtifact(baseInput());
    expect(artifact.tags).toContain("pdf");
  });
});

// ── scorePierreArtifactQuality ────────────────────────────────

describe("scorePierreArtifactQuality", () => {
  it("returns score 0 for empty artifact", () => {
    const input = baseInput();
    const artifact = buildPierreDocumentArtifact(input);
    // Override content to be empty
    const emptyArtifact = {
      ...artifact,
      content_text: "",
      title: "Document RH",
    };
    const quality = scorePierreArtifactQuality(emptyArtifact, input);
    expect(quality.score).toBe(0);
    expect(quality.has_content).toBe(false);
    expect(quality.is_complete).toBe(false);
  });

  it("scores has_content for text > 50 chars", () => {
    const input = baseInput({
      task: {
        id: "t1",
        type: "doc.generate",
        title: null,
        payload_json: {
          text_content:
            "Ce document RH contient un contenu substantiel pour le salarié concerné.",
        },
      },
    });
    const artifact = buildPierreDocumentArtifact(input);
    const quality = scorePierreArtifactQuality(artifact, input);
    expect(quality.has_content).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(45);
  });

  it("scores has_title for non-generic titles", () => {
    const input = baseInput({
      task: { id: "t1", type: "doc.generate", title: "Convocation Marie Dupont", payload_json: {} },
    });
    const artifact = buildPierreDocumentArtifact(input);
    const quality = scorePierreArtifactQuality(artifact, input);
    expect(quality.has_title).toBe(true);
  });

  it("does not score has_title for generic Document RH", () => {
    const input = baseInput({ task: { id: "t1", type: "doc.generate", title: null, payload_json: {} } });
    const artifact = { ...buildPierreDocumentArtifact(input), title: "Document RH" };
    const quality = scorePierreArtifactQuality(artifact, input);
    expect(quality.has_title).toBe(false);
  });

  it("scores has_employee_context when employee provided", () => {
    const input = withEmployee(
      baseInput({ task: { id: "t1", type: "doc.generate", title: null, payload_json: {} } }),
      { id: "emp-1", name: "Jean Martin" },
    );
    const artifact = buildPierreDocumentArtifact(input);
    const quality = scorePierreArtifactQuality(artifact, input);
    expect(quality.has_employee_context).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(15);
  });

  it("warns about missing recipient for email artifact", () => {
    const input = baseInput({
      task: { id: "t1", type: "email.draft", title: null, payload_json: {} },
    });
    const artifact = buildPierreEmailDraftArtifact(input);
    const quality = scorePierreArtifactQuality(artifact, input);
    expect(quality.has_recipient).toBe(false);
    expect(quality.warnings.some((w) => w.includes("destinataire"))).toBe(true);
  });

  it("scores 100 for fully complete email artifact", () => {
    const input = withEmployee(
      baseInput({
        task: {
          id: "t1",
          type: "email.draft",
          title: "Convocation entretien du 15 mars",
          payload_json: {
            subject: "Convocation entretien du 15 mars",
            body_text:
              "Bonjour, vous êtes convoqué(e) à un entretien le 15 mars. Merci de confirmer votre présence. Cordialement.",
            to: "candidat@example.com",
          },
        },
      }),
      { id: "emp-1", name: "Paul Durand", email: "paul@example.com" },
    );
    const artifact = buildPierreEmailDraftArtifact(input);
    const quality = scorePierreArtifactQuality(artifact, input);
    expect(quality.score).toBe(100);
    expect(quality.is_complete).toBe(true);
  });

  it("is_complete is true when score >= 75", () => {
    const input = withEmployee(
      baseInput({
        task: {
          id: "t1",
          type: "doc.generate",
          title: "Plan d'intégration Marie Dupont",
          payload_json: {
            text_content:
              "Ce plan d'intégration détaille les étapes d'onboarding de Marie Dupont pour son arrivée au sein de l'équipe RH.",
          },
        },
      }),
      { id: "emp-1", name: "Marie Dupont" },
    );
    const artifact = buildPierreDocumentArtifact(input);
    const quality = scorePierreArtifactQuality(artifact, input);
    expect(quality.is_complete).toBe(true);
  });
});

// ── buildPierreTaskExecutionResult ────────────────────────────

describe("buildPierreTaskExecutionResult", () => {
  it("dispatches to document builder for doc.generate", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({ task: { id: "t1", type: "doc.generate", title: null, payload_json: {} } }),
    );
    expect(result.artifact_kind).toBe("document");
    expect(result.artifact?.kind).toBe("document");
  });

  it("dispatches to email builder for email.draft", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({ task: { id: "t1", type: "email.draft", title: null, payload_json: {} } }),
    );
    expect(result.artifact_kind).toBe("email_draft");
  });

  it("dispatches to followup builder for followup.schedule", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({ task: { id: "t1", type: "followup.schedule", title: null, payload_json: {} } }),
    );
    expect(result.artifact_kind).toBe("followup");
  });

  it("dispatches to missing_info builder for request_missing_info", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({
        task: { id: "t1", type: "request_missing_info", title: null, payload_json: {} },
      }),
    );
    expect(result.artifact_kind).toBe("missing_info");
  });

  it("dispatches to pdf_ready builder for pdf.generate", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({ task: { id: "t1", type: "pdf.generate", title: null, payload_json: {} } }),
    );
    expect(result.artifact_kind).toBe("pdf_ready");
  });

  it("ok is false when artifact status is blocked", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({
        task: { id: "t1", type: "request_missing_info", title: null, payload_json: {} },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.artifact_status).toBe("blocked");
  });

  it("ok is true when artifact status is generated", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({ task: { id: "t1", type: "doc.generate", title: null, payload_json: {} } }),
    );
    expect(result.ok).toBe(true);
  });

  it("meta includes task_id and task_type", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({ task: { id: "task-xyz", type: "doc.generate", title: null, payload_json: {} } }),
    );
    expect(result.meta.task_id).toBe("task-xyz");
    expect(result.meta.task_type).toBe("doc.generate");
  });

  it("meta includes generated_at as ISO string", () => {
    const now = new Date("2025-06-01T12:00:00Z");
    const result = buildPierreTaskExecutionResult(
      baseInput({
        task: { id: "t1", type: "doc.generate", title: null, payload_json: {} },
        now,
      }),
    );
    expect(result.meta.generated_at).toBe("2025-06-01T12:00:00.000Z");
  });

  it("meta has_employee_context is true when employee provided", () => {
    const result = buildPierreTaskExecutionResult(
      withEmployee(
        baseInput({ task: { id: "t1", type: "doc.generate", title: null, payload_json: {} } }),
        { id: "emp-1", name: "Alice" },
      ),
    );
    expect(result.meta.has_employee_context).toBe(true);
  });

  it("meta has_employee_context is false when no employee", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({ task: { id: "t1", type: "doc.generate", title: null, payload_json: {} } }),
    );
    expect(result.meta.has_employee_context).toBe(false);
  });

  it("includes quality object with score", () => {
    const result = buildPierreTaskExecutionResult(baseInput());
    expect(typeof result.quality.score).toBe("number");
    expect(result.quality.score).toBeGreaterThanOrEqual(0);
    expect(result.quality.score).toBeLessThanOrEqual(100);
  });

  it("meta domain is null for general documents", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({ task: { id: "t1", type: "doc.generate", title: null, payload_json: {} } }),
    );
    expect(result.meta.domain).toBeNull();
  });

  it("meta domain is onboarding when detected", () => {
    const result = buildPierreTaskExecutionResult(
      baseInput({
        task: {
          id: "t1",
          type: "doc.generate",
          title: "Plan d'onboarding",
          payload_json: {},
        },
      }),
    );
    expect(result.meta.domain).toBe("onboarding");
  });
});
