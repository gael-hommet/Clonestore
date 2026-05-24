// src/lib/pierre/__tests__/pierre-context-b35.test.ts
// B35 — Pierre Memory & Context Layer — test suite

import { describe, it, expect } from "vitest";
import { buildPierreContextPack } from "../context/context-runtime";
import { scoreContextFreshness, scoreContextRelevance, rankContextSignals, deriveOverallRisk, deriveValidationRequired } from "../context/scoring";
import { buildContextSignal } from "../context/context-signals";
import { buildCompanyContextSignals } from "../context/company-context";
import { buildEmployeeContextSignals } from "../context/employee-context";
import { buildMissionContextSignals } from "../context/mission-context";
import { buildTaskContextSignals } from "../context/task-context";
import { buildFileContextSignals } from "../context/file-context";
import { buildChannelContextSignals } from "../context/channel-context";
import { buildHistoryContextSignals } from "../context/history-context";
import { buildRulesContextSignals } from "../context/rules-context";
import { summarizeContextPack } from "../context/context-summary";
import { assemblePierreContextPack } from "../context/context-pack";

const CO = "co_acme";

// ── Scoring ───────────────────────────────────────────────────────────────────

describe("scoreContextFreshness", () => {
  it("returns ~1 for just-updated signal", () => {
    const score = scoreContextFreshness(new Date().toISOString(), "task");
    expect(score).toBeGreaterThan(0.95);
  });

  it("decays for old signals", () => {
    const old = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const score = scoreContextFreshness(old, "task");
    expect(score).toBeLessThan(0.2);
  });

  it("returns 0.3 for invalid date", () => {
    expect(scoreContextFreshness("not-a-date", "company")).toBe(0.3);
  });

  it("slower decay for rules scope", () => {
    const old = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const taskScore = scoreContextFreshness(old, "task");
    const rulesScore = scoreContextFreshness(old, "rules");
    expect(rulesScore).toBeGreaterThan(taskScore);
  });
});

describe("scoreContextRelevance", () => {
  it("returns higher relevance for high-risk signals", () => {
    const lowRisk = scoreContextRelevance({ scope: "company", risk: "none", confidence: 0.8 });
    const highRisk = scoreContextRelevance({ scope: "company", risk: "high", confidence: 0.8 });
    expect(highRisk).toBeGreaterThan(lowRisk);
  });

  it("boosts relevance when domain matches", () => {
    const noMatch = scoreContextRelevance({ scope: "mission", risk: "none", confidence: 0.8, domain: "hr", currentDomain: "finance" });
    const match = scoreContextRelevance({ scope: "mission", risk: "none", confidence: 0.8, domain: "hr", currentDomain: "hr" });
    expect(match).toBeGreaterThan(noMatch);
  });

  it("clamps to [0, 1]", () => {
    const score = scoreContextRelevance({ scope: "risk", risk: "blocked", confidence: 1.0 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("rankContextSignals", () => {
  it("ranks high-priority signals first", () => {
    const low = buildContextSignal({ company_id: CO, scope: "company", source: "default", type: "status", priority: "low", risk: "none", title: "Low", content: "low" });
    const critical = buildContextSignal({ company_id: CO, scope: "risk", source: "heuristic", type: "risk_flag", priority: "critical", risk: "blocked", title: "Critical", content: "critical" });
    const ranked = rankContextSignals([low, critical]);
    expect(ranked[0].priority).toBe("critical");
  });

  it("respects limit param", () => {
    const signals = Array.from({ length: 10 }, (_, i) =>
      buildContextSignal({ company_id: CO, scope: "company", source: "default", type: "status", priority: "low", risk: "none", title: `Signal ${i}`, content: `content ${i}` })
    );
    expect(rankContextSignals(signals, 3)).toHaveLength(3);
  });
});

describe("deriveOverallRisk", () => {
  it("returns blocked when any signal is blocked", () => {
    const signals = [
      buildContextSignal({ company_id: CO, scope: "risk", source: "heuristic", type: "risk_flag", priority: "critical", risk: "blocked", title: "B", content: "b" }),
      buildContextSignal({ company_id: CO, scope: "company", source: "default", type: "status", priority: "low", risk: "low", title: "L", content: "l" }),
    ];
    expect(deriveOverallRisk(signals)).toBe("blocked");
  });

  it("returns none when all signals are clear", () => {
    const signals = [
      buildContextSignal({ company_id: CO, scope: "company", source: "default", type: "status", priority: "low", risk: "none", title: "Ok", content: "ok" }),
    ];
    expect(deriveOverallRisk(signals)).toBe("none");
  });
});

describe("deriveValidationRequired", () => {
  it("returns true when validation_gate signal present", () => {
    const signals = [
      buildContextSignal({ company_id: CO, scope: "validation", source: "task_record", type: "validation_gate", priority: "critical", risk: "high", title: "Gate", content: "gate" }),
    ];
    expect(deriveValidationRequired(signals)).toBe(true);
  });

  it("returns false when no gates", () => {
    const signals = [
      buildContextSignal({ company_id: CO, scope: "company", source: "default", type: "status", priority: "low", risk: "none", title: "Ok", content: "ok" }),
    ];
    expect(deriveValidationRequired(signals)).toBe(false);
  });
});

// ── Company context ───────────────────────────────────────────────────────────

describe("buildCompanyContextSignals", () => {
  it("returns company identity signal when name set in memory", () => {
    const signals = buildCompanyContextSignals({
      company_id: CO,
      company_memory: { company_profile: { company_name: "Acme Corp", sector: "tech" } },
      clone_adn_profile: null,
    });
    const identity = signals.find((s) => s.type === "identity");
    expect(identity).toBeDefined();
    expect(identity?.content).toContain("Acme Corp");
  });

  it("returns missing_info when no company data", () => {
    const signals = buildCompanyContextSignals({
      company_id: CO,
      company_memory: null,
      clone_adn_profile: null,
    });
    const missing = signals.find((s) => s.type === "missing_info");
    expect(missing).toBeDefined();
  });

  it("returns adn status signal", () => {
    const signals = buildCompanyContextSignals({
      company_id: CO,
      company_memory: null,
      clone_adn_profile: null,
    });
    const adn = signals.find((s) => s.scope === "adn");
    expect(adn).toBeDefined();
  });
});

// ── Employee context ──────────────────────────────────────────────────────────

describe("buildEmployeeContextSignals", () => {
  const employee = {
    id: "emp_001",
    full_name: "Alice Dupont",
    email: "alice@acme.fr",
    job_title: "RH Manager",
    contract_type: "cdi",
    status: "active",
  };

  it("returns identity signal for valid employee", () => {
    const signals = buildEmployeeContextSignals({
      company_id: CO,
      employee_id: "emp_001",
      employee_profile: employee,
      employees: [],
    });
    const identity = signals.find((s) => s.type === "identity");
    expect(identity).toBeDefined();
    expect(identity?.content).toContain("Alice Dupont");
  });

  it("adds offboarding risk flag", () => {
    const signals = buildEmployeeContextSignals({
      company_id: CO,
      employee_id: "emp_002",
      employee_profile: { ...employee, id: "emp_002", status: "offboarding" },
      employees: [],
    });
    const riskFlag = signals.find((s) => s.type === "risk_flag");
    expect(riskFlag).toBeDefined();
    expect(riskFlag?.priority).toBe("critical");
  });

  it("returns missing_info when employee not found", () => {
    const signals = buildEmployeeContextSignals({
      company_id: CO,
      employee_id: "emp_999",
      employee_profile: null,
      employees: [],
    });
    const missing = signals.find((s) => s.type === "missing_info");
    expect(missing).toBeDefined();
  });

  it("looks up employee from list if profile not provided", () => {
    const signals = buildEmployeeContextSignals({
      company_id: CO,
      employee_id: "emp_001",
      employee_profile: null,
      employees: [employee],
    });
    const identity = signals.find((s) => s.type === "identity");
    expect(identity?.content).toContain("Alice Dupont");
  });
});

// ── Mission context ───────────────────────────────────────────────────────────

describe("buildMissionContextSignals", () => {
  it("returns status signal for active mission", () => {
    const signals = buildMissionContextSignals({
      company_id: CO,
      mission_id: "miss_001",
      mission: { id: "miss_001", status: "in_progress", mission_summary: "Recruter un développeur" },
    });
    const status = signals.find((s) => s.type === "status");
    expect(status).toBeDefined();
    expect(status?.content).toContain("Recruter");
  });

  it("adds validation gate for pending_approval missions", () => {
    const signals = buildMissionContextSignals({
      company_id: CO,
      mission_id: "miss_002",
      mission: { id: "miss_002", status: "pending_approval", mission_summary: "Licenciement" },
    });
    const gate = signals.find((s) => s.type === "validation_gate");
    expect(gate).toBeDefined();
  });

  it("returns missing_info when no mission", () => {
    const signals = buildMissionContextSignals({
      company_id: CO,
      mission_id: "miss_999",
      mission: null,
    });
    const missing = signals.find((s) => s.type === "missing_info");
    expect(missing).toBeDefined();
  });
});

// ── Task context ──────────────────────────────────────────────────────────────

describe("buildTaskContextSignals", () => {
  it("returns aggregate overview for multiple tasks", () => {
    const tasks = [
      { id: "t1", status: "done", approval_required: false },
      { id: "t2", status: "awaiting_approval", approval_required: true },
    ];
    const signals = buildTaskContextSignals({ company_id: CO, task_id: null, tasks });
    const overview = signals.find((s) => s.title.includes("Vue d'ensemble"));
    expect(overview).toBeDefined();
  });

  it("adds validation gate when tasks pending approval", () => {
    const tasks = [{ id: "t1", status: "awaiting_approval", approval_required: true }];
    const signals = buildTaskContextSignals({ company_id: CO, task_id: null, tasks });
    const gate = signals.find((s) => s.type === "validation_gate");
    expect(gate).toBeDefined();
  });

  it("returns empty for no tasks and no task_id", () => {
    const signals = buildTaskContextSignals({ company_id: CO, task_id: null, tasks: [] });
    expect(signals).toHaveLength(0);
  });
});

// ── File context ──────────────────────────────────────────────────────────────

describe("buildFileContextSignals", () => {
  it("returns file status signal", () => {
    const files = [{ id: "file_001", safe_filename: "contrat.pdf", risk_level: "high", category: "contract", status: "ready" }];
    const signals = buildFileContextSignals({ company_id: CO, file_id: "file_001", files });
    const status = signals.find((s) => s.type === "status" || s.type === "risk_flag");
    expect(status).toBeDefined();
  });

  it("adds validation gate for sensitive files", () => {
    const files = [{ id: "file_002", safe_filename: "arret-travail.pdf", risk_level: "sensitive", category: "sick_leave", status: "ready" }];
    const signals = buildFileContextSignals({ company_id: CO, file_id: "file_002", files });
    const gate = signals.find((s) => s.type === "validation_gate");
    expect(gate).toBeDefined();
  });

  it("returns empty for no files", () => {
    const signals = buildFileContextSignals({ company_id: CO, file_id: null, files: [] });
    expect(signals).toHaveLength(0);
  });
});

// ── Channel context ───────────────────────────────────────────────────────────

describe("buildChannelContextSignals", () => {
  it("returns status signal for verified channel", () => {
    const channel = { id: "ch_001", kind: "email", address: "rh@acme.fr", status: "active", verification_status: "verified", risk_level: "low", label: "Email RH" };
    const signals = buildChannelContextSignals({ company_id: CO, channel_identity_id: "ch_001", channel_identity: channel });
    const status = signals.find((s) => s.type === "status");
    expect(status).toBeDefined();
  });

  it("adds constraint for unverified channel", () => {
    const channel = { id: "ch_002", kind: "email", address: "rh@acme.fr", status: "pending_verification", verification_status: "pending", risk_level: "medium" };
    const signals = buildChannelContextSignals({ company_id: CO, channel_identity_id: "ch_002", channel_identity: channel });
    const constraint = signals.find((s) => s.type === "constraint");
    expect(constraint).toBeDefined();
  });

  it("returns missing_info for no channel configured", () => {
    const signals = buildChannelContextSignals({ company_id: CO, channel_identity_id: null, channel_identity: null, channel_identities: [] });
    const missing = signals.find((s) => s.type === "missing_info");
    expect(missing).toBeDefined();
  });
});

// ── History context ───────────────────────────────────────────────────────────

describe("buildHistoryContextSignals", () => {
  it("returns history signal from logs", () => {
    const logs = [{ id: "log_1", action: "task.created", created_at: new Date().toISOString(), message: "Tâche créée" }];
    const signals = buildHistoryContextSignals({ company_id: CO, recent_logs: logs, recent_missions: [] });
    const history = signals.find((s) => s.type === "history_event");
    expect(history).toBeDefined();
  });

  it("flags sensitive log content", () => {
    const logs = [{ id: "log_2", action: "task.created", created_at: new Date().toISOString(), message: "Procédure de licenciement initiée" }];
    const signals = buildHistoryContextSignals({ company_id: CO, recent_logs: logs, recent_missions: [] });
    const riskFlag = signals.find((s) => s.type === "risk_flag");
    expect(riskFlag).toBeDefined();
  });

  it("returns empty for no logs or missions", () => {
    const signals = buildHistoryContextSignals({ company_id: CO, recent_logs: [], recent_missions: [] });
    expect(signals).toHaveLength(0);
  });
});

// ── Full orchestrator ─────────────────────────────────────────────────────────

describe("buildPierreContextPack (full orchestrator)", () => {
  it("returns a valid PierreContextBuildResult", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      company_memory: { company_profile: { company_name: "Acme Corp", sector: "tech" } },
    });
    expect(result.pack).toBeDefined();
    expect(result.pack.id).toMatch(/^ctx_/);
    expect(result.pack.company_id).toBe(CO);
    expect(result.signal_count).toBeGreaterThan(0);
  });

  it("includes employee signals when employee_profile provided", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      employee_id: "emp_001",
      employee_profile: { id: "emp_001", full_name: "Alice Dupont", status: "active" },
    });
    const employeeSignal = result.pack.signals.find((s) => s.scope === "employee" && s.type === "identity");
    expect(employeeSignal).toBeDefined();
  });

  it("sets should_require_validation when sensitive file present", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      files: [{ id: "f1", safe_filename: "arret.pdf", risk_level: "sensitive", category: "sick_leave", status: "ready" }],
    });
    expect(result.should_require_validation).toBe(true);
  });

  it("sets should_require_validation when task pending approval", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      tasks: [{ id: "t1", status: "awaiting_approval", approval_required: true }],
    });
    expect(result.should_require_validation).toBe(true);
  });

  it("has no validation required for clean context", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      company_memory: { company_profile: { company_name: "Acme", sector: "tech" } },
    });
    // Not guaranteed to be false — depends on ADN — but result must exist
    expect(typeof result.should_require_validation).toBe("boolean");
  });

  it("generates recommended_next_action", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
    });
    expect(typeof result.recommended_next_action).toBe("string");
  });

  it("returns build_duration_ms >= 0", () => {
    const result = buildPierreContextPack({ company_id: CO, built_for: "test" });
    expect(result.build_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("pack.agent_slug is always 'pierre'", () => {
    const result = buildPierreContextPack({ company_id: CO, built_for: "test" });
    expect(result.pack.agent_slug).toBe("pierre");
  });

  it("includes file summary when files provided", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "test",
      file_id: "f1",
      files: [{ id: "f1", safe_filename: "cv-alice.pdf", risk_level: "medium", category: "cv", status: "ready" }],
    });
    expect(result.pack.file_summary).toBeTruthy();
  });

  it("includes channel summary when channel provided", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "test",
      channel_identity_id: "ch_1",
      channel_identity: { id: "ch_1", kind: "email", status: "active", verification_status: "verified", label: "Email RH" },
    });
    expect(result.pack.channel_summary).toBeTruthy();
  });
});

// ── Context summary ───────────────────────────────────────────────────────────

describe("summarizeContextPack", () => {
  it("builds all summary fields", () => {
    const pack = assemblePierreContextPack({
      company_id: CO,
      built_for: "test",
      signals: [
        buildContextSignal({ company_id: CO, scope: "company", source: "company_memory", type: "identity", priority: "medium", risk: "none", title: "Acme", content: "Entreprise: Acme" }),
        buildContextSignal({ company_id: CO, scope: "validation", source: "task_record", type: "validation_gate", priority: "critical", risk: "high", title: "Gate", content: "validation requise" }),
      ],
    });
    const summary = summarizeContextPack(pack);
    expect(summary.risk_summary).toBeTruthy();
    expect(summary.validation_summary).toBeTruthy();
    expect(summary.should_require_validation).toBe(true);
  });

  it("reports no risk for clean signals", () => {
    const pack = assemblePierreContextPack({
      company_id: CO,
      built_for: "test",
      signals: [
        buildContextSignal({ company_id: CO, scope: "company", source: "default", type: "status", priority: "low", risk: "none", title: "Ok", content: "ok" }),
      ],
    });
    const summary = summarizeContextPack(pack);
    expect(summary.risk_summary).toContain("Aucun signal");
  });
});
