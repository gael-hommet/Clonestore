// src/lib/pierre/__tests__/cloneadn-context-b35.test.ts
// B35 — CloneADN integration with context layer

import { describe, it, expect } from "vitest";
import { buildPierreContextPack } from "../context/context-runtime";
import { buildCompanyContextSignals } from "../context/company-context";
import { buildRulesContextSignals } from "../context/rules-context";
import { buildValidationContextSignals } from "../context/validation-context";

const CO = "co_beta";

// Minimal valid CloneADN profile (matching CloneADNProfile structure)
function makeAdnProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "configured",
    version: "1.0",
    company_identity: {
      legal_name: "Beta SAS",
      trade_name: "Beta",
      sector: "finance",
      size_range: "50-200",
      country_code: "FR",
      main_language: "fr",
      hr_contact_email: "rh@beta.fr",
      values: ["intégrité", "innovation"],
      mission_statement: null,
    },
    communication: {
      tone: "formal",
      preferred_length: "standard",
      formal_closing: "Cordialement",
      greeting_style: "Madame, Monsieur",
      avoid_words: ["urgente"],
      preferred_words: ["accompagner"],
      signature_template: null,
      language_code: "fr",
    },
    validation: {
      default_mode: "required",
      always_require_human_for: ["email.send", "send_email"],
      never_auto_execute: ["email.send", "send_email"],
      sensitive_topics: ["licenciement", "harcèlement"],
      approval_required_risk_levels: ["high", "sensitive"],
    },
    autonomy: {
      level: "supervised",
      allowed_auto_task_types: [],
      blocked_auto_task_types: ["email.send"],
      max_auto_tasks_per_mission: 3,
      require_approval_above_risk: "medium",
    },
    document: {
      preferred_format: "html",
      preferred_tone: "formal",
      always_include_signature: true,
      always_include_legal_footer: true,
      require_validation_for_risk_levels: ["high", "sensitive"],
      preferred_template_ids: [],
    },
    rules: [],
    sites: [],
    departments: [],
    inferred_preferences: [],
    completeness_score: 0.8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Company context with CloneADN ─────────────────────────────────────────────

describe("buildCompanyContextSignals with CloneADN", () => {
  it("returns configured ADN status signal", () => {
    const profile = makeAdnProfile();
    const signals = buildCompanyContextSignals({
      company_id: CO,
      company_memory: null,
      clone_adn_profile: profile,
    });
    const adnSignal = signals.find((s) => s.scope === "adn");
    expect(adnSignal).toBeDefined();
    expect(adnSignal?.title).toContain("configuré");
  });

  it("returns communication preference signal", () => {
    const profile = makeAdnProfile();
    const signals = buildCompanyContextSignals({
      company_id: CO,
      company_memory: null,
      clone_adn_profile: profile,
    });
    const pref = signals.find((s) => s.type === "preference" && s.scope === "preference");
    expect(pref).toBeDefined();
    expect(pref?.content).toContain("formal");
  });

  it("generates constraint when current task type is in never_auto_execute", () => {
    const profile = makeAdnProfile();
    const signals = buildCompanyContextSignals({
      company_id: CO,
      company_memory: null,
      clone_adn_profile: profile,
      current_task_type: "email.send",
    });
    const constraint = signals.find((s) => s.type === "constraint" || s.type === "validation_gate");
    expect(constraint).toBeDefined();
  });

  it("no constraint for safe task types", () => {
    const profile = makeAdnProfile();
    const signals = buildCompanyContextSignals({
      company_id: CO,
      company_memory: null,
      clone_adn_profile: profile,
      current_task_type: "document.generate",
    });
    const blocked = signals.find((s) => s.risk === "blocked");
    expect(blocked).toBeUndefined();
  });
});

// ── Rules context with CloneADN ───────────────────────────────────────────────

describe("buildRulesContextSignals with CloneADN", () => {
  it("returns empty when no CloneADN profile", () => {
    const signals = buildRulesContextSignals({ company_id: CO, clone_adn_profile: null });
    expect(signals).toHaveLength(0);
  });

  it("returns no overview rule signal for profile with empty rules array", () => {
    const profile = makeAdnProfile();
    const signals = buildRulesContextSignals({ company_id: CO, clone_adn_profile: profile });
    // No active rules — overview signal not generated, but sensitive_topics + never_auto_execute signals still emitted
    const overviewSignal = signals.find((s) => s.title.includes("Règles CloneADN"));
    expect(overviewSignal).toBeUndefined();
  });

  it("generates never_auto_execute constraint signal when task matches", () => {
    const profile = makeAdnProfile();
    const signals = buildRulesContextSignals({
      company_id: CO,
      clone_adn_profile: profile,
      current_task_type: "email.send",
    });
    const constraint = signals.find((s) => s.type === "constraint" && s.risk === "blocked");
    expect(constraint).toBeDefined();
    expect(constraint?.title).toContain("email.send");
  });

  it("generates sensitive topics signal", () => {
    const profile = makeAdnProfile();
    const signals = buildRulesContextSignals({ company_id: CO, clone_adn_profile: profile });
    const topics = signals.find((s) => s.title.includes("Topics sensibles"));
    expect(topics).toBeDefined();
  });

  it("generates blocking rule signal for active blocking rules", () => {
    const profile = makeAdnProfile({
      rules: [
        {
          id: "r1",
          label: "Bloquer envoi email auto",
          description: "Aucun envoi email automatique sans approbation",
          category: "security",
          severity: "block",
          condition: "task_type == email.send",
          action: "block",
          active: true,
          applies_to_domains: [],
          applies_to_task_types: ["email.send"],
          requires_human_validation: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const signals = buildRulesContextSignals({
      company_id: CO,
      clone_adn_profile: profile,
      current_task_type: "email.send",
    });
    const constraint = signals.find((s) => s.type === "constraint" && s.risk === "high");
    expect(constraint).toBeDefined();
  });
});

// ── Validation context ────────────────────────────────────────────────────────

describe("buildValidationContextSignals", () => {
  it("adds gate when tasks pending approval", () => {
    const signals = buildValidationContextSignals({
      company_id: CO,
      clone_adn_profile: null,
      tasks: [{ id: "t1", status: "awaiting_approval", approval_required: true }],
      files: [],
    });
    const gate = signals.find((s) => s.type === "validation_gate");
    expect(gate).toBeDefined();
    expect(gate?.risk).toBe("high");
  });

  it("adds sensitive file gate", () => {
    const signals = buildValidationContextSignals({
      company_id: CO,
      clone_adn_profile: null,
      tasks: [],
      files: [{ id: "f1", risk_level: "sensitive", category: "sick_leave" }],
    });
    const gate = signals.find((s) => s.type === "validation_gate" && s.risk === "sensitive");
    expect(gate).toBeDefined();
  });

  it("adds human_only mode constraint from CloneADN", () => {
    const profile = makeAdnProfile({
      validation: {
        default_mode: "human_only",
        always_require_human_for: [],
        never_auto_execute: [],
        sensitive_topics: [],
        approval_required_risk_levels: [],
      },
    });
    const signals = buildValidationContextSignals({
      company_id: CO,
      clone_adn_profile: profile,
      tasks: [],
      files: [],
    });
    const constraint = signals.find((s) => s.type === "constraint" && s.title.includes("humain uniquement"));
    expect(constraint).toBeDefined();
  });

  it("adds always_require_human gate when current task matches", () => {
    const profile = makeAdnProfile();
    const signals = buildValidationContextSignals({
      company_id: CO,
      clone_adn_profile: profile,
      tasks: [],
      files: [],
      current_task_type: "email.send",
    });
    const gate = signals.find((s) => s.type === "validation_gate" && s.title.includes("email.send"));
    expect(gate).toBeDefined();
  });

  it("returns no signals when nothing to validate", () => {
    const signals = buildValidationContextSignals({
      company_id: CO,
      clone_adn_profile: null,
      tasks: [],
      files: [],
    });
    expect(signals).toHaveLength(0);
  });
});

// ── Full integration: CloneADN + context pack ─────────────────────────────────

describe("buildPierreContextPack with CloneADN profile", () => {
  it("includes ADN signals in pack", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      clone_adn_profile: makeAdnProfile(),
    });
    const adnSignal = result.pack.signals.find((s) => s.scope === "adn");
    expect(adnSignal).toBeDefined();
  });

  it("includes preference signals from ADN", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      clone_adn_profile: makeAdnProfile(),
    });
    const prefSignal = result.pack.signals.find((s) => s.scope === "preference");
    expect(prefSignal).toBeDefined();
  });

  it("top_preferences populated from ADN", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      clone_adn_profile: makeAdnProfile(),
    });
    expect(result.pack.top_preferences.length).toBeGreaterThan(0);
  });

  it("marks validation required for email.send task type", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      clone_adn_profile: makeAdnProfile(),
      current_task_type: "email.send",
    });
    expect(result.should_require_validation).toBe(true);
  });

  it("returns human-readable risk_summary", () => {
    const result = buildPierreContextPack({
      company_id: CO,
      built_for: "pierre_brain",
      clone_adn_profile: makeAdnProfile(),
    });
    expect(result.pack.risk_summary).toBeTruthy();
    expect(typeof result.pack.risk_summary).toBe("string");
  });
});
