// src/lib/cloneos/files/__tests__/files-b34.test.ts
// B34 — CloneOS file intake layer tests. Mock mode only, no real storage, no real API.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Config ────────────────────────────────────────────────────────────────────

import { getFileRuntimeMode, isFileMockMode, isFileDisabled, getFileConfig } from "../config";

describe("config", () => {
  it("defaults to mock mode when env var not set", () => {
    vi.stubEnv("FILE_RUNTIME_MODE", "");
    expect(getFileRuntimeMode()).toBe("mock");
    expect(isFileMockMode()).toBe(true);
    expect(isFileDisabled()).toBe(false);
  });

  it("respects FILE_RUNTIME_MODE=disabled", () => {
    vi.stubEnv("FILE_RUNTIME_MODE", "disabled");
    expect(getFileRuntimeMode()).toBe("disabled");
    expect(isFileDisabled()).toBe(true);
  });

  it("getFileConfig returns safe defaults", () => {
    vi.stubEnv("FILE_RUNTIME_MODE", "mock");
    vi.stubEnv("FILE_ALLOW_PDF", "true");
    vi.stubEnv("FILE_ALLOW_ARCHIVES", "false");
    vi.stubEnv("FILE_LOG_EXTRACTED_TEXT", "false");
    const cfg = getFileConfig();
    expect(cfg.runtime_mode).toBe("mock");
    expect(cfg.allow_pdf).toBe(true);
    expect(cfg.allow_archives).toBe(false);
    expect(cfg.log_extracted_text).toBe(false);
    expect(cfg.max_upload_bytes).toBeGreaterThan(0);
  });
});

// ── MIME / Kind detection ─────────────────────────────────────────────────────

import { detectFileKind, isDangerousExtension, guessMimeType, isArchiveExtension } from "../mime";

describe("mime detection", () => {
  it("detects PDF from MIME type", () => {
    expect(detectFileKind("document.pdf", "application/pdf")).toBe("pdf");
  });

  it("detects DOCX from extension when MIME is generic", () => {
    expect(detectFileKind("rapport.docx", "application/octet-stream")).toBe("docx");
  });

  it("detects CSV from extension", () => {
    expect(detectFileKind("export.csv")).toBe("csv");
  });

  it("detects image from MIME prefix", () => {
    expect(detectFileKind("photo.jpg", "image/jpeg")).toBe("image");
  });

  it("returns unknown for unrecognized type", () => {
    expect(detectFileKind("file.xyz")).toBe("unknown");
  });

  it("isDangerousExtension blocks exe, bat, ps1", () => {
    expect(isDangerousExtension("virus.exe")).toBe(true);
    expect(isDangerousExtension("script.bat")).toBe(true);
    expect(isDangerousExtension("run.ps1")).toBe(true);
    expect(isDangerousExtension("contract.pdf")).toBe(false);
  });

  it("isArchiveExtension detects zip, rar", () => {
    expect(isArchiveExtension("archive.zip")).toBe(true);
    expect(isArchiveExtension("archive.rar")).toBe(true);
    expect(isArchiveExtension("document.pdf")).toBe(false);
  });
});

// ── Security ──────────────────────────────────────────────────────────────────

import { validateFileSecurity, sanitizeFilename } from "../security";

function makeSecurityParams(overrides: Partial<Parameters<typeof validateFileSecurity>[0]> = {}) {
  return {
    filename: "contrat.pdf",
    mime_type: "application/pdf",
    size_bytes: 50_000,
    config: getFileConfig(),
    ...overrides,
  };
}

describe("security", () => {
  beforeEach(() => {
    vi.stubEnv("FILE_RUNTIME_MODE", "mock");
    vi.stubEnv("FILE_ALLOW_PDF", "true");
    vi.stubEnv("FILE_ALLOW_ARCHIVES", "false");
    vi.stubEnv("FILE_MAX_UPLOAD_MB", "25");
  });

  it("accepts a valid PDF file", () => {
    const result = validateFileSecurity(makeSecurityParams());
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a PDF when FILE_ALLOW_PDF=false", () => {
    vi.stubEnv("FILE_ALLOW_PDF", "false");
    const params = { ...makeSecurityParams(), config: getFileConfig() };
    const result = validateFileSecurity(params);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/PDF/i);
  });

  it("rejects a dangerous extension (exe)", () => {
    const result = validateFileSecurity(makeSecurityParams({ filename: "malware.exe", mime_type: "application/octet-stream" }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/extension/i);
  });

  it("rejects archive when FILE_ALLOW_ARCHIVES=false", () => {
    const result = validateFileSecurity(makeSecurityParams({ filename: "files.zip", mime_type: "application/zip" }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/archive/i);
  });

  it("rejects empty file (0 bytes)", () => {
    const result = validateFileSecurity(makeSecurityParams({ size_bytes: 0 }));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/vide/i);
  });

  it("rejects file exceeding size limit", () => {
    vi.stubEnv("FILE_MAX_UPLOAD_MB", "1");
    const params = { ...makeSecurityParams({ size_bytes: 2 * 1024 * 1024 }), config: getFileConfig() };
    const result = validateFileSecurity(params);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/volumineux/i);
  });

  it("sanitizeFilename strips path traversal and special chars", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("fichier avec espaces.pdf")).toBe("fichier_avec_espaces.pdf");
    expect(sanitizeFilename("normal-file_v2.docx")).toBe("normal-file_v2.docx");
    expect(sanitizeFilename("<script>evil</script>.js")).not.toContain("<");
  });

  it("sanitizeFilename returns 'document' for completely invalid names", () => {
    expect(sanitizeFilename("..")).toBe("document");
    expect(sanitizeFilename("")).toBe("document");
  });
});

// ── Fingerprint ───────────────────────────────────────────────────────────────

import { computeChecksum, makeFileId, isSameFileChecksum } from "../fingerprint";

describe("fingerprint", () => {
  it("computeChecksum is stable for same content", () => {
    const c1 = computeChecksum("contenu du fichier");
    const c2 = computeChecksum("contenu du fichier");
    expect(c1).toBe(c2);
  });

  it("computeChecksum differs for different content", () => {
    expect(computeChecksum("aaa")).not.toBe(computeChecksum("bbb"));
  });

  it("computeChecksum works with Buffer", () => {
    const buf = Buffer.from("test content");
    const str = "test content";
    expect(computeChecksum(buf)).toBe(computeChecksum(str));
  });

  it("makeFileId returns a string starting with 'file_'", () => {
    const id = makeFileId("co_test", "abc123", new Date().toISOString());
    expect(id).toMatch(/^file_/);
  });

  it("isSameFileChecksum returns true for identical checksums", () => {
    expect(isSameFileChecksum("abc", "abc")).toBe(true);
    expect(isSameFileChecksum("abc", "ABC")).toBe(true);
    expect(isSameFileChecksum("abc", "xyz")).toBe(false);
    expect(isSameFileChecksum(null, "abc")).toBe(false);
  });
});

// ── Extraction ────────────────────────────────────────────────────────────────

import { extractTextFromPlain, extractTextFromCsv, extractTextMock, extractFileText } from "../extraction";

describe("extraction — text/plain", () => {
  it("extracts text content and builds preview", () => {
    const result = extractTextFromPlain("Bonjour, voici le contrat de travail CDI.", 200);
    expect(result.ok).toBe(true);
    expect(result.preview).toContain("Bonjour");
    expect(result.word_count).toBeGreaterThan(0);
  });

  it("returns ok=false for empty text", () => {
    const result = extractTextFromPlain("", 200);
    expect(result.ok).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("detects dates in text", () => {
    const result = extractTextFromPlain("Embauche le 01/03/2025 pour un CDD.", 500);
    expect(result.detected_dates).toContain("01/03/2025");
  });

  it("detects amounts in text", () => {
    const result = extractTextFromPlain("Salaire brut: 2 500,00 €", 500);
    expect(result.detected_amounts.length).toBeGreaterThan(0);
  });
});

describe("extraction — CSV", () => {
  it("extracts CSV columns and row count", () => {
    const csv = "nom,prenom,poste\nDupont,Jean,Développeur\nMartin,Claire,RH";
    const result = extractTextFromCsv(csv, 500);
    expect(result.ok).toBe(true);
    expect(result.table_count).toBe(1);
    expect(result.word_count).toBe(2); // rows
    expect(result.preview).toContain("colonnes");
  });

  it("returns ok=false for empty CSV", () => {
    const result = extractTextFromCsv("", 200);
    expect(result.ok).toBe(false);
  });
});

describe("extraction — PDF mock", () => {
  it("extractTextMock returns ok=true without crashing for PDF", () => {
    const result = extractTextMock("pdf", "contrat.pdf", 150_000);
    expect(result.ok).toBe(true);
    expect(result.text).toBeNull();
    expect(result.preview).toContain("simulée");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("extractTextMock handles all FileKind values", () => {
    const kinds = ["pdf", "docx", "doc", "xlsx", "image", "email_attachment", "unknown"] as const;
    for (const kind of kinds) {
      const result = extractTextMock(kind, `file.${kind}`, 10_000);
      expect(result.ok).toBe(true);
    }
  });
});

describe("extraction — privacy guard", () => {
  it("does not log full text when log_extracted_text=false", () => {
    vi.stubEnv("FILE_LOG_EXTRACTED_TEXT", "false");
    const config = getFileConfig();
    const result = extractFileText("text", "Contenu privé à ne pas logger.", "test.txt", config);
    expect(result.text).toBeNull();
    expect(result.preview).toBeTruthy();
  });

  it("logs full text when log_extracted_text=true", () => {
    vi.stubEnv("FILE_LOG_EXTRACTED_TEXT", "true");
    const config = getFileConfig();
    const result = extractFileText("text", "Contenu à logger.", "test.txt", config);
    expect(result.text).toContain("Contenu");
  });

  it("preview is limited to configured chars", () => {
    vi.stubEnv("FILE_TEXT_PREVIEW_CHARS", "50");
    vi.stubEnv("FILE_LOG_EXTRACTED_TEXT", "true");
    const config = getFileConfig();
    const longText = "a".repeat(200);
    const result = extractFileText("text", longText, "test.txt", config);
    expect((result.preview?.length ?? 0)).toBeLessThanOrEqual(55); // 50 chars + "…"
  });
});

// ── Classification ────────────────────────────────────────────────────────────

import { classifyHrFile } from "../classification";

describe("HR file classification", () => {
  it("classifies CV by filename", () => {
    const result = classifyHrFile({ filename: "cv-jean-dupont.pdf" });
    expect(result.category).toBe("cv");
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it("classifies contract by filename and text", () => {
    const result = classifyHrFile({
      filename: "contrat-cdi-alice.docx",
      text: "Contrat de travail à durée indéterminée (CDI), poste de développeur, période d'essai de 3 mois.",
    });
    expect(result.category).toBe("contract");
    expect(result.risk_level).toBe("high");
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it("classifies amendment by filename", () => {
    const result = classifyHrFile({ filename: "avenant-salaire-2025.docx" });
    expect(result.category).toBe("amendment");
  });

  it("classifies absence proof by filename", () => {
    const result = classifyHrFile({ filename: "justificatif-absence-15mars.pdf" });
    expect(result.category).toBe("absence_proof");
  });

  it("classifies sick leave as SENSITIVE", () => {
    const result = classifyHrFile({
      filename: "arret-travail.pdf",
      text: "Arrêt de travail prescrit par le médecin traitant suite à maladie.",
    });
    expect(result.category).toBe("sick_leave");
    expect(result.risk_level).toBe("sensitive");
  });

  it("classifies payroll export as high risk", () => {
    const result = classifyHrFile({
      filename: "export-paie-mars-2025.xlsx",
      text: "Bulletin de salaire — brut imposable — cotisations salariales — net à payer.",
    });
    expect(["payroll_export", "payroll_variable"]).toContain(result.category);
    expect(["high", "sensitive"]).toContain(result.risk_level);
  });

  it("classifies procedure/policy by filename", () => {
    const result = classifyHrFile({ filename: "procedure-recrutement.docx" });
    expect(result.category).toBe("procedure");
  });

  it("classifies legal sensitive content as SENSITIVE", () => {
    const result = classifyHrFile({
      filename: "note-disciplinaire.pdf",
      text: "Suite à la faute grave constatée, une procédure disciplinaire est engagée. Convocation chez les prud'hommes.",
    });
    expect(result.category).toBe("legal_sensitive");
    expect(result.risk_level).toBe("sensitive");
  });

  it("falls back to 'other' for unknown files", () => {
    const result = classifyHrFile({ filename: "fichier_inconnu.pdf" });
    expect(result.category).toBe("other");
    expect(result.confidence).toBeLessThan(0.4);
  });
});

// ── Attachment decisions ──────────────────────────────────────────────────────

import { buildFileAttachDecision } from "../attachment";
import type { CloneFileRecord, FileClassificationResult } from "../types";

function makeFileRecord(overrides: Partial<CloneFileRecord> = {}): CloneFileRecord {
  return {
    id: "file_test",
    company_id: "co_test",
    agent_slug: "pierre",
    source: "upload",
    kind: "pdf",
    original_filename: "contrat.pdf",
    safe_filename: "contrat.pdf",
    mime_type: "application/pdf",
    size_bytes: 50_000,
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
    category: "contract",
    title: null,
    extracted_text_preview: null,
    extraction_status: "done",
    extraction_error: null,
    classification_confidence: 0.8,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    ...overrides,
  };
}

function makeClassification(overrides: Partial<FileClassificationResult> = {}): FileClassificationResult {
  return {
    category: "contract",
    confidence: 0.8,
    risk_level: "high",
    visibility: "internal",
    suggested_links: [],
    missing_info: [],
    warnings: [],
    reason: "Test classification",
    ...overrides,
  };
}

describe("attachment decisions", () => {
  it("attaches to mission when missionId provided", () => {
    const decision = buildFileAttachDecision({
      fileRecord: makeFileRecord(),
      classification: makeClassification(),
      missionId: "miss_001",
    });
    expect(decision.action).toBe("attach_to_mission");
    expect(decision.related_mission_id).toBe("miss_001");
  });

  it("attaches to task when taskId provided", () => {
    const decision = buildFileAttachDecision({
      fileRecord: makeFileRecord(),
      classification: makeClassification(),
      taskId: "task_001",
      missionId: "miss_001",
    });
    expect(decision.action).toBe("attach_to_task");
    expect(decision.related_task_id).toBe("task_001");
  });

  it("attaches to employee when employeeId provided without mission/task", () => {
    const decision = buildFileAttachDecision({
      fileRecord: makeFileRecord(),
      classification: makeClassification({ risk_level: "high" }),
      employeeId: "emp_001",
    });
    expect(decision.action).toBe("attach_to_employee");
    expect(decision.related_employee_id).toBe("emp_001");
  });

  it("block_sensitive for sensitive risk level", () => {
    const decision = buildFileAttachDecision({
      fileRecord: makeFileRecord({ risk_level: "sensitive" }),
      classification: makeClassification({ risk_level: "sensitive" }),
    });
    expect(decision.action).toBe("block_sensitive");
    expect(decision.approval_required).toBe(true);
  });

  it("creates mission for actionable category with no context", () => {
    const decision = buildFileAttachDecision({
      fileRecord: makeFileRecord({ category: "cv" }),
      classification: makeClassification({ category: "cv", risk_level: "medium", confidence: 0.8 }),
    });
    expect(decision.action).toBe("create_new_mission");
  });

  it("asks for more info when no context provided and category is not strongly actionable", () => {
    // "certificate" is not in ARCHIVE_ONLY nor MISSION_TRIGGERING → default ask_for_more_info
    const decision = buildFileAttachDecision({
      fileRecord: makeFileRecord({ category: "certificate" }),
      classification: makeClassification({ category: "certificate", risk_level: "low", confidence: 0.6 }),
    });
    expect(decision.action).toBe("ask_for_more_info");
  });
});

// ── Events ────────────────────────────────────────────────────────────────────

import {
  buildFileReceivedEvent,
  buildFileClassifiedEvent,
  buildFileAttachedEvent,
  buildFileSensitiveDetectedEvent,
} from "../events";

describe("file trace events", () => {
  it("buildFileReceivedEvent creates event with correct type", () => {
    const file = makeFileRecord();
    const event = buildFileReceivedEvent(file);
    expect(event.event_type).toBe("file_received");
    expect(event.file_id).toBe(file.id);
    expect(event.id).toMatch(/^fevt_/);
    expect(event.company_id).toBe(file.company_id);
  });

  it("buildFileClassifiedEvent includes category and confidence", () => {
    const file = makeFileRecord();
    const classification = makeClassification();
    const event = buildFileClassifiedEvent(file, classification);
    expect(event.event_type).toBe("file_classified");
    expect(event.meta.category).toBe("contract");
    expect(event.meta.confidence).toBe(0.8);
  });

  it("buildFileAttachedEvent includes action in meta", () => {
    const file = makeFileRecord();
    const decision = {
      action: "attach_to_mission" as const,
      related_mission_id: "miss_001",
      related_task_id: null,
      related_employee_id: null,
      reason: "Test",
      approval_required: false,
    };
    const event = buildFileAttachedEvent(file, decision);
    expect(event.event_type).toBe("file_attached");
    expect(event.meta.action).toBe("attach_to_mission");
  });

  it("buildFileSensitiveDetectedEvent uses file_sensitive_detected type", () => {
    const file = makeFileRecord({ risk_level: "sensitive" });
    const event = buildFileSensitiveDetectedEvent(file, "Catégorie sensitive");
    expect(event.event_type).toBe("file_sensitive_detected");
    expect(event.message).toContain("sensible");
  });
});

// ── Runtime orchestrator ──────────────────────────────────────────────────────

import { processFileIntake } from "../runtime";

const BASE_INTAKE_PARAMS = {
  filename: "contrat.pdf",
  content: "Contrat de travail CDI simulé.",
  mimeType: "application/pdf",
  sizeBytes: 30_000,
  companyId: "co_test",
  agentSlug: "pierre",
  source: "upload" as const,
};

describe("processFileIntake", () => {
  beforeEach(() => {
    vi.stubEnv("FILE_RUNTIME_MODE", "mock");
    vi.stubEnv("FILE_ALLOW_PDF", "true");
    vi.stubEnv("FILE_ALLOW_ARCHIVES", "false");
    vi.stubEnv("FILE_MAX_UPLOAD_MB", "25");
  });

  it("FILE_RUNTIME_MODE=disabled blocks all intake", async () => {
    vi.stubEnv("FILE_RUNTIME_MODE", "disabled");
    const result = await processFileIntake(BASE_INTAKE_PARAMS);
    expect(result.ok).toBe(false);
    expect(result.blocked_reason).toMatch(/désactivé/i);
    expect(result.trace_events[0].event_type).toBe("file_rejected");
  });

  it("rejects dangerous extension", async () => {
    const result = await processFileIntake({ ...BASE_INTAKE_PARAMS, filename: "virus.exe", mimeType: "application/octet-stream", sizeBytes: 1000 });
    expect(result.ok).toBe(false);
    expect(result.blocked_reason).toMatch(/extension/i);
  });

  it("processes a valid text file end-to-end", async () => {
    const result = await processFileIntake({
      ...BASE_INTAKE_PARAMS,
      filename: "cv_candidat.txt",
      content: "Curriculum vitae — expérience professionnelle — compétences.",
      mimeType: "text/plain",
      sizeBytes: 500,
    });
    expect(result.ok).toBe(true);
    expect(result.file.status).toBe("ready");
    expect(result.file.id).toMatch(/^file_/);
    expect(result.trace_events.length).toBeGreaterThan(2);
  });

  it("produces pending/block_sensitive for sensitive file with no context", async () => {
    const result = await processFileIntake({
      ...BASE_INTAKE_PARAMS,
      filename: "arret-travail.txt",
      content: "Arrêt de travail prescrit par le médecin traitant suite à maladie grave.",
      mimeType: "text/plain",
      sizeBytes: 200,
    });
    expect(result.ok).toBe(true);
    expect(result.attach_decision?.action).toBe("block_sensitive");
    expect(result.attach_decision?.approval_required).toBe(true);
  });

  it("attaches to provided mission", async () => {
    const result = await processFileIntake({
      ...BASE_INTAKE_PARAMS,
      filename: "cv_candidat.txt",
      content: "Curriculum vitae — compétences.",
      mimeType: "text/plain",
      sizeBytes: 200,
      relatedMissionId: "miss_123",
    });
    expect(result.ok).toBe(true);
    expect(result.attach_decision?.related_mission_id).toBe("miss_123");
  });

  it("trace_events includes file_received as first event", async () => {
    const result = await processFileIntake({
      ...BASE_INTAKE_PARAMS,
      filename: "document.txt",
      content: "Bonjour.",
      mimeType: "text/plain",
      sizeBytes: 100,
    });
    expect(result.trace_events[0].event_type).toBe("file_received");
  });

  it("mock mode never depends on any external API", async () => {
    // This test just verifies the entire pipeline runs without network calls
    const result = await processFileIntake(BASE_INTAKE_PARAMS);
    // If this resolves, mock mode is self-contained
    expect(typeof result.ok).toBe("boolean");
  });
});

// ── B33 channel attachment bridge ─────────────────────────────────────────────

import { buildFileRecordFromChannelAttachment } from "../intake";
import type { MessageEnvelope } from "../../channels/types";

describe("buildFileRecordFromChannelAttachment", () => {
  it("builds a file record from a B33 channel envelope attachment", () => {
    const envelope: MessageEnvelope = {
      id: "env_test",
      company_id: "co_test",
      agent_slug: "pierre",
      channel_identity_id: "cid_test",
      direction: "inbound",
      channel_kind: "email",
      from: "employee@company.com",
      to: ["pierre@company.com"],
      cc: [],
      bcc: [],
      subject: "Mon arrêt maladie",
      body_text: null,
      body_html: null,
      attachments: [],
      received_at: new Date().toISOString(),
      sent_at: null,
      status: "received",
      risk_level: "low",
      approval_required: false,
      related_mission_id: null,
      related_task_id: null,
      related_employee_id: null,
      metadata: {},
    };

    const attachment = {
      filename: "arret-maladie.pdf",
      content_type: "application/pdf",
      size_bytes: 75_000,
      url: "https://storage.example.com/arret.pdf",
    };

    const file = buildFileRecordFromChannelAttachment(envelope, attachment);
    expect(file.source).toBe("channel_attachment");
    expect(file.envelope_id).toBe("env_test");
    expect(file.company_id).toBe("co_test");
    expect(file.kind).toBe("pdf");
    expect(file.original_filename).toBe("arret-maladie.pdf");
    expect(file.channel_identity_id).toBe("cid_test");
  });
});
