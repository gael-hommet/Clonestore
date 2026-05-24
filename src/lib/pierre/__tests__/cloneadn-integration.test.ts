// src/lib/pierre/__tests__/cloneadn-integration.test.ts
// Bloc 28 — CloneADN integration regression tests
// Tests that CloneADN integrates correctly with brain/task-bridge, documents, HR hints.
// No real API calls. No Supabase. No OpenAI/Anthropic. Pure functions only.

import { describe, it, expect } from "vitest";

// Task bridge
import {
  sanitizeBrainTaskType,
  enforceBrainTaskSafety,
  convertPierreBrainTaskPlanToTaskDrafts,
} from "../brain/task-bridge";

// CloneADN modules
import {
  buildDefaultCloneADNProfile,
  buildDefaultCloneADNValidationProfile,
  buildDefaultCloneADNAutonomyProfile,
  buildCloneADNApplicationContext,
  buildCloneADNStoragePatch,
} from "../../clonestore/adn/profile";
import {
  evaluatePierreActionWithCloneADN,
  buildPierreCloneADNHint,
  buildPierreDocumentVariablesFromCloneADN,
  buildPierreCompanyContextFromCloneADN,
} from "../../pierre/adn/cloneadn";

// HR modules
import { buildMissionReadinessHint } from "../hr/operational-readiness";
import { buildMissionReleaseProofHint } from "../hr/release-proof";
import { buildMissionTrialActivationHint } from "../hr/trial-activation";
import { buildPierreCustomerSuccessMissionHint } from "../hr/customer-success";

import type { CloneADNProfile } from "../../clonestore/adn/types";
import type { PierreBrainTaskPlan } from "../brain/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<CloneADNProfile> = {}): CloneADNProfile {
  const base = buildDefaultCloneADNProfile();
  return { ...base, ...overrides };
}

function makeConfiguredProfile(): CloneADNProfile {
  return makeProfile({
    status: "configured",
    company_identity: {
      legal_name: "Acme Corp",
      trade_name: "Acme",
      sector: "tech",
      size_range: null,
      country_code: "FR",
      main_language: "fr",
      hr_contact_email: "rh@acme.fr",
      values: [],
      mission_statement: null,
    },
    communication: {
      tone: "warm",
      preferred_length: "standard",
      formal_closing: "Cordialement",
      greeting_style: "Bonjour",
      avoid_words: [],
      preferred_words: [],
      signature_template: null,
      language_code: "fr",
    },
    validation: {
      ...buildDefaultCloneADNValidationProfile(),
      sensitive_topics: ["licenciement", "salaire"],
      always_require_human_for: ["doc.generate"],
    },
    autonomy: {
      ...buildDefaultCloneADNAutonomyProfile(),
      level: "supervised",
      blocked_auto_task_types: ["email.send", "email_send"],
    },
  });
}

function makeBrainTask(
  type: string,
  risk: string = "low",
  payload: Record<string, unknown> = {},
): PierreBrainTaskPlan["tasks"][0] {
  return {
    type,
    title: `Task: ${type}`,
    description: `Description for ${type}`,
    risk_level: risk as "low" | "medium" | "high" | "critical",
    payload,
    approval_required: false,
    reasoning: "",
    output_kind: "none",
  };
}

function makeBrainPlan(tasks: PierreBrainTaskPlan["tasks"]): PierreBrainTaskPlan {
  return {
    tasks,
    mission_summary: "Test mission",
    overall_risk: "low",
    requires_human_validation: false,
    brain_source: "deterministic",
  };
}

// ── 1. Task-bridge: CloneADN context ─────────────────────────────────────────

describe("task-bridge: CloneADN integration", () => {
  it("annotates cloneadn_applied=true when cloneADNContext provided", () => {
    const plan = makeBrainPlan([makeBrainTask("doc.generate")]);
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan, {
      cloneADNContext: {
        blocked_task_types: [],
        never_auto_execute: [],
        always_require_human_for: [],
        sensitive_topics: [],
        validation_mode: "recommended",
        autonomy_level: "supervised",
      },
    });
    expect(drafts.length).toBe(1);
    const payload = drafts[0].payload_json as Record<string, unknown>;
    expect(payload["cloneadn_applied"]).toBe(true);
  });

  it("does not annotate cloneadn_applied when no cloneADNContext", () => {
    const plan = makeBrainPlan([makeBrainTask("doc.generate")]);
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan);
    const payload = drafts[0].payload_json as Record<string, unknown>;
    expect(payload["cloneadn_applied"]).toBeUndefined();
  });

  it("blocks task in blocked_task_types via cloneADNContext", () => {
    const plan = makeBrainPlan([makeBrainTask("doc.generate")]);
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan, {
      cloneADNContext: {
        blocked_task_types: ["doc.generate"],
        never_auto_execute: [],
        always_require_human_for: [],
        sensitive_topics: [],
        validation_mode: "recommended",
        autonomy_level: "supervised",
      },
    });
    expect(drafts.length).toBe(1);
    const payload = drafts[0].payload_json as Record<string, unknown>;
    expect(payload["blocked"]).toBe(true);
    expect(drafts[0].approval_required).toBe(true);
  });

  it("blocks task in never_auto_execute via cloneADNContext", () => {
    const plan = makeBrainPlan([makeBrainTask("email.draft")]);
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan, {
      cloneADNContext: {
        blocked_task_types: [],
        never_auto_execute: ["email.draft"],
        always_require_human_for: [],
        sensitive_topics: [],
        validation_mode: "recommended",
        autonomy_level: "supervised",
      },
    });
    const payload = drafts[0].payload_json as Record<string, unknown>;
    expect(payload["blocked"]).toBe(true);
  });

  it("sets requires_validation for tasks in always_require_human_for", () => {
    const plan = makeBrainPlan([makeBrainTask("doc.generate")]);
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan, {
      cloneADNContext: {
        blocked_task_types: [],
        never_auto_execute: [],
        always_require_human_for: ["doc.generate"],
        sensitive_topics: [],
        validation_mode: "recommended",
        autonomy_level: "supervised",
      },
    });
    const payload = drafts[0].payload_json as Record<string, unknown>;
    expect(payload["requires_validation"]).toBe(true);
    expect(drafts[0].approval_required).toBe(true);
  });

  it("combines ADN sensitive_topics with existing sensitiveTopics", () => {
    const plan = makeBrainPlan([makeBrainTask("doc.generate")]);
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan, {
      sensitiveTopics: ["salary"],
      cloneADNContext: {
        blocked_task_types: [],
        never_auto_execute: [],
        always_require_human_for: [],
        sensitive_topics: ["licenciement"],
        validation_mode: "recommended",
        autonomy_level: "supervised",
      },
    });
    // Task with combined sensitive topics → approval_required=true
    expect(drafts[0].approval_required).toBe(true);
  });

  it("annotates autonomy_level and validation_mode in payload", () => {
    const plan = makeBrainPlan([makeBrainTask("doc.generate")]);
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan, {
      cloneADNContext: {
        blocked_task_types: [],
        never_auto_execute: [],
        always_require_human_for: [],
        sensitive_topics: [],
        validation_mode: "required",
        autonomy_level: "trusted",
      },
    });
    const payload = drafts[0].payload_json as Record<string, unknown>;
    expect(payload["autonomy_level"]).toBe("trusted");
    expect(payload["validation_mode"]).toBe("required");
  });

  it("returns empty array for null plan regardless of cloneADNContext", () => {
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(null, {
      cloneADNContext: { blocked_task_types: ["email.send"] },
    });
    expect(drafts).toHaveLength(0);
  });

  it("never uses scheduled_for (always uses execute_at)", () => {
    const plan = makeBrainPlan([makeBrainTask("doc.generate")]);
    const drafts = convertPierreBrainTaskPlanToTaskDrafts(plan, {
      cloneADNContext: { blocked_task_types: [] },
    });
    for (const d of drafts) {
      expect("scheduled_for" in d).toBe(false);
    }
  });

  it("email.send is always converted to email.draft", () => {
    expect(sanitizeBrainTaskType("email.send")).toBe("email.draft");
  });

  it("email_send is always converted to email.draft", () => {
    expect(sanitizeBrainTaskType("email_send")).toBe("email.draft");
  });
});

// ── 2. Storage safety: buildCloneADNStoragePatch ──────────────────────────────

describe("buildCloneADNStoragePatch: storage safety", () => {
  it("does not remove employees when both keys exist", () => {
    const profile = buildDefaultCloneADNProfile();
    const existing = {
      employees: [{ id: "emp1", name: "Alice" }],
      document_templates: [{ id: "tmpl1" }],
    };
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: existing, profile });
    expect(patch["employees"]).toEqual(existing.employees);
    expect(patch["document_templates"]).toEqual(existing.document_templates);
    expect(patch["clone_adn"]).toBe(profile);
  });

  it("only writes to clone_adn, not memory_json", () => {
    const profile = buildDefaultCloneADNProfile();
    const existing = { some_other_key: "value" };
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: existing, profile });
    expect("memory_json" in patch).toBe(false);
    expect(patch["clone_adn"]).toBe(profile);
  });

  it("preserves all existing keys beyond employees and document_templates", () => {
    const profile = buildDefaultCloneADNProfile();
    const existing = {
      employees: [],
      document_templates: [],
      clone_technologies: { key: "val" },
    };
    const patch = buildCloneADNStoragePatch({ reusableRhContextJson: existing, profile });
    expect(patch["clone_technologies"]).toEqual({ key: "val" });
  });
});

// ── 3. Document variables: lower priority than explicit ───────────────────────

describe("buildPierreDocumentVariablesFromCloneADN: priority", () => {
  it("returns company_name", () => {
    const p = makeConfiguredProfile();
    const vars = buildPierreDocumentVariablesFromCloneADN(p);
    expect(vars["company_name"]).toBe("Acme");
  });

  it("returns formal_closing", () => {
    const p = makeConfiguredProfile();
    const vars = buildPierreDocumentVariablesFromCloneADN(p);
    expect(vars["formal_closing"]).toBe("Cordialement");
  });

  it("explicit variables override CloneADN variables (lower priority)", () => {
    const cloneADNVars = buildPierreDocumentVariablesFromCloneADN(makeConfiguredProfile());
    const explicitVars = { company_name: "Override Corp", formal_closing: "Bien à vous" };
    // Spread order: cloneADN first, then explicit (so explicit wins)
    const merged = { ...cloneADNVars, ...explicitVars };
    expect(merged["company_name"]).toBe("Override Corp");
    expect(merged["formal_closing"]).toBe("Bien à vous");
  });

  it("CloneADN fills in missing explicit variables", () => {
    const cloneADNVars = buildPierreDocumentVariablesFromCloneADN(makeConfiguredProfile());
    const explicitVars = { title: "My Document" };
    const merged = { ...cloneADNVars, ...explicitVars };
    expect(merged["company_name"]).toBe("Acme");
    expect(merged["title"]).toBe("My Document");
  });

  it("returns empty object for null profile", () => {
    const vars = buildPierreDocumentVariablesFromCloneADN(null);
    expect(Object.keys(vars).length).toBe(0);
  });
});

// ── 4. evaluatePierreActionWithCloneADN ──────────────────────────────────────

describe("evaluatePierreActionWithCloneADN: blocking invariants", () => {
  it("email.send is always blocked (in never_auto_execute by default)", () => {
    const result = evaluatePierreActionWithCloneADN({
      profile: buildDefaultCloneADNProfile(),
      taskType: "email.send",
    });
    expect(result.blocked).toBe(true);
  });

  it("email_send is always blocked (alias)", () => {
    const result = evaluatePierreActionWithCloneADN({
      profile: buildDefaultCloneADNProfile(),
      taskType: "email_send",
    });
    expect(result.blocked).toBe(true);
  });

  it("safe task is not blocked by default profile", () => {
    const result = evaluatePierreActionWithCloneADN({
      profile: buildDefaultCloneADNProfile(),
      taskType: "reminder.create",
    });
    expect(result.blocked).toBe(false);
  });

  it("cloneadn_applied=false for null profile", () => {
    const result = evaluatePierreActionWithCloneADN({ profile: null });
    expect(result.cloneadn_applied).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it("sensitive topics trigger requires_validation", () => {
    const result = evaluatePierreActionWithCloneADN({
      profile: makeConfiguredProfile(),
      sensitiveTopics: ["licenciement"],
    });
    expect(result.requires_validation).toBe(true);
  });

  it("high risk triggers requires_validation when validation_mode != none", () => {
    const result = evaluatePierreActionWithCloneADN({
      profile: makeConfiguredProfile(),
      riskLevel: "high",
    });
    expect(result.requires_validation).toBe(true);
  });

  it("never throws for any input combination", () => {
    const inputs = [
      { profile: null },
      { profile: buildDefaultCloneADNProfile() },
      { profile: makeConfiguredProfile(), taskType: "email.send", riskLevel: "critical" },
      { profile: makeConfiguredProfile(), sensitiveTopics: ["faute"], text: "long text here" },
    ];
    for (const input of inputs) {
      expect(() => evaluatePierreActionWithCloneADN(input)).not.toThrow();
    }
  });
});

// ── 5. buildPierreCloneADNHint: mission hint ──────────────────────────────────

describe("buildPierreCloneADNHint: mission integration", () => {
  it("returns null for null profile", () => {
    expect(buildPierreCloneADNHint(null)).toBeNull();
  });

  it("returns non-null hint for non-null profile", () => {
    expect(buildPierreCloneADNHint(buildDefaultCloneADNProfile())).not.toBeNull();
  });

  it("hint.configured=false when status=not_configured", () => {
    const hint = buildPierreCloneADNHint(buildDefaultCloneADNProfile());
    expect(hint!["configured"]).toBe(false);
  });

  it("hint.configured=true when status!=not_configured", () => {
    const hint = buildPierreCloneADNHint(makeProfile({ status: "configured" }));
    expect(hint!["configured"]).toBe(true);
  });

  it("hint contains all required fields", () => {
    const hint = buildPierreCloneADNHint(makeConfiguredProfile());
    const requiredFields = ["configured", "status", "completeness_score", "tone", "autonomy_level", "validation_mode", "company_name", "active_rules", "blocking_rules", "sites_count", "departments_count"];
    for (const field of requiredFields) {
      expect(field in hint!).toBe(true);
    }
  });

  it("does not expose any secrets (keys check)", () => {
    const hint = buildPierreCloneADNHint(makeConfiguredProfile());
    const keys = Object.keys(hint ?? {});
    const secretKeys = ["service_role_key", "supabase_key", "api_key", "secret"];
    for (const secret of secretKeys) {
      expect(keys.some((k) => k.includes(secret))).toBe(false);
    }
  });
});

// ── 6. HR hint builders: CloneADN optional param ─────────────────────────────

describe("operational-readiness: cloneADNHint param", () => {
  const emptyMission = {
    id: "m1",
    status: "active",
    classification: "onboarding",
    payload_json: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as Record<string, unknown>;

  it("builds hint without cloneADNHint param (backward compat)", () => {
    expect(() => buildMissionReadinessHint(emptyMission, [], [], [])).not.toThrow();
  });

  it("builds hint with null cloneADNHint (backward compat)", () => {
    expect(() => buildMissionReadinessHint(emptyMission, [], [], [], null)).not.toThrow();
  });

  it("adds company_memory gate when cloneADN configured", () => {
    const hint = buildMissionReadinessHint(emptyMission, [], [], [], {
      configured: true,
      blocking_rules: 0,
      active_rules: 0,
    });
    expect(hint.gates_impacted).toContain("company_memory");
  });

  it("adds controlled_autonomy gate when blocking_rules > 0", () => {
    const hint = buildMissionReadinessHint(emptyMission, [], [], [], {
      configured: true,
      blocking_rules: 2,
      active_rules: 2,
    });
    expect(hint.gates_impacted).toContain("controlled_autonomy");
  });

  it("adds cloneguard gate when active_rules > 0 but no blocking_rules", () => {
    const hint = buildMissionReadinessHint(emptyMission, [], [], [], {
      configured: true,
      blocking_rules: 0,
      active_rules: 3,
    });
    expect(hint.gates_impacted).toContain("cloneguard");
  });

  it("does not add cloneADN gates when not configured", () => {
    const hint = buildMissionReadinessHint(emptyMission, [], [], [], {
      configured: false,
    });
    expect(hint.gates_impacted).not.toContain("company_memory");
  });
});

describe("release-proof: cloneADNHint param", () => {
  const emptyMission = {
    id: "m1",
    status: "active",
    classification: "onboarding",
    payload_json: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as Record<string, unknown>;

  it("builds hint without cloneADNHint param (backward compat)", () => {
    expect(() => buildMissionReleaseProofHint(emptyMission, [], [], [])).not.toThrow();
  });

  it("boosts global_score by 3 when configured", () => {
    const hintWithout = buildMissionReleaseProofHint(emptyMission, [], [], []);
    const hintWith = buildMissionReleaseProofHint(emptyMission, [], [], [], { configured: true });
    expect(hintWith.global_score).toBeGreaterThanOrEqual(hintWithout.global_score);
  });

  it("does not boost when not configured", () => {
    const hintWith = buildMissionReleaseProofHint(emptyMission, [], [], [], { configured: false });
    const hintWithout = buildMissionReleaseProofHint(emptyMission, [], [], []);
    expect(hintWith.global_score).toBe(hintWithout.global_score);
  });

  it("clamps global_score at 100", () => {
    const hint = buildMissionReleaseProofHint(emptyMission, [], [], [], { configured: true, completeness_score: 100 });
    expect(hint.global_score).toBeLessThanOrEqual(100);
  });
});

describe("trial-activation: cloneADNHint param", () => {
  const emptyMission = {
    id: "m1",
    status: "active",
    classification: "onboarding",
    payload_json: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as Record<string, unknown>;

  it("builds hint without cloneADNHint param (backward compat)", () => {
    expect(() => buildMissionTrialActivationHint(emptyMission, [], [], [])).not.toThrow();
  });

  it("boosts value_score and conversion_score by 3 when configured", () => {
    const hintWith = buildMissionTrialActivationHint(emptyMission, [], [], [], { configured: true });
    const hintWithout = buildMissionTrialActivationHint(emptyMission, [], [], []);
    expect(hintWith.value_score).toBeGreaterThanOrEqual(hintWithout.value_score);
    expect(hintWith.conversion_score).toBeGreaterThanOrEqual(hintWithout.conversion_score);
  });

  it("does not boost when not configured", () => {
    const hintWith = buildMissionTrialActivationHint(emptyMission, [], [], [], { configured: false });
    const hintWithout = buildMissionTrialActivationHint(emptyMission, [], [], []);
    expect(hintWith.value_score).toBe(hintWithout.value_score);
  });

  it("clamps value_score and conversion_score at 100", () => {
    const hint = buildMissionTrialActivationHint(emptyMission, [], [], [], { configured: true });
    expect(hint.value_score).toBeLessThanOrEqual(100);
    expect(hint.conversion_score).toBeLessThanOrEqual(100);
  });
});

describe("customer-success: cloneADNHint param", () => {
  const emptyMission = {
    id: "m1",
    status: "active",
    classification: "onboarding",
    payload_json: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as Record<string, unknown>;

  it("builds hint without cloneADNHint param (backward compat)", () => {
    expect(() => buildPierreCustomerSuccessMissionHint({ mission: emptyMission, tasks: [], documents: [], logs: [] })).not.toThrow();
  });

  it("boosts scores when status=strong", () => {
    const hintWith = buildPierreCustomerSuccessMissionHint({ mission: emptyMission, tasks: [], documents: [], logs: [], cloneADNHint: { configured: true, status: "strong" } });
    const hintWithout = buildPierreCustomerSuccessMissionHint({ mission: emptyMission, tasks: [], documents: [], logs: [] });
    expect(hintWith.health_score).toBeGreaterThanOrEqual(hintWithout.health_score);
  });

  it("boosts scores when status=locked", () => {
    const hintWith = buildPierreCustomerSuccessMissionHint({ mission: emptyMission, tasks: [], documents: [], logs: [], cloneADNHint: { configured: true, status: "locked" } });
    const hintWithout = buildPierreCustomerSuccessMissionHint({ mission: emptyMission, tasks: [], documents: [], logs: [] });
    expect(hintWith.health_score).toBeGreaterThanOrEqual(hintWithout.health_score);
  });

  it("does not boost for status=partial", () => {
    const hintWith = buildPierreCustomerSuccessMissionHint({ mission: emptyMission, tasks: [], documents: [], logs: [], cloneADNHint: { configured: true, status: "partial" } });
    const hintWithout = buildPierreCustomerSuccessMissionHint({ mission: emptyMission, tasks: [], documents: [], logs: [] });
    expect(hintWith.health_score).toBe(hintWithout.health_score);
  });

  it("clamps health_score at 100", () => {
    const hint = buildPierreCustomerSuccessMissionHint({ mission: emptyMission, tasks: [], documents: [], logs: [], cloneADNHint: { configured: true, status: "strong" } });
    expect(hint.health_score).toBeLessThanOrEqual(100);
  });
});

// ── 7. Application context builder integration ────────────────────────────────

describe("buildCloneADNApplicationContext: integration", () => {
  it("returns safe defaults when profile is null", () => {
    const ctx = buildCloneADNApplicationContext(null);
    expect(ctx.never_auto_execute).toContain("email.send");
    expect(ctx.autonomy_level).toBe("supervised");
    expect(ctx.validation_mode).toBe("recommended");
  });

  it("reflects configured profile", () => {
    const ctx = buildCloneADNApplicationContext(makeConfiguredProfile());
    expect(ctx.tone).toBe("warm");
    expect(ctx.sensitive_topics).toContain("licenciement");
  });

  it("always_require_human_for is propagated", () => {
    const ctx = buildCloneADNApplicationContext(makeConfiguredProfile());
    expect(ctx.always_require_human_for).toContain("doc.generate");
  });

  it("preferred_format is propagated", () => {
    const ctx = buildCloneADNApplicationContext(makeConfiguredProfile());
    expect(ctx.preferred_format).toBe("html");
  });

  it("company_name is trade_name when both exist", () => {
    const ctx = buildCloneADNApplicationContext(makeConfiguredProfile());
    expect(ctx.company_name).toBe("Acme");
  });
});

// ── 8. Brain context builder integration ─────────────────────────────────────

describe("buildPierreCompanyContextFromCloneADN: integration", () => {
  it("returns null for null profile", () => {
    expect(buildPierreCompanyContextFromCloneADN(null)).toBeNull();
  });

  it("includes clone_adn_status", () => {
    const ctx = buildPierreCompanyContextFromCloneADN(makeConfiguredProfile());
    expect(ctx!["clone_adn_status"]).toBe("configured");
  });

  it("includes never_auto_execute list", () => {
    const ctx = buildPierreCompanyContextFromCloneADN(makeConfiguredProfile());
    expect(Array.isArray(ctx!["never_auto_execute"])).toBe(true);
    expect((ctx!["never_auto_execute"] as string[]).length).toBeGreaterThan(0);
  });

  it("includes sensitive_topics", () => {
    const ctx = buildPierreCompanyContextFromCloneADN(makeConfiguredProfile());
    expect(Array.isArray(ctx!["sensitive_topics"])).toBe(true);
    expect((ctx!["sensitive_topics"] as string[]).length).toBeGreaterThan(0);
  });
});
