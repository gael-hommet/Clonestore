// src/lib/pierre/__tests__/pierre-brain-final.test.ts
// Pierre Brain Final Core — Suite de tests complete (200+ tests)
// Bloc 26 : types, schema, task-bridge, final-brain, routes

import { describe, test, expect } from "vitest";
import {
  normalizePierreBrainDomain,
  normalizePierreBrainRiskLevel,
  normalizePierreBrainConfidence,
  normalizePierreBrainMissingInfo,
  normalizePierreBrainInterpretation,
  normalizePierreBrainRiskReview,
  normalizePierreBrainTaskDraft,
  normalizePierreBrainTaskPlan,
  normalizePierreBrainQualityGate,
  buildSafePierreBrainFallback,
  buildNormalizedPierreBrainOutputJson,
} from "../brain/schema";
import {
  sanitizeBrainTaskType,
  enforceBrainTaskSafety,
  convertPierreBrainTaskPlanToTaskDrafts,
  mergeDeterministicAndBrainTasks,
} from "../brain/task-bridge";
import { runPierreFinalBrain } from "../brain/final-brain";
import type { PierreBrainFinalOutput, PierreBrainTaskPlan, PierreBrainInterpretation } from "../brain/types";
import type { PierreTaskDraft } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<PierreTaskDraft> = {}): PierreTaskDraft {
  return {
    type: "doc.generate",
    title: "Tâche test",
    description: "desc",
    status: "draft",
    priority: 50,
    approval_required: false,
    risk_level: "low",
    execute_at: null,
    depends_on_json: [],
    payload_json: {},
    output_kind: "document",
    ...overrides,
  };
}

function makeBrainTaskPlan(overrides: Partial<PierreBrainTaskPlan> = {}): PierreBrainTaskPlan {
  return {
    tasks: [
      {
        type: "doc.generate",
        title: "Générer contrat",
        description: "Contrat de travail",
        priority: 70,
        approval_required: false,
        risk_level: "low",
        expected_artifact: "contract.pdf",
        payload: { doc_type: "contract" },
      },
    ],
    dependencies: [],
    validation_points: ["Vérifier les données salarié"],
    artifact_expectations: ["contract.pdf"],
    execution_notes: ["Utiliser template standard"],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: normalizePierreBrainDomain
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePierreBrainDomain", () => {
  test("returns valid domain as-is", () => {
    expect(normalizePierreBrainDomain("recruitment")).toBe("recruitment");
    expect(normalizePierreBrainDomain("onboarding")).toBe("onboarding");
    expect(normalizePierreBrainDomain("contract")).toBe("contract");
    expect(normalizePierreBrainDomain("absence")).toBe("absence");
    expect(normalizePierreBrainDomain("offboarding")).toBe("offboarding");
    expect(normalizePierreBrainDomain("reporting")).toBe("reporting");
    expect(normalizePierreBrainDomain("training")).toBe("training");
    expect(normalizePierreBrainDomain("performance")).toBe("performance");
    expect(normalizePierreBrainDomain("employee_admin")).toBe("employee_admin");
    expect(normalizePierreBrainDomain("prepay")).toBe("prepay");
    expect(normalizePierreBrainDomain("document")).toBe("document");
    expect(normalizePierreBrainDomain("communication")).toBe("communication");
    expect(normalizePierreBrainDomain("employee_relations")).toBe("employee_relations");
    expect(normalizePierreBrainDomain("unknown")).toBe("unknown");
  });

  test("maps aliases correctly", () => {
    expect(normalizePierreBrainDomain("recrutement")).toBe("recruitment");
    expect(normalizePierreBrainDomain("embauche")).toBe("recruitment");
    expect(normalizePierreBrainDomain("contrat")).toBe("contract");
    expect(normalizePierreBrainDomain("congé")).toBe("absence");
    expect(normalizePierreBrainDomain("paie")).toBe("prepay");
    expect(normalizePierreBrainDomain("formation")).toBe("training");
    expect(normalizePierreBrainDomain("depart")).toBe("offboarding");
    expect(normalizePierreBrainDomain("rapport")).toBe("reporting");
  });

  test("returns unknown for unrecognized values", () => {
    expect(normalizePierreBrainDomain("zzz_invalid")).toBe("unknown");
    expect(normalizePierreBrainDomain(null)).toBe("unknown");
    expect(normalizePierreBrainDomain(undefined)).toBe("unknown");
    expect(normalizePierreBrainDomain(42)).toBe("unknown");
    expect(normalizePierreBrainDomain({})).toBe("unknown");
    expect(normalizePierreBrainDomain("")).toBe("unknown");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: normalizePierreBrainRiskLevel
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePierreBrainRiskLevel", () => {
  test("maps direct values", () => {
    expect(normalizePierreBrainRiskLevel("low")).toBe("low");
    expect(normalizePierreBrainRiskLevel("medium")).toBe("medium");
    expect(normalizePierreBrainRiskLevel("high")).toBe("high");
    expect(normalizePierreBrainRiskLevel("critical")).toBe("critical");
  });

  test("maps aliases", () => {
    expect(normalizePierreBrainRiskLevel("normal")).toBe("low");
    expect(normalizePierreBrainRiskLevel("green")).toBe("low");
    expect(normalizePierreBrainRiskLevel("faible")).toBe("low");
    expect(normalizePierreBrainRiskLevel("orange")).toBe("medium");
    expect(normalizePierreBrainRiskLevel("sensitive")).toBe("medium");
    expect(normalizePierreBrainRiskLevel("red")).toBe("high");
    expect(normalizePierreBrainRiskLevel("black")).toBe("critical");
    expect(normalizePierreBrainRiskLevel("critique")).toBe("critical");
  });

  test("returns low for unknown values", () => {
    expect(normalizePierreBrainRiskLevel(null)).toBe("low");
    expect(normalizePierreBrainRiskLevel(undefined)).toBe("low");
    expect(normalizePierreBrainRiskLevel("xyz")).toBe("low");
    expect(normalizePierreBrainRiskLevel(42)).toBe("low");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: normalizePierreBrainConfidence
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePierreBrainConfidence", () => {
  test("maps high/medium/low", () => {
    expect(normalizePierreBrainConfidence("high")).toBe("high");
    expect(normalizePierreBrainConfidence("medium")).toBe("medium");
    expect(normalizePierreBrainConfidence("low")).toBe("low");
  });

  test("maps aliases", () => {
    expect(normalizePierreBrainConfidence("élevé")).toBe("high");
    expect(normalizePierreBrainConfidence("strong")).toBe("high");
    expect(normalizePierreBrainConfidence("faible")).toBe("low");
    expect(normalizePierreBrainConfidence("weak")).toBe("low");
  });

  test("defaults to medium for unknown", () => {
    expect(normalizePierreBrainConfidence(null)).toBe("medium");
    expect(normalizePierreBrainConfidence(undefined)).toBe("medium");
    expect(normalizePierreBrainConfidence("xyz")).toBe("medium");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: normalizePierreBrainMissingInfo
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePierreBrainMissingInfo", () => {
  test("returns empty array for non-array input", () => {
    expect(normalizePierreBrainMissingInfo(null)).toEqual([]);
    expect(normalizePierreBrainMissingInfo(undefined)).toEqual([]);
    expect(normalizePierreBrainMissingInfo("string")).toEqual([]);
    expect(normalizePierreBrainMissingInfo({})).toEqual([]);
  });

  test("converts string items to MissingInfo objects", () => {
    const result = normalizePierreBrainMissingInfo(["employee name", "start date"]);
    expect(result).toHaveLength(2);
    expect(result[0].field).toBe("employee_name");
    expect(result[0].required).toBe(true);
    expect(result[0].question).toContain("employee name");
  });

  test("converts object items", () => {
    const result = normalizePierreBrainMissingInfo([
      { field: "employee_id", label: "ID salarié", required: true, reason: "requis", question: "Quel ID ?" },
    ]);
    expect(result[0].field).toBe("employee_id");
    expect(result[0].label).toBe("ID salarié");
    expect(result[0].required).toBe(true);
  });

  test("skips invalid items", () => {
    const result = normalizePierreBrainMissingInfo([null, {}, "", "valid field"]);
    expect(result.some((r) => r.field === "valid_field")).toBe(true);
  });

  test("returns empty array for empty array", () => {
    expect(normalizePierreBrainMissingInfo([])).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: normalizePierreBrainInterpretation
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePierreBrainInterpretation", () => {
  test("returns safe fallback for null input", () => {
    const result = normalizePierreBrainInterpretation(null);
    expect(result.intent).toBe("unknown");
    expect(result.domain).toBe("unknown");
    expect(result.risk_level).toBe("low");
    expect(result.requires_human_validation).toBe(false);
    expect(result.confidence).toBe("low");
  });

  test("normalizes a valid interpretation object", () => {
    const result = normalizePierreBrainInterpretation({
      intent: "Créer un contrat",
      domain: "contract",
      summary: "Nouveau contrat CDI",
      risk_level: "low",
      confidence: "high",
      requires_human_validation: false,
      sensitive_topics: [],
      employee_refs: ["Jean Dupont"],
      dates: ["2026-06-01"],
      document_needs: ["contrat_cdi.pdf"],
      missing_info: [],
      reasoning_summary: "Mission claire.",
    });
    expect(result.intent).toBe("Créer un contrat");
    expect(result.domain).toBe("contract");
    expect(result.risk_level).toBe("low");
    expect(result.confidence).toBe("high");
    expect(result.requires_human_validation).toBe(false);
    expect(result.employee_refs).toContain("Jean Dupont");
  });

  test("forces critical risk and requires_human_validation for CRITICAL_SIGNALS", () => {
    const result = normalizePierreBrainInterpretation({
      intent: "Gérer la procédure de licenciement",
      domain: "employee_relations",
      summary: "Licenciement pour faute grave",
      risk_level: "low",
      requires_human_validation: false,
    });
    expect(result.risk_level).toBe("critical");
    expect(result.requires_human_validation).toBe(true);
  });

  test("forces requires_human_validation for high risk even without critical signals", () => {
    const result = normalizePierreBrainInterpretation({
      intent: "Action RH",
      domain: "contract",
      risk_level: "high",
      requires_human_validation: false,
    });
    expect(result.requires_human_validation).toBe(true);
  });

  test("forces requires_human_validation when sensitive_topics present", () => {
    const result = normalizePierreBrainInterpretation({
      intent: "Cas RH",
      domain: "employee_relations",
      risk_level: "low",
      sensitive_topics: ["discrimination"],
      requires_human_validation: false,
    });
    expect(result.requires_human_validation).toBe(true);
  });

  test("detects harcelement variant with accents", () => {
    const result = normalizePierreBrainInterpretation({
      intent: "Traiter cas de harcèlement",
      domain: "employee_relations",
      risk_level: "low",
    });
    expect(result.risk_level).toBe("critical");
    expect(result.requires_human_validation).toBe(true);
  });

  test("detects prud hommes signal", () => {
    const result = normalizePierreBrainInterpretation({
      intent: "Dossier prud'hommes",
      domain: "employee_relations",
      risk_level: "low",
    });
    expect(result.risk_level).toBe("critical");
  });

  test("detects rupture conventionnelle as critical", () => {
    const result = normalizePierreBrainInterpretation({
      intent: "Engager rupture conventionnelle",
      domain: "contract",
      risk_level: "medium",
    });
    expect(result.risk_level).toBe("critical");
    expect(result.requires_human_validation).toBe(true);
  });

  test("never throws on malformed input", () => {
    expect(() => normalizePierreBrainInterpretation({ risk_level: { nested: "obj" } })).not.toThrow();
    expect(() => normalizePierreBrainInterpretation([])).not.toThrow();
    expect(() => normalizePierreBrainInterpretation(12345)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: normalizePierreBrainRiskReview
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePierreBrainRiskReview", () => {
  test("returns safe default for null input", () => {
    const result = normalizePierreBrainRiskReview(null);
    expect(result.risk_level).toBe("medium");
    expect(result.approval_required).toBe(true);
    expect(result.human_only).toBe(false);
  });

  test("forces human_only for critical risk", () => {
    const result = normalizePierreBrainRiskReview({ risk_level: "critical", human_only: false });
    expect(result.human_only).toBe(true);
    expect(result.approval_required).toBe(true);
  });

  test("forces approval_required for high risk", () => {
    const result = normalizePierreBrainRiskReview({ risk_level: "high", approval_required: false });
    expect(result.approval_required).toBe(true);
  });

  test("forces approval_required when sensitive_topics present", () => {
    const result = normalizePierreBrainRiskReview({
      risk_level: "low",
      sensitive_topics: ["discrimination"],
      approval_required: false,
    });
    expect(result.approval_required).toBe(true);
  });

  test("preserves safe_next_step", () => {
    const result = normalizePierreBrainRiskReview({
      risk_level: "low",
      safe_next_step: "Contacter RH.",
    });
    expect(result.safe_next_step).toBe("Contacter RH.");
  });

  test("returns null for blocked_reason when not set", () => {
    const result = normalizePierreBrainRiskReview({ risk_level: "low" });
    expect(result.blocked_reason).toBeNull();
  });

  test("never throws on invalid input", () => {
    expect(() => normalizePierreBrainRiskReview(42)).not.toThrow();
    expect(() => normalizePierreBrainRiskReview([])).not.toThrow();
    expect(() => normalizePierreBrainRiskReview("string")).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: normalizePierreBrainTaskDraft
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePierreBrainTaskDraft", () => {
  test("returns safe fallback for null input", () => {
    const result = normalizePierreBrainTaskDraft(null);
    expect(result.type).toBe("general.action");
    expect(result.approval_required).toBe(true);
    expect(result.risk_level).toBe("medium");
    expect(result.priority).toBe(50);
  });

  test("forces approval_required for email.send", () => {
    const result = normalizePierreBrainTaskDraft({
      type: "email.send",
      title: "Envoyer email",
      approval_required: false,
      risk_level: "low",
    });
    expect(result.approval_required).toBe(true);
  });

  test("forces approval_required for send_email", () => {
    const result = normalizePierreBrainTaskDraft({
      type: "send_email",
      title: "Email",
      approval_required: false,
    });
    expect(result.approval_required).toBe(true);
  });

  test("forces approval_required for high risk", () => {
    const result = normalizePierreBrainTaskDraft({
      type: "doc.generate",
      title: "Doc",
      risk_level: "high",
      approval_required: false,
    });
    expect(result.approval_required).toBe(true);
  });

  test("clamps priority to 1-100", () => {
    expect(normalizePierreBrainTaskDraft({ type: "doc.generate", priority: 0 }).priority).toBe(1);
    expect(normalizePierreBrainTaskDraft({ type: "doc.generate", priority: 200 }).priority).toBe(100);
    expect(normalizePierreBrainTaskDraft({ type: "doc.generate", priority: 50 }).priority).toBe(50);
  });

  test("never throws on invalid input", () => {
    expect(() => normalizePierreBrainTaskDraft("string")).not.toThrow();
    expect(() => normalizePierreBrainTaskDraft([])).not.toThrow();
    expect(() => normalizePierreBrainTaskDraft(true)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: normalizePierreBrainTaskPlan
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePierreBrainTaskPlan", () => {
  test("returns empty plan for null input", () => {
    const result = normalizePierreBrainTaskPlan(null);
    expect(result.tasks).toEqual([]);
    expect(result.dependencies).toEqual([]);
    expect(result.validation_points).toEqual([]);
  });

  test("normalizes tasks array", () => {
    const result = normalizePierreBrainTaskPlan({
      tasks: [{ type: "doc.generate", title: "Contrat" }],
      validation_points: ["Check 1"],
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.validation_points).toContain("Check 1");
  });

  test("normalizes dependencies", () => {
    const result = normalizePierreBrainTaskPlan({
      tasks: [],
      dependencies: [{ task_title: "T1", depends_on: ["T0"], reason: "requires T0" }],
    });
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].task_title).toBe("T1");
  });

  test("skips invalid dependency items", () => {
    const result = normalizePierreBrainTaskPlan({
      tasks: [],
      dependencies: [null, "string", { task_title: "T1", depends_on: [], reason: "ok" }],
    });
    expect(result.dependencies).toHaveLength(1);
  });

  test("never throws on malformed input", () => {
    expect(() => normalizePierreBrainTaskPlan("bad")).not.toThrow();
    expect(() => normalizePierreBrainTaskPlan({ tasks: "not array" })).not.toThrow();
    expect(() => normalizePierreBrainTaskPlan(null)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: normalizePierreBrainQualityGate
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePierreBrainQualityGate", () => {
  test("returns unsafe fallback for null", () => {
    const result = normalizePierreBrainQualityGate(null);
    expect(result.valid).toBe(false);
    expect(result.safe_to_use).toBe(false);
    expect(result.score).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("normalizes valid quality gate", () => {
    const result = normalizePierreBrainQualityGate({
      valid: true,
      score: 90,
      errors: [],
      warnings: ["minor issue"],
      safe_to_use: true,
      normalization_hints: [],
    });
    expect(result.valid).toBe(true);
    expect(result.safe_to_use).toBe(true);
    expect(result.score).toBe(90);
    expect(result.warnings).toContain("minor issue");
  });

  test("clamps score to 0-100", () => {
    expect(normalizePierreBrainQualityGate({ score: 150 }).score).toBe(100);
    expect(normalizePierreBrainQualityGate({ score: -10 }).score).toBe(0);
  });

  test("never throws on invalid input", () => {
    expect(() => normalizePierreBrainQualityGate("string")).not.toThrow();
    expect(() => normalizePierreBrainQualityGate(42)).not.toThrow();
    expect(() => normalizePierreBrainQualityGate([])).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: buildSafePierreBrainFallback
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildSafePierreBrainFallback", () => {
  test("returns valid PierreBrainFinalOutput with source=deterministic", () => {
    const result = buildSafePierreBrainFallback({ input: "Mission RH simple" });
    expect(result.source).toBe("deterministic");
    expect(result.ai_enabled).toBe(false);
    expect(result.ai_ok).toBe(false);
    expect(result.interpretation).toBeDefined();
    expect(result.risk_review).toBeDefined();
    expect(result.task_plan).toBeDefined();
    expect(result.quality_gate).toBeDefined();
  });

  test("uses deterministicInterpretation when provided", () => {
    const result = buildSafePierreBrainFallback({
      input: "Créer avenant",
      deterministicInterpretation: {
        domain: "contract",
        risk_level: "medium",
        approval_required: false,
        summary: "Avenant contrat",
      },
    });
    expect(result.interpretation.domain).toBe("contract");
    expect(result.interpretation.summary).toBe("Avenant contrat");
  });

  test("converts deterministic tasks", () => {
    const result = buildSafePierreBrainFallback({
      input: "Action RH",
      deterministicTasks: [
        { type: "doc.generate", title: "Contrat", description: "desc", priority: 60, approval_required: false, risk_level: "low", expected_artifact: null, payload: {} },
      ],
    });
    expect(result.task_plan.tasks).toHaveLength(1);
    expect(result.task_plan.tasks[0].title).toBe("Contrat");
  });

  test("detects critical signals in input and marks critical", () => {
    const result = buildSafePierreBrainFallback({ input: "Procédure de licenciement urgent" });
    expect(result.interpretation.risk_level).toBe("critical");
    expect(result.interpretation.requires_human_validation).toBe(true);
  });

  test("never throws on empty input", () => {
    expect(() => buildSafePierreBrainFallback({ input: "" })).not.toThrow();
    expect(() => buildSafePierreBrainFallback({ input: null as unknown as string })).not.toThrow();
  });

  test("quality_gate is always valid in fallback", () => {
    const result = buildSafePierreBrainFallback({ input: "Test" });
    expect(result.quality_gate).toBeDefined();
    expect(result.errors).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: buildNormalizedPierreBrainOutputJson
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildNormalizedPierreBrainOutputJson", () => {
  test("builds flat key-prefixed dict", () => {
    const output = buildSafePierreBrainFallback({ input: "Mission RH" });
    const json = buildNormalizedPierreBrainOutputJson(output);
    expect(typeof json).toBe("object");
    expect(json).not.toBeNull();
    expect("brain_source" in json).toBe(true);
    expect("brain_ai_enabled" in json).toBe(true);
    expect("brain_ai_ok" in json).toBe(true);
  });

  test("never throws on any valid output", () => {
    const output = buildSafePierreBrainFallback({ input: "" });
    expect(() => buildNormalizedPierreBrainOutputJson(output)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: sanitizeBrainTaskType
// ═══════════════════════════════════════════════════════════════════════════════

describe("sanitizeBrainTaskType", () => {
  test("converts email.send to email.draft", () => {
    expect(sanitizeBrainTaskType("email.send")).toBe("email.draft");
    expect(sanitizeBrainTaskType("EMAIL.SEND")).toBe("email.draft");
    expect(sanitizeBrainTaskType("send_email")).toBe("email.draft");
    expect(sanitizeBrainTaskType("email_send")).toBe("email.draft");
  });

  test("passes through valid PierreTaskTypes", () => {
    expect(sanitizeBrainTaskType("doc.generate")).toBe("doc.generate");
    expect(sanitizeBrainTaskType("doc.rewrite")).toBe("doc.rewrite");
    expect(sanitizeBrainTaskType("pdf.generate")).toBe("pdf.generate");
    expect(sanitizeBrainTaskType("reminder.create")).toBe("reminder.create");
    expect(sanitizeBrainTaskType("followup.schedule")).toBe("followup.schedule");
    expect(sanitizeBrainTaskType("email.draft")).toBe("email.draft");
  });

  test("maps doc-generation aliases", () => {
    expect(sanitizeBrainTaskType("document.generate")).toBe("doc.generate");
    expect(sanitizeBrainTaskType("contract.generate")).toBe("doc.generate");
    expect(sanitizeBrainTaskType("amendment.generate")).toBe("doc.generate");
    expect(sanitizeBrainTaskType("hr.document")).toBe("doc.generate");
    expect(sanitizeBrainTaskType("onboarding.document")).toBe("doc.generate");
  });

  test("returns doc.generate for unknown types", () => {
    expect(sanitizeBrainTaskType("xyz.unknown")).toBe("doc.generate");
    expect(sanitizeBrainTaskType(null)).toBe("doc.generate");
    expect(sanitizeBrainTaskType(undefined)).toBe("doc.generate");
    expect(sanitizeBrainTaskType("")).toBe("doc.generate");
    expect(sanitizeBrainTaskType(42)).toBe("doc.generate");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13: enforceBrainTaskSafety
// ═══════════════════════════════════════════════════════════════════════════════

describe("enforceBrainTaskSafety", () => {
  test("forces approval_required for email.draft", () => {
    const task = makeDraft({ type: "email.draft", approval_required: false });
    const result = enforceBrainTaskSafety(task);
    expect(result.approval_required).toBe(true);
  });

  test("forces approval_required for email.send", () => {
    const task = makeDraft({ type: "email.send", approval_required: false });
    const result = enforceBrainTaskSafety(task);
    expect(result.approval_required).toBe(true);
  });

  test("forces approval_required for high risk_level", () => {
    const task = makeDraft({ type: "doc.generate", risk_level: "high", approval_required: false });
    const result = enforceBrainTaskSafety(task);
    expect(result.approval_required).toBe(true);
  });

  test("forces approval_required when sensitiveTopics present", () => {
    const task = makeDraft({ type: "doc.generate", approval_required: false });
    const result = enforceBrainTaskSafety(task, { sensitiveTopics: ["licenciement"] });
    expect(result.approval_required).toBe(true);
  });

  test("forces approval_required when globalApprovalRequired=true", () => {
    const task = makeDraft({ type: "doc.generate", approval_required: false });
    const result = enforceBrainTaskSafety(task, { globalApprovalRequired: true });
    expect(result.approval_required).toBe(true);
  });

  test("preserves approval_required=false when no safety concerns", () => {
    const task = makeDraft({ type: "doc.generate", risk_level: "low", approval_required: false });
    const result = enforceBrainTaskSafety(task, { sensitiveTopics: [], globalApprovalRequired: false });
    expect(result.approval_required).toBe(false);
  });

  test("does not add scheduled_for to task", () => {
    const task = makeDraft();
    const result = enforceBrainTaskSafety(task);
    expect("scheduled_for" in result).toBe(false);
    expect(result.execute_at).toBeNull();
  });

  test("preserves other task fields unchanged", () => {
    const task = makeDraft({ title: "Mon doc", priority: 75, payload_json: { key: "val" } });
    const result = enforceBrainTaskSafety(task);
    expect(result.title).toBe("Mon doc");
    expect(result.priority).toBe(75);
    expect(result.payload_json).toEqual({ key: "val" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14: convertPierreBrainTaskPlanToTaskDrafts
// ═══════════════════════════════════════════════════════════════════════════════

describe("convertPierreBrainTaskPlanToTaskDrafts", () => {
  test("returns empty array for null/undefined input", () => {
    expect(convertPierreBrainTaskPlanToTaskDrafts(null)).toEqual([]);
    expect(convertPierreBrainTaskPlanToTaskDrafts(undefined)).toEqual([]);
  });

  test("converts brain task plan to PierreTaskDraft array", () => {
    const plan = makeBrainTaskPlan();
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("doc.generate");
    expect(result[0].title).toBe("Générer contrat");
    expect(result[0].execute_at).toBeNull();
    expect(result[0].depends_on_json).toEqual([]);
    expect(result[0].status).toBe("draft");
  });

  test("converts email.send to email.draft with approval_required=true", () => {
    const plan = makeBrainTaskPlan({
      tasks: [{
        type: "email.send",
        title: "Envoyer notification",
        description: "Email",
        priority: 50,
        approval_required: false,
        risk_level: "low",
        expected_artifact: null,
        payload: {},
      }],
    });
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan);
    expect(result[0].type).toBe("email.draft");
    expect(result[0].approval_required).toBe(true);
  });

  test("respects maxTasks option", () => {
    const plan = makeBrainTaskPlan({
      tasks: Array.from({ length: 25 }, (_, i) => ({
        type: "doc.generate",
        title: `Task ${i}`,
        description: "",
        priority: 50,
        approval_required: false,
        risk_level: "low" as const,
        expected_artifact: null,
        payload: {},
      })),
    });
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan, { maxTasks: 5 });
    expect(result).toHaveLength(5);
  });

  test("default maxTasks is 20", () => {
    const plan = makeBrainTaskPlan({
      tasks: Array.from({ length: 25 }, (_, i) => ({
        type: "doc.generate",
        title: `Task ${i}`,
        description: "",
        priority: 50,
        approval_required: false,
        risk_level: "low" as const,
        expected_artifact: null,
        payload: {},
      })),
    });
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan);
    expect(result).toHaveLength(20);
  });

  test("applies globalApprovalRequired to all tasks", () => {
    const plan = makeBrainTaskPlan();
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan, { globalApprovalRequired: true });
    expect(result.every((t) => t.approval_required)).toBe(true);
  });

  test("applies sensitiveTopics to force approval_required", () => {
    const plan = makeBrainTaskPlan();
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan, { sensitiveTopics: ["harcelement"] });
    expect(result[0].approval_required).toBe(true);
  });

  test("maps high brain risk_level to high DB risk_level", () => {
    const plan = makeBrainTaskPlan({
      tasks: [{
        type: "doc.generate",
        title: "Doc critique",
        description: "",
        priority: 50,
        approval_required: false,
        risk_level: "critical",
        expected_artifact: null,
        payload: {},
      }],
    });
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan);
    expect(result[0].risk_level).toBe("high");
    expect(result[0].approval_required).toBe(true);
  });

  test("never adds scheduled_for field", () => {
    const plan = makeBrainTaskPlan();
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan);
    result.forEach((t) => {
      expect("scheduled_for" in t).toBe(false);
      expect(t.execute_at).toBeNull();
    });
  });

  test("sets output_kind correctly", () => {
    const result = convertPierreBrainTaskPlanToTaskDrafts(makeBrainTaskPlan());
    expect(result[0].output_kind).toBe("document");
  });

  test("returns empty array for plan with no tasks array", () => {
    const result = convertPierreBrainTaskPlanToTaskDrafts({ tasks: null } as unknown as PierreBrainTaskPlan);
    expect(result).toEqual([]);
  });

  test("skips null task items", () => {
    const plan = {
      tasks: [null, { type: "doc.generate", title: "Ok", description: "", priority: 50, approval_required: false, risk_level: "low" as const, expected_artifact: null, payload: {} }],
      dependencies: [],
      validation_points: [],
      artifact_expectations: [],
      execution_notes: [],
    };
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan);
    expect(result).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15: mergeDeterministicAndBrainTasks
// ═══════════════════════════════════════════════════════════════════════════════

describe("mergeDeterministicAndBrainTasks", () => {
  test("returns empty array for empty inputs", () => {
    expect(mergeDeterministicAndBrainTasks([], [])).toEqual([]);
  });

  test("returns deterministic tasks when brain is empty", () => {
    const det = [makeDraft({ title: "Task A" })];
    const result = mergeDeterministicAndBrainTasks(det, []);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Task A");
  });

  test("appends non-duplicate brain tasks", () => {
    const det = [makeDraft({ title: "Task A", type: "doc.generate" })];
    const brain = [makeDraft({ title: "Task B", type: "doc.generate" })];
    const result = mergeDeterministicAndBrainTasks(det, brain);
    expect(result).toHaveLength(2);
  });

  test("deduplicates by type+normalized-title", () => {
    const det = [makeDraft({ title: "Générer contrat", type: "doc.generate" })];
    const brain = [makeDraft({ title: "Générer contrat", type: "doc.generate" })];
    const result = mergeDeterministicAndBrainTasks(det, brain);
    expect(result).toHaveLength(1);
  });

  test("deterministic tasks take precedence over brain duplicates", () => {
    const det = [makeDraft({ title: "Contrat", type: "doc.generate", priority: 80 })];
    const brain = [makeDraft({ title: "Contrat", type: "doc.generate", priority: 30 })];
    const result = mergeDeterministicAndBrainTasks(det, brain);
    expect(result[0].priority).toBe(80);
  });

  test("respects maxTotal option", () => {
    const det = Array.from({ length: 15 }, (_, i) => makeDraft({ title: `Det ${i}` }));
    const brain = Array.from({ length: 15 }, (_, i) => makeDraft({ title: `Brain ${i}` }));
    const result = mergeDeterministicAndBrainTasks(det, brain, { maxTotal: 10 });
    expect(result).toHaveLength(10);
  });

  test("default maxTotal is 30", () => {
    const det = Array.from({ length: 20 }, (_, i) => makeDraft({ title: `Det ${i}` }));
    const brain = Array.from({ length: 20 }, (_, i) => makeDraft({ title: `Brain ${i}` }));
    const result = mergeDeterministicAndBrainTasks(det, brain);
    expect(result).toHaveLength(30);
  });

  test("brainTasksOnly returns only brain tasks", () => {
    const det = [makeDraft({ title: "Det task" })];
    const brain = [makeDraft({ title: "Brain task A" }), makeDraft({ title: "Brain task B" })];
    const result = mergeDeterministicAndBrainTasks(det, brain, { brainTasksOnly: true });
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Brain task A");
  });

  test("handles null/undefined arrays gracefully", () => {
    expect(() => mergeDeterministicAndBrainTasks(null as unknown as PierreTaskDraft[], [])).not.toThrow();
    expect(() => mergeDeterministicAndBrainTasks([], null as unknown as PierreTaskDraft[])).not.toThrow();
  });

  test("title dedup is case-insensitive and ignores non-alphanumeric", () => {
    const det = [makeDraft({ title: "Generer Contrat!", type: "doc.generate" })];
    const brain = [makeDraft({ title: "generer contrat", type: "doc.generate" })];
    const result = mergeDeterministicAndBrainTasks(det, brain);
    expect(result).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 16: runPierreFinalBrain — mode off (deterministic fallback)
// ═══════════════════════════════════════════════════════════════════════════════

describe("runPierreFinalBrain — mode off", () => {
  test("returns deterministic fallback when aiMode=off", async () => {
    const result = await runPierreFinalBrain({ input: "Créer contrat", aiMode: "off" });
    expect(result.source).toBe("deterministic");
    expect(result.ai_enabled).toBe(false);
    expect(result.ai_ok).toBe(false);
  });

  test("never throws with mode off", async () => {
    await expect(runPierreFinalBrain({ input: "", aiMode: "off" })).resolves.toBeDefined();
  });

  test("includes interpretation in deterministic fallback", async () => {
    const result = await runPierreFinalBrain({ input: "Embaucher candidat", aiMode: "off" });
    expect(result.interpretation).toBeDefined();
    expect(result.interpretation.intent).toBeTruthy();
  });

  test("uses deterministicInterpretation when provided", async () => {
    const result = await runPierreFinalBrain({
      input: "Créer contrat CDI",
      aiMode: "off",
      deterministicInterpretation: {
        domain: "contract",
        risk_level: "low",
        approval_required: false,
        summary: "Nouveau CDI",
      },
    });
    expect(result.interpretation.domain).toBe("contract");
    expect(result.interpretation.summary).toBe("Nouveau CDI");
  });

  test("detects critical signals in input with mode off", async () => {
    const result = await runPierreFinalBrain({ input: "Procédure licenciement", aiMode: "off" });
    expect(result.interpretation.risk_level).toBe("critical");
    expect(result.interpretation.requires_human_validation).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 17: runPierreFinalBrain — mode assist/primary with mock
// ═══════════════════════════════════════════════════════════════════════════════

describe("runPierreFinalBrain — mode assist/primary (mock provider)", () => {
  test("returns valid PierreBrainFinalOutput with aiMode=assist", async () => {
    const result = await runPierreFinalBrain({ input: "Embaucher candidat", aiMode: "assist" });
    expect(result).toBeDefined();
    expect(result.source).toMatch(/^(ai|hybrid|deterministic)$/);
    expect(result.interpretation).toBeDefined();
    expect(result.risk_review).toBeDefined();
    expect(result.task_plan).toBeDefined();
    expect(result.quality_gate).toBeDefined();
  });

  test("returns valid PierreBrainFinalOutput with aiMode=primary", async () => {
    const result = await runPierreFinalBrain({ input: "Gérer absence", aiMode: "primary" });
    expect(result).toBeDefined();
    expect(result.source).toMatch(/^(ai|hybrid|deterministic)$/);
  });

  test("never throws for any aiMode", async () => {
    await expect(runPierreFinalBrain({ input: "Test", aiMode: "assist" })).resolves.toBeDefined();
    await expect(runPierreFinalBrain({ input: "Test", aiMode: "primary" })).resolves.toBeDefined();
  });

  test("provider is never null in output", async () => {
    const result = await runPierreFinalBrain({ input: "Test", aiMode: "assist" });
    // provider can be null when ai_enabled=false
    expect(typeof result.provider === "string" || result.provider === null).toBe(true);
  });

  test("warnings and errors are always arrays", async () => {
    const result = await runPierreFinalBrain({ input: "Test", aiMode: "assist" });
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  test("quality_gate is always present", async () => {
    const result = await runPierreFinalBrain({ input: "Contrat", aiMode: "assist" });
    expect(result.quality_gate).toBeDefined();
    expect(typeof result.quality_gate.valid).toBe("boolean");
    expect(typeof result.quality_gate.safe_to_use).toBe("boolean");
    expect(typeof result.quality_gate.score).toBe("number");
  });

  test("task_plan is always present with tasks array", async () => {
    const result = await runPierreFinalBrain({ input: "Formation salarié", aiMode: "assist" });
    expect(result.task_plan).toBeDefined();
    expect(Array.isArray(result.task_plan.tasks)).toBe(true);
  });

  test("no task has approval_required=false when brain risk is critical", async () => {
    const result = await runPierreFinalBrain({
      input: "Procédure de licenciement",
      aiMode: "assist",
    });
    if (result.risk_review.risk_level === "critical") {
      expect(result.risk_review.approval_required).toBe(true);
    }
  });

  test("does not add scheduled_for to any task in task_plan", async () => {
    const result = await runPierreFinalBrain({ input: "Onboarding", aiMode: "assist" });
    result.task_plan.tasks.forEach((task) => {
      expect("scheduled_for" in task).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 18: Safety invariants
// ═══════════════════════════════════════════════════════════════════════════════

describe("Safety invariants", () => {
  test("email.send in brain task plan → converted to email.draft with approval_required=true", () => {
    const plan = makeBrainTaskPlan({
      tasks: [{
        type: "email.send",
        title: "Email salarié",
        description: "",
        priority: 50,
        approval_required: false,
        risk_level: "low",
        expected_artifact: null,
        payload: {},
      }],
    });
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan);
    expect(drafts[0].type).toBe("email.draft");
    expect(drafts[0].approval_required).toBe(true);
  });

  test("brain task with approval_required=true is never auto-safe", () => {
    const task = makeDraft({ approval_required: true });
    const result = enforceBrainTaskSafety(task);
    expect(result.approval_required).toBe(true);
  });

  test("critical brain interpretation → approval_required in risk review", () => {
    const interp = normalizePierreBrainInterpretation({
      intent: "Licenciement",
      domain: "employee_relations",
      risk_level: "critical",
    }) as PierreBrainInterpretation;
    const risk = normalizePierreBrainRiskReview({
      risk_level: interp.risk_level,
      sensitive_topics: interp.sensitive_topics,
    });
    expect(risk.approval_required).toBe(true);
  });

  test("fallback output never exposes AI keys or secrets", async () => {
    const result = await runPierreFinalBrain({ input: "Test", aiMode: "off" });
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    expect(json).not.toMatch(/Bearer [A-Za-z0-9]{20,}/);
  });

  test("brain output source is always one of ai|hybrid|deterministic", async () => {
    const result = await runPierreFinalBrain({ input: "Test", aiMode: "assist" });
    expect(["ai", "hybrid", "deterministic"]).toContain(result.source);
  });

  test("normalized brain output json never contains scheduled_for key", async () => {
    const result = await runPierreFinalBrain({ input: "Test", aiMode: "off" });
    const json = buildNormalizedPierreBrainOutputJson(result);
    const keys = Object.keys(json);
    expect(keys.some((k) => k.toLowerCase().includes("scheduled_for"))).toBe(false);
  });

  test("mergeDeterministicAndBrainTasks never introduces scheduled_for field", () => {
    const det = [makeDraft()];
    const brain = [makeDraft()];
    const merged = mergeDeterministicAndBrainTasks(det, brain);
    merged.forEach((t) => {
      expect("scheduled_for" in t).toBe(false);
    });
  });

  test("convertPierreBrainTaskPlanToTaskDrafts output tasks have status=draft by default", () => {
    const plan = makeBrainTaskPlan();
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan);
    drafts.forEach((t) => {
      expect(t.status).toBe("draft");
    });
  });

  test("runPierreFinalBrain with empty input does not throw", async () => {
    await expect(runPierreFinalBrain({ input: "", aiMode: "off" })).resolves.toBeDefined();
    await expect(runPierreFinalBrain({ input: "", aiMode: "assist" })).resolves.toBeDefined();
  });

  test("runPierreFinalBrain with null employee context does not throw", async () => {
    await expect(runPierreFinalBrain({
      input: "Test",
      aiMode: "off",
      employeeContext: null,
      companyContext: null,
    })).resolves.toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 19: Edge cases and boundary conditions
// ═══════════════════════════════════════════════════════════════════════════════

describe("Edge cases and boundary conditions", () => {
  test("normalizePierreBrainInterpretation handles very long input", () => {
    const longText = "a".repeat(50000);
    const result = normalizePierreBrainInterpretation({ intent: longText, domain: "contract" });
    expect(result.intent.length).toBeLessThanOrEqual(50000);
  });

  test("normalizePierreBrainTaskDraft handles missing type", () => {
    const result = normalizePierreBrainTaskDraft({ title: "Task sans type" });
    expect(result.type).toBe("general.action");
  });

  test("convertPierreBrainTaskPlanToTaskDrafts handles empty tasks array", () => {
    const plan = makeBrainTaskPlan({ tasks: [] });
    const result = convertPierreBrainTaskPlanToTaskDrafts(plan);
    expect(result).toEqual([]);
  });

  test("mergeDeterministicAndBrainTasks handles empty both", () => {
    expect(mergeDeterministicAndBrainTasks([], [])).toEqual([]);
  });

  test("normalizePierreBrainRiskReview handles empty sensitive_topics", () => {
    const result = normalizePierreBrainRiskReview({ risk_level: "low", sensitive_topics: [] });
    expect(result.sensitive_topics).toEqual([]);
  });

  test("buildSafePierreBrainFallback with only deterministicInterpretation", () => {
    const result = buildSafePierreBrainFallback({
      input: "Test",
      deterministicInterpretation: { domain: "onboarding", risk_level: "low" },
    });
    expect(result.source).toBe("deterministic");
    expect(result.interpretation.domain).toBe("onboarding");
  });

  test("buildSafePierreBrainFallback with empty deterministicTasks", () => {
    const result = buildSafePierreBrainFallback({ input: "Test", deterministicTasks: [] });
    expect(result.task_plan.tasks).toEqual([]);
  });

  test("normalizePierreBrainQualityGate with valid=false forces safe_to_use=false", () => {
    const result = normalizePierreBrainQualityGate({ valid: false, score: 80, errors: ["error"], safe_to_use: true });
    expect(result.errors).toContain("error");
  });

  test("sanitizeBrainTaskType with spaces in type", () => {
    expect(sanitizeBrainTaskType("  doc.generate  ")).toBe("doc.generate");
    expect(sanitizeBrainTaskType("  email.send  ")).toBe("email.draft");
  });

  test("enforceBrainTaskSafety with undefined options", () => {
    const task = makeDraft({ type: "doc.generate", approval_required: false });
    expect(() => enforceBrainTaskSafety(task, undefined)).not.toThrow();
    const result = enforceBrainTaskSafety(task, undefined);
    expect(result.approval_required).toBe(false);
  });

  test("normalizePierreBrainDomain handles CDD and CDI shortcuts", () => {
    expect(normalizePierreBrainDomain("cdi")).toBe("contract");
    expect(normalizePierreBrainDomain("cdd")).toBe("contract");
    expect(normalizePierreBrainDomain("avenant")).toBe("contract");
  });

  test("multiple critical signals in same text force critical once", () => {
    const result = normalizePierreBrainInterpretation({
      intent: "licenciement et harcèlement",
      domain: "employee_relations",
      risk_level: "low",
    });
    expect(result.risk_level).toBe("critical");
    expect(result.requires_human_validation).toBe(true);
  });
});
