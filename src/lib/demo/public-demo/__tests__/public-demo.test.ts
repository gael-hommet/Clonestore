// P-FINAL 01 — Phase 6 — Tests for public demo library.
// All simulate-route: pure functions only. No AI, no email, no Supabase.

import { describe, it, expect } from "vitest";
import {
  DEMO_SAFETY_RULES,
  ALLOWED_DEMO_ACTIONS,
  isDemoActionAllowed,
  getAbsoluteRules,
  getForbiddenRules,
  getAllowedRules,
} from "../demo-safety-rules";
import {
  guardDemoOperation,
  isSessionValid,
  isDemoSessionSafe,
  canPerformAction,
} from "../demo-guard";
import {
  createDemoSession,
  terminateDemoSession,
  expireDemoSession,
  getDemoSessionStatus,
  getDemoSessionSummary,
  DEMO_MAX_ACTIONS_CONSTANT,
} from "../demo-session";
import {
  DEMO_DISCLAIMER,
  DEMO_EMPLOYEES,
  DEMO_TASKS,
  DEMO_COCKPIT_STATS,
} from "../demo-content";
import {
  DEMO_SCENARIOS,
  getDemoScenarioById,
  getAllDemoScenarioIds,
  validateDemoScenario,
} from "../demo-scenario";

// ── Safety Rules ──────────────────────────────────────────────────────────────

describe("demo-safety-rules", () => {
  it("safety rules list is not empty", () => {
    expect(DEMO_SAFETY_RULES.length).toBeGreaterThan(0);
  });

  it("all rules have id, label, description, is_absolute, allowed_in_demo", () => {
    for (const rule of DEMO_SAFETY_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.label).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(typeof rule.is_absolute).toBe("boolean");
      expect(typeof rule.allowed_in_demo).toBe("boolean");
    }
  });

  it("no_real_ai_calls rule is absolute and forbidden", () => {
    const rule = DEMO_SAFETY_RULES.find((r) => r.id === "no_real_ai_calls");
    expect(rule).toBeDefined();
    expect(rule!.is_absolute).toBe(true);
    expect(rule!.allowed_in_demo).toBe(false);
  });

  it("no_real_emails rule is absolute and forbidden", () => {
    const rule = DEMO_SAFETY_RULES.find((r) => r.id === "no_real_emails");
    expect(rule).toBeDefined();
    expect(rule!.is_absolute).toBe(true);
    expect(rule!.allowed_in_demo).toBe(false);
  });

  it("no_stripe_checkout rule is absolute and forbidden", () => {
    const rule = DEMO_SAFETY_RULES.find((r) => r.id === "no_stripe_checkout");
    expect(rule).toBeDefined();
    expect(rule!.is_absolute).toBe(true);
    expect(rule!.allowed_in_demo).toBe(false);
  });

  it("getAbsoluteRules returns only absolute rules", () => {
    for (const rule of getAbsoluteRules()) {
      expect(rule.is_absolute).toBe(true);
    }
  });

  it("getForbiddenRules returns only forbidden rules", () => {
    for (const rule of getForbiddenRules()) {
      expect(rule.allowed_in_demo).toBe(false);
    }
  });

  it("getAllowedRules returns only allowed rules", () => {
    for (const rule of getAllowedRules()) {
      expect(rule.allowed_in_demo).toBe(true);
    }
  });

  it("isDemoActionAllowed: view_dashboard allowed", () => {
    expect(isDemoActionAllowed("view_dashboard")).toBe(true);
  });

  it("isDemoActionAllowed: simulate_task allowed", () => {
    expect(isDemoActionAllowed("simulate_task")).toBe(true);
  });

  it("all ALLOWED_DEMO_ACTIONS pass isDemoActionAllowed", () => {
    for (const action of ALLOWED_DEMO_ACTIONS) {
      expect(isDemoActionAllowed(action)).toBe(true);
    }
  });
});

// ── Guard ─────────────────────────────────────────────────────────────────────

describe("demo-guard", () => {
  it("ai_api_call always blocked", () => {
    const result = guardDemoOperation("ai_api_call");
    expect(result.allowed).toBe(false);
    expect(result.would_cost_real_money).toBe(true);
  });

  it("email_send always blocked", () => {
    const result = guardDemoOperation("email_send");
    expect(result.allowed).toBe(false);
    expect(result.would_send_real_data).toBe(true);
  });

  it("stripe_checkout always blocked", () => {
    const result = guardDemoOperation("stripe_checkout");
    expect(result.allowed).toBe(false);
    expect(result.would_cost_real_money).toBe(true);
  });

  it("database_write always blocked", () => {
    const result = guardDemoOperation("database_write");
    expect(result.allowed).toBe(false);
    expect(result.would_send_real_data).toBe(true);
  });

  it("account_create always blocked", () => {
    const result = guardDemoOperation("account_create");
    expect(result.allowed).toBe(false);
    expect(result.would_create_real_account).toBe(true);
  });

  it("demo_action view_dashboard allowed", () => {
    const result = guardDemoOperation("demo_action", "view_dashboard");
    expect(result.allowed).toBe(true);
    expect(result.is_safe).toBe(true);
  });

  it("demo_action without actionType blocked", () => {
    const result = guardDemoOperation("demo_action");
    expect(result.allowed).toBe(false);
  });

  it("all blocked operations are is_safe (contained, no real side effects)", () => {
    const ops = ["ai_api_call", "email_send", "stripe_checkout", "database_write", "account_create"] as const;
    for (const op of ops) {
      const result = guardDemoOperation(op);
      expect(result.is_safe).toBe(true);
    }
  });

  it("isSessionValid: active session with actions remaining → valid", () => {
    const session = createDemoSession();
    expect(isSessionValid(session)).toBe(true);
  });

  it("isSessionValid: terminated session → invalid", () => {
    const session = terminateDemoSession(createDemoSession());
    expect(isSessionValid(session)).toBe(false);
  });

  it("isSessionValid: max actions reached → invalid", () => {
    const session = createDemoSession();
    session.action_count = DEMO_MAX_ACTIONS_CONSTANT;
    expect(isSessionValid(session)).toBe(false);
  });

  it("isDemoSessionSafe: new session → safe", () => {
    expect(isDemoSessionSafe(createDemoSession())).toBe(true);
  });

  it("canPerformAction: valid session + allowed action → true", () => {
    const session = createDemoSession();
    expect(canPerformAction(session, "view_dashboard")).toBe(true);
  });

  it("canPerformAction: terminated session → false", () => {
    const session = terminateDemoSession(createDemoSession());
    expect(canPerformAction(session, "view_dashboard")).toBe(false);
  });
});

// ── Session ───────────────────────────────────────────────────────────────────

describe("demo-session", () => {
  it("createDemoSession: is_real_account is always false", () => {
    expect(createDemoSession().is_real_account).toBe(false);
  });

  it("createDemoSession: ai_calls_allowed is always false", () => {
    expect(createDemoSession().ai_calls_allowed).toBe(false);
  });

  it("createDemoSession: email_send_allowed is always false", () => {
    expect(createDemoSession().email_send_allowed).toBe(false);
  });

  it("createDemoSession: stripe_checkout_allowed is always false", () => {
    expect(createDemoSession().stripe_checkout_allowed).toBe(false);
  });

  it("createDemoSession: status active", () => {
    expect(createDemoSession().status).toBe("active");
  });

  it("terminateDemoSession: status becomes terminated", () => {
    expect(terminateDemoSession(createDemoSession()).status).toBe("terminated");
  });

  it("expireDemoSession: status becomes expired", () => {
    expect(expireDemoSession(createDemoSession()).status).toBe("expired");
  });

  it("getDemoSessionStatus: active new session → active", () => {
    expect(getDemoSessionStatus(createDemoSession())).toBe("active");
  });

  it("getDemoSessionStatus: terminated → terminated", () => {
    expect(getDemoSessionStatus(terminateDemoSession(createDemoSession()))).toBe("terminated");
  });

  it("getDemoSessionSummary: new session is valid", () => {
    const summary = getDemoSessionSummary(createDemoSession());
    expect(summary.is_valid).toBe(true);
    expect(summary.is_real_account).toBe(false);
    expect(summary.is_real_data).toBe(false);
  });

  it("getDemoSessionSummary: max actions correct", () => {
    const summary = getDemoSessionSummary(createDemoSession());
    expect(summary.actions_remaining).toBe(DEMO_MAX_ACTIONS_CONSTANT);
  });
});

// ── Content ───────────────────────────────────────────────────────────────────

describe("demo-content", () => {
  it("DEMO_DISCLAIMER has short, full, legal", () => {
    expect(DEMO_DISCLAIMER.short).toBeTruthy();
    expect(DEMO_DISCLAIMER.full).toBeTruthy();
    expect(DEMO_DISCLAIMER.legal).toBeTruthy();
  });

  it("DEMO_EMPLOYEES has at least 2 entries", () => {
    expect(DEMO_EMPLOYEES.length).toBeGreaterThanOrEqual(2);
  });

  it("DEMO_TASKS has at least 1 entry with simulated_output", () => {
    expect(DEMO_TASKS.length).toBeGreaterThan(0);
    for (const task of DEMO_TASKS) {
      expect(task.simulated_output).toBeTruthy();
    }
  });
});

// ── Scenarios ─────────────────────────────────────────────────────────────────

describe("demo-scenario", () => {
  it("DEMO_SCENARIOS has at least 2 scenarios", () => {
    expect(DEMO_SCENARIOS.length).toBeGreaterThanOrEqual(2);
  });

  it("all scenarios have is_illustrative: true", () => {
    for (const s of DEMO_SCENARIOS) {
      expect(s.is_illustrative).toBe(true);
    }
  });

  it("all scenarios have uses_real_data: false", () => {
    for (const s of DEMO_SCENARIOS) {
      expect(s.uses_real_data).toBe(false);
    }
  });

  it("getDemoScenarioById returns correct scenario", () => {
    const s = getDemoScenarioById("scenario_rh_onboarding");
    expect(s).toBeDefined();
    expect(s!.name).toBeTruthy();
  });

  it("getDemoScenarioById returns undefined for unknown id", () => {
    expect(getDemoScenarioById("nonexistent")).toBeUndefined();
  });

  it("getAllDemoScenarioIds returns all ids", () => {
    const ids = getAllDemoScenarioIds();
    expect(ids.length).toBe(DEMO_SCENARIOS.length);
  });

  it("validateDemoScenario: all scenarios are safe", () => {
    for (const scenario of DEMO_SCENARIOS) {
      const result = validateDemoScenario(scenario);
      expect(result.is_safe).toBe(true);
      expect(result.violations).toHaveLength(0);
    }
  });

  it("each scenario has at least 1 step", () => {
    for (const s of DEMO_SCENARIOS) {
      expect(s.steps.length).toBeGreaterThan(0);
    }
  });

  it("scenario steps have simulated_pierre_response", () => {
    for (const s of DEMO_SCENARIOS) {
      for (const step of s.steps) {
        expect(step.simulated_pierre_response).toBeTruthy();
      }
    }
  });

  it("no scenario step claims real AI call", () => {
    for (const s of DEMO_SCENARIOS) {
      for (const step of s.steps) {
        expect(step.simulated_pierre_response).not.toContain("real API");
        expect(step.simulated_pierre_response).not.toContain("sk_live");
      }
    }
  });

  it("DEMO_COCKPIT_STATS has time_saved_hours", () => {
    expect(DEMO_COCKPIT_STATS.time_saved_hours).toBeTruthy();
    expect(DEMO_COCKPIT_STATS.note).toBeTruthy();
  });
});
