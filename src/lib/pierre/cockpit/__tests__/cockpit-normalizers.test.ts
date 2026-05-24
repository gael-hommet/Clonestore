// src/lib/pierre/cockpit/__tests__/cockpit-normalizers.test.ts
// Pierre Cockpit B31 — Normalizer unit tests.
// All normalizers must: never throw, handle null/undefined/malformed, use execute_at (not scheduled_for).

import { describe, it, expect } from "vitest";
import {
  normalizeMissionResponse,
  normalizeTaskList,
  normalizeDocumentList,
  normalizeEmployeeFileIndex,
  normalizeCloneADNProfile,
  normalizeCustomerSuccessReport,
  normalizeReleaseCandidateReport,
  normalizeGoldenScenarios,
  extractValidationAlerts,
  extractCockpitCardsFromMission,
  extractBrainHint,
  extractPremiumDocumentHint,
  extractCloneADNHint,
  normalizeAIStatus,
} from "../normalizers";
import type { PierreCockpitTaskSummary } from "../types";

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function makeTask(overrides: Partial<PierreCockpitTaskSummary> = {}): PierreCockpitTaskSummary {
  return {
    id: "task_001",
    missionId: "mission_001",
    type: "doc.generate",
    title: "Tâche test",
    description: null,
    status: "pending",
    riskLevel: "low",
    requiresValidation: false,
    isEmailTask: false,
    isSensitive: false,
    executeAt: null,
    blockedReason: null,
    createdAt: null,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// 1. normalizeMissionResponse
// ══════════════════════════════════════════════════════════════

describe("normalizeMissionResponse", () => {
  it("returns null for null input", () => {
    expect(normalizeMissionResponse(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeMissionResponse(undefined)).toBeNull();
  });

  it("returns null when id is missing", () => {
    expect(normalizeMissionResponse({ title: "No ID" })).toBeNull();
  });

  it("normalizes a minimal valid mission", () => {
    const result = normalizeMissionResponse({ id: "m1", title: "Test Mission" });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("m1");
    expect(result!.title).toBe("Test Mission");
    expect(result!.tasksTotal).toBe(0);
    expect(result!.tasksDone).toBe(0);
  });

  it("counts tasks correctly", () => {
    const raw = {
      id: "m1",
      title: "Mission",
      tasks: [
        { id: "t1", status: "completed" },
        { id: "t2", status: "done" },
        { id: "t3", status: "blocked" },
        { id: "t4", status: "pending" },
        { id: "t5", status: "awaiting_approval" },
      ],
    };
    const result = normalizeMissionResponse(raw);
    expect(result!.tasksTotal).toBe(5);
    expect(result!.tasksDone).toBe(2);
    expect(result!.tasksBlocked).toBe(1);
    expect(result!.tasksAwaiting).toBe(1);
  });

  it("extracts nested mission object", () => {
    const raw = {
      mission: { id: "nested_m1", title: "Nested Mission", status: "running" },
      tasks: [],
    };
    const result = normalizeMissionResponse(raw);
    expect(result!.id).toBe("nested_m1");
    expect(result!.status).toBe("running");
  });

  it("handles non-object gracefully", () => {
    expect(normalizeMissionResponse("string")).toBeNull();
    expect(normalizeMissionResponse(42)).toBeNull();
    expect(normalizeMissionResponse([])).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// 2. normalizeTaskList
// ══════════════════════════════════════════════════════════════

describe("normalizeTaskList", () => {
  it("returns empty array for null", () => {
    expect(normalizeTaskList(null)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeTaskList([])).toEqual([]);
  });

  it("filters out items without id", () => {
    const result = normalizeTaskList([{ title: "No ID" }]);
    expect(result).toHaveLength(0);
  });

  it("uses execute_at (not scheduled_for)", () => {
    const raw = [
      {
        id: "t1",
        type: "doc.generate",
        title: "Task",
        status: "pending",
        execute_at: "2026-06-01T10:00:00Z",
        scheduled_for: "2026-06-02T10:00:00Z", // must be ignored
      },
    ];
    const result = normalizeTaskList(raw);
    expect(result[0]!.executeAt).toBe("2026-06-01T10:00:00Z");
  });

  it("detects email tasks correctly", () => {
    const emailTypes = ["email.send", "email.draft", "send_email"];
    for (const type of emailTypes) {
      const result = normalizeTaskList([{ id: `t_${type}`, type, title: "T", status: "pending" }]);
      expect(result[0]!.isEmailTask).toBe(true);
    }
  });

  it("marks email.send as sensitive", () => {
    const result = normalizeTaskList([{ id: "t1", type: "email.send", title: "T", status: "pending" }]);
    expect(result[0]!.isSensitive).toBe(true);
  });

  it("marks approval_required tasks as sensitive", () => {
    const result = normalizeTaskList([
      { id: "t1", type: "doc.generate", title: "T", status: "pending", approval_required: true },
    ]);
    expect(result[0]!.requiresValidation).toBe(true);
    expect(result[0]!.isSensitive).toBe(true);
  });

  it("does NOT use level/event/payload (pierre_task_logs columns are banned)", () => {
    const raw = [{ id: "t1", type: "doc.generate", title: "T", status: "pending" }];
    const result = normalizeTaskList(raw);
    expect(result[0]).not.toHaveProperty("level");
    expect(result[0]).not.toHaveProperty("event");
    expect(result[0]).not.toHaveProperty("payload");
  });

  it("handles non-array input gracefully", () => {
    expect(normalizeTaskList("string")).toEqual([]);
    expect(normalizeTaskList(null)).toEqual([]);
    expect(normalizeTaskList(undefined)).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════
// 3. normalizeDocumentList
// ══════════════════════════════════════════════════════════════

describe("normalizeDocumentList", () => {
  it("returns empty array for null", () => {
    expect(normalizeDocumentList(null)).toEqual([]);
  });

  it("normalizes a document correctly", () => {
    const raw = [
      {
        id: "doc1",
        title: "Contrat CDI",
        doc_type: "hr_contract",
        status: "draft",
        payload_json: { quality_score: 87 },
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const result = normalizeDocumentList(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("doc1");
    expect(result[0]!.docType).toBe("hr_contract");
    expect(result[0]!.qualityScore).toBe(87);
  });

  it("detects PDF documents", () => {
    const raw = [{ id: "pdf1", doc_type: "pdf_contract", title: "PDF", status: "done" }];
    const result = normalizeDocumentList(raw);
    expect(result[0]!.isPdf).toBe(true);
  });

  it("filters out items without id", () => {
    const result = normalizeDocumentList([{ title: "No ID" }]);
    expect(result).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 4. normalizeEmployeeFileIndex
// ══════════════════════════════════════════════════════════════

describe("normalizeEmployeeFileIndex", () => {
  it("returns empty array for null", () => {
    expect(normalizeEmployeeFileIndex(null)).toEqual([]);
  });

  it("normalizes employee files from files array", () => {
    const raw = {
      files: [
        {
          employee: { id: "emp1", name: "Marie Dupont", email: "marie@example.com" },
          health_score: 82,
          risk_level: "low",
          open_tasks: [],
          missing_info: [],
        },
      ],
    };
    const result = normalizeEmployeeFileIndex(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Marie Dupont");
    expect(result[0]!.healthScore).toBe(82);
    expect(result[0]!.riskLevel).toBe("low");
  });

  it("builds missing info list from string array", () => {
    const raw = {
      files: [
        {
          employee: { id: "e1", name: "Test" },
          missing_info: ["contract_start_date", "emergency_contact"],
        },
      ],
    };
    const result = normalizeEmployeeFileIndex(raw);
    expect(result[0]!.missingInfo).toContain("contract_start_date");
    expect(result[0]!.missingInfo).toContain("emergency_contact");
  });
});

// ══════════════════════════════════════════════════════════════
// 5. normalizeCloneADNProfile
// ══════════════════════════════════════════════════════════════

describe("normalizeCloneADNProfile", () => {
  it("returns fallback for null", () => {
    const result = normalizeCloneADNProfile(null);
    expect(result.configured).toBe(false);
    expect(result.status).toBe("not_configured");
  });

  it("marks profile as configured when status is active", () => {
    const raw = {
      status: "active",
      score: 90,
      communication: { tone: "formel" },
      autonomy: { level: "supervised" },
      validation: { mode: "manual" },
    };
    const result = normalizeCloneADNProfile(raw);
    expect(result.configured).toBe(true);
    expect(result.tone).toBe("formel");
    expect(result.autonomy).toBe("supervised");
    expect(result.validationMode).toBe("manual");
    expect(result.score).toBe(90);
  });

  it("handles non-object gracefully", () => {
    expect(() => normalizeCloneADNProfile("string")).not.toThrow();
    const result = normalizeCloneADNProfile("string");
    expect(result.configured).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// 6. normalizeCustomerSuccessReport
// ══════════════════════════════════════════════════════════════

describe("normalizeCustomerSuccessReport", () => {
  it("returns fallback for null", () => {
    const result = normalizeCustomerSuccessReport(null);
    expect(result.tasksCompleted).toBe(0);
    expect(result.documentsProduced).toBe(0);
    expect(result.hoursEstimated).toBeNull();
  });

  it("normalizes ROI data", () => {
    const raw = {
      value: {
        hours_saved: 24,
        estimated_monthly_value_eur_low: 1200,
        estimated_monthly_value_eur_high: 2400,
      },
      health: { score: 78 },
      conversion: { score: 65 },
      retention: { score: 88 },
      metrics: { completed_tasks: 15, documents_total: 8 },
    };
    const result = normalizeCustomerSuccessReport(raw);
    expect(result.hoursEstimated).toBe(24);
    expect(result.valueEurLow).toBe(1200);
    expect(result.valueEurHigh).toBe(2400);
    expect(result.healthScore).toBe(78);
    expect(result.conversionScore).toBe(65);
    expect(result.retentionScore).toBe(88);
    expect(result.tasksCompleted).toBe(15);
    expect(result.documentsProduced).toBe(8);
  });
});

// ══════════════════════════════════════════════════════════════
// 7. normalizeReleaseCandidateReport
// ══════════════════════════════════════════════════════════════

describe("normalizeReleaseCandidateReport", () => {
  it("returns fallback for null", () => {
    const result = normalizeReleaseCandidateReport(null);
    expect(result.canStartCockpit).toBe(false);
    expect(result.score).toBe(0);
  });

  it("normalizes RC report with can_start_cockpit=true", () => {
    const raw = {
      status: "ready",
      score: 95,
      blocking_issues: [],
      release_decision: {
        can_start_cockpit: true,
        recommendation: "Démarrage autorisé.",
      },
    };
    const result = normalizeReleaseCandidateReport(raw);
    expect(result.status).toBe("ready");
    expect(result.score).toBe(95);
    expect(result.canStartCockpit).toBe(true);
    expect(result.blockingIssues).toBe(0);
    expect(result.recommendation).toBe("Démarrage autorisé.");
  });

  it("counts blocking issues from array length", () => {
    const raw = {
      status: "blocked",
      score: 42,
      blocking_issues: ["issue_a", "issue_b", "issue_c"],
      release_decision: { can_start_cockpit: false },
    };
    const result = normalizeReleaseCandidateReport(raw);
    expect(result.blockingIssues).toBe(3);
    expect(result.canStartCockpit).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// 8. normalizeGoldenScenarios
// ══════════════════════════════════════════════════════════════

describe("normalizeGoldenScenarios", () => {
  it("returns empty array for null", () => {
    expect(normalizeGoldenScenarios(null)).toEqual([]);
  });

  it("normalizes scenario list", () => {
    const raw = {
      scenarios: [
        {
          id: "gs_001",
          official_id: "onboarding_cdi",
          label: "Onboarding CDI",
          description: "Test onboarding flow",
          positive: true,
          domain: "onboarding",
        },
      ],
    };
    const result = normalizeGoldenScenarios(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("gs_001");
    expect(result[0]!.officialId).toBe("onboarding_cdi");
    expect(result[0]!.positive).toBe(true);
    expect(result[0]!.domain).toBe("onboarding");
  });

  it("filters out scenarios without id", () => {
    const raw = {
      scenarios: [
        { label: "No ID", description: "X", positive: true },
      ],
    };
    const result = normalizeGoldenScenarios(raw);
    expect(result).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 9. extractValidationAlerts
// ══════════════════════════════════════════════════════════════

describe("extractValidationAlerts", () => {
  it("returns empty array for empty task list", () => {
    expect(extractValidationAlerts([])).toEqual([]);
  });

  it("includes tasks with requiresValidation=true", () => {
    const tasks = [
      makeTask({ id: "t1", requiresValidation: true, type: "email.send", isEmailTask: true, isSensitive: true }),
      makeTask({ id: "t2", requiresValidation: false }),
    ];
    const result = extractValidationAlerts(tasks);
    expect(result).toHaveLength(1);
    expect(result[0]!.taskId).toBe("t1");
    expect(result[0]!.isEmailTask).toBe(true);
    expect(result[0]!.requiresHuman).toBe(true);
  });

  it("includes tasks with awaiting_approval status", () => {
    const tasks = [makeTask({ id: "t3", status: "awaiting_approval", requiresValidation: false })];
    const result = extractValidationAlerts(tasks);
    expect(result).toHaveLength(1);
    expect(result[0]!.taskId).toBe("t3");
  });

  it("never includes non-validation tasks", () => {
    const tasks = [
      makeTask({ id: "t1", status: "running",  requiresValidation: false }),
      makeTask({ id: "t2", status: "done",     requiresValidation: false }),
      makeTask({ id: "t3", status: "cancelled",requiresValidation: false }),
    ];
    expect(extractValidationAlerts(tasks)).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 10. extractCockpitCardsFromMission
// ══════════════════════════════════════════════════════════════

describe("extractCockpitCardsFromMission", () => {
  it("returns empty array for null mission", () => {
    const result = extractCockpitCardsFromMission(null, [], []);
    expect(result).toEqual([]);
  });

  it("includes mission card and document cards", () => {
    const mission = normalizeMissionResponse({ id: "m1", title: "Mission X" })!;
    const tasks = normalizeTaskList([
      { id: "t1", type: "doc.generate", title: "Task 1", status: "pending" },
    ]);
    const docs = normalizeDocumentList([
      { id: "d1", title: "Contract", doc_type: "hr_contract", status: "draft" },
    ]);
    const cards = extractCockpitCardsFromMission(mission, tasks, docs);
    expect(cards.some((c) => c.kind === "mission")).toBe(true);
    expect(cards.some((c) => c.kind === "document")).toBe(true);
  });

  it("includes validation cards for approval_required tasks", () => {
    const mission = normalizeMissionResponse({ id: "m1", title: "Mission X" })!;
    const tasks = normalizeTaskList([
      { id: "t1", type: "email.send", title: "Send Email", status: "awaiting_approval", approval_required: true },
    ]);
    const cards = extractCockpitCardsFromMission(mission, tasks, []);
    expect(cards.some((c) => c.kind === "validation")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// 11. extractBrainHint
// ══════════════════════════════════════════════════════════════

describe("extractBrainHint", () => {
  it("returns null for null", () => {
    expect(extractBrainHint(null)).toBeNull();
  });

  it("extracts brain_final_hint", () => {
    const raw = { brain_final_hint: { domain: "onboarding", score: 95 } };
    const result = extractBrainHint(raw);
    expect(result).not.toBeNull();
    expect(result!.domain).toBe("onboarding");
  });

  it("returns null if hint is not an object", () => {
    expect(extractBrainHint({ brain_final_hint: "string" })).toBeNull();
    expect(extractBrainHint({ brain_final_hint: 42 })).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// 12. extractPremiumDocumentHint
// ══════════════════════════════════════════════════════════════

describe("extractPremiumDocumentHint", () => {
  it("returns null for null", () => {
    expect(extractPremiumDocumentHint(null)).toBeNull();
  });

  it("extracts from context_snapshot_json", () => {
    const raw = {
      context_snapshot_json: {
        document_template_capability: { available: true, templates: ["cdi"] },
      },
    };
    const result = extractPremiumDocumentHint(raw);
    expect(result).not.toBeNull();
    expect(result!.available).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// 13. extractCloneADNHint
// ══════════════════════════════════════════════════════════════

describe("extractCloneADNHint", () => {
  it("returns null for null", () => {
    expect(extractCloneADNHint(null)).toBeNull();
  });

  it("extracts cloneadn_hint from context_snapshot_json", () => {
    const raw = {
      context_snapshot_json: {
        cloneadn_hint: { tone: "formel", configured: true },
      },
    };
    const result = extractCloneADNHint(raw);
    expect(result!.tone).toBe("formel");
  });
});

// ══════════════════════════════════════════════════════════════
// 14. normalizeAIStatus
// ══════════════════════════════════════════════════════════════

describe("normalizeAIStatus", () => {
  it("returns safe fallback for null", () => {
    const result = normalizeAIStatus(null);
    expect(result.configured).toBe(false);
    expect(result.providersCount).toBe(0);
    expect(result.contractsCount).toBe(0);
  });

  it("normalizes AI status data from providers array", () => {
    const raw = {
      providers: [
        { provider: "openai", configured: true },
        { provider: "anthropic", configured: true },
      ],
      prompt_contracts_count: 15,
    };
    const result = normalizeAIStatus(raw);
    expect(result.configured).toBe(true);
    expect(result.providersCount).toBe(2);
    expect(result.contractsCount).toBe(15);
  });

  it("marks as not configured when providers array is empty", () => {
    const raw = { providers: [], prompt_contracts_count: 0 };
    const result = normalizeAIStatus(raw);
    expect(result.configured).toBe(false);
    expect(result.providersCount).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 15. INVARIANT: normalizers never throw
// ══════════════════════════════════════════════════════════════

describe("normalizer robustness", () => {
  const EVIL_INPUTS = [null, undefined, "", 0, false, [], {}, "garbage", { id: null }];

  it.each(EVIL_INPUTS)("normalizeMissionResponse(%p) never throws", (input) => {
    expect(() => normalizeMissionResponse(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("normalizeTaskList(%p) never throws", (input) => {
    expect(() => normalizeTaskList(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("normalizeDocumentList(%p) never throws", (input) => {
    expect(() => normalizeDocumentList(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("normalizeEmployeeFileIndex(%p) never throws", (input) => {
    expect(() => normalizeEmployeeFileIndex(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("normalizeCloneADNProfile(%p) never throws", (input) => {
    expect(() => normalizeCloneADNProfile(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("normalizeCustomerSuccessReport(%p) never throws", (input) => {
    expect(() => normalizeCustomerSuccessReport(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("normalizeReleaseCandidateReport(%p) never throws", (input) => {
    expect(() => normalizeReleaseCandidateReport(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("normalizeGoldenScenarios(%p) never throws", (input) => {
    expect(() => normalizeGoldenScenarios(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("normalizeAIStatus(%p) never throws", (input) => {
    expect(() => normalizeAIStatus(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("extractBrainHint(%p) never throws", (input) => {
    expect(() => extractBrainHint(input)).not.toThrow();
  });

  it.each(EVIL_INPUTS)("extractValidationAlerts with bad task list", (input) => {
    expect(() => extractValidationAlerts(input as PierreCockpitTaskSummary[])).not.toThrow();
  });
});
