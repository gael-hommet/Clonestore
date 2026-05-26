// src/lib/pierre/cockpit/__tests__/cockpit-b40-state.test.ts
// Pierre Cockpit B40 — State machine, budget, runtime modes tests.
// Pure unit tests. No Supabase, no API calls, no network.

import { describe, it, expect } from "vitest";
import {
  resolveCockpitState,
  isBlockedState,
  isOperationalState,
  canSubmitMission,
  getCockpitStateLabel,
  getCockpitStateBlockReason,
  buildDefaultBudgetStatus,
  buildBudgetStatusFromAIStatus,
  buildDefaultRuntimeModes,
  buildEmptySnapshot,
  buildSnapshotWarnings,
} from "../state";
import { buildMockTenantContext } from "../tenant";
import type { PierreTenantContext, PierreCockpitState } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTenant(overrides: Partial<PierreTenantContext> = {}): PierreTenantContext {
  return buildMockTenantContext(overrides);
}

// ══════════════════════════════════════════════════════════════
// GROUP 1 — resolveCockpitState
// ══════════════════════════════════════════════════════════════

describe("resolveCockpitState", () => {
  it("T1 — returns loading when isLoading=true", () => {
    const tenant = makeTenant();
    expect(resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: true })).toBe("loading");
  });

  it("T2 — returns blocked_no_company when tenant is null", () => {
    expect(resolveCockpitState(null, { hasData: false, hasError: false, isLoading: false })).toBe("blocked_no_company");
  });

  it("T3 — returns blocked_no_company when company_id is null", () => {
    const tenant = makeTenant({ company_id: null });
    expect(resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: false })).toBe("blocked_no_company");
  });

  it("T4 — returns blocked_no_company when user_id is null", () => {
    const tenant = makeTenant({ user_id: null });
    expect(resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: false })).toBe("blocked_no_company");
  });

  it("T5 — returns blocked_not_paid for anonymous access", () => {
    const tenant = makeTenant({ access_level: "anonymous", owns_pierre: false });
    expect(resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: false })).toBe("blocked_not_paid");
  });

  it("T6 — returns blocked_not_paid for logged_unpaid access", () => {
    const tenant = makeTenant({ access_level: "logged_unpaid", owns_pierre: false });
    expect(resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: false })).toBe("blocked_not_paid");
  });

  it("T7 — returns blocked_not_active when owns_pierre=false (trial)", () => {
    const tenant = makeTenant({ access_level: "trial", owns_pierre: false });
    expect(resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: false })).toBe("blocked_not_active");
  });

  it("T8 — returns blocked_not_active when pierre_enabled=false", () => {
    const tenant = makeTenant({ pierre_enabled: false });
    expect(resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: false })).toBe("blocked_not_active");
  });

  it("T9 — returns error when hasError=true and no data", () => {
    const tenant = makeTenant();
    expect(resolveCockpitState(tenant, { hasData: false, hasError: true, isLoading: false })).toBe("error");
  });

  it("T10 — returns degraded when hasError=true but has some data", () => {
    const tenant = makeTenant();
    expect(resolveCockpitState(tenant, { hasData: true, hasError: true, isLoading: false })).toBe("degraded");
  });

  it("T11 — returns ready for valid paid tenant with data", () => {
    const tenant = makeTenant();
    expect(resolveCockpitState(tenant, { hasData: true, hasError: false, isLoading: false })).toBe("ready");
  });

  it("T12 — returns ready for valid paid tenant without data", () => {
    const tenant = makeTenant();
    expect(resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: false })).toBe("ready");
  });

  it("T13 — internal_admin is treated as paid (ready)", () => {
    const tenant = makeTenant({ access_level: "internal_admin" });
    expect(resolveCockpitState(tenant, { hasData: false, hasError: false, isLoading: false })).toBe("ready");
  });

  it("T14 — loading takes priority over all other conditions", () => {
    // Even if tenant is null + hasError, loading wins
    expect(resolveCockpitState(null, { hasData: false, hasError: true, isLoading: true })).toBe("loading");
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 2 — State predicates
// ══════════════════════════════════════════════════════════════

describe("isBlockedState", () => {
  const blocked: PierreCockpitState[] = [
    "blocked_not_active", "blocked_not_paid", "blocked_no_company", "blocked_no_access",
  ];
  const nonBlocked: PierreCockpitState[] = ["loading", "ready", "degraded", "error"];

  for (const state of blocked) {
    it(`T15 — ${state} is blocked`, () => {
      expect(isBlockedState(state)).toBe(true);
    });
  }

  for (const state of nonBlocked) {
    it(`T16 — ${state} is not blocked`, () => {
      expect(isBlockedState(state)).toBe(false);
    });
  }
});

describe("isOperationalState", () => {
  it("T17 — ready is operational", () => {
    expect(isOperationalState("ready")).toBe(true);
  });

  it("T18 — degraded is operational", () => {
    expect(isOperationalState("degraded")).toBe(true);
  });

  it("T19 — loading is not operational", () => {
    expect(isOperationalState("loading")).toBe(false);
  });

  it("T20 — error is not operational", () => {
    expect(isOperationalState("error")).toBe(false);
  });

  it("T21 — blocked states are not operational", () => {
    expect(isOperationalState("blocked_not_paid")).toBe(false);
    expect(isOperationalState("blocked_not_active")).toBe(false);
  });
});

describe("canSubmitMission", () => {
  it("T22 — ready + authorized tenant allows submission", () => {
    const tenant = makeTenant();
    expect(canSubmitMission("ready", tenant)).toBe(true);
  });

  it("T23 — degraded + authorized tenant allows submission", () => {
    const tenant = makeTenant();
    expect(canSubmitMission("degraded", tenant)).toBe(true);
  });

  it("T24 — blocked state prevents submission", () => {
    const tenant = makeTenant();
    expect(canSubmitMission("blocked_not_paid", tenant)).toBe(false);
  });

  it("T25 — null tenant prevents submission", () => {
    expect(canSubmitMission("ready", null)).toBe(false);
  });

  it("T26 — tenant without pierre prevents submission", () => {
    const tenant = makeTenant({ owns_pierre: false });
    expect(canSubmitMission("ready", tenant)).toBe(false);
  });

  it("T27 — loading state prevents submission", () => {
    const tenant = makeTenant();
    expect(canSubmitMission("loading", tenant)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 3 — Labels and block reasons
// ══════════════════════════════════════════════════════════════

describe("getCockpitStateLabel", () => {
  it("T28 — ready label", () => {
    expect(getCockpitStateLabel("ready")).toBe("Actif");
  });

  it("T29 — loading label", () => {
    expect(getCockpitStateLabel("loading")).toContain("Chargement");
  });

  it("T30 — blocked_not_paid label", () => {
    expect(getCockpitStateLabel("blocked_not_paid")).toBeTruthy();
  });

  it("T31 — all states have a label", () => {
    const states: PierreCockpitState[] = [
      "loading", "ready", "blocked_not_active", "blocked_not_paid",
      "blocked_no_company", "blocked_no_access", "degraded", "error",
    ];
    for (const state of states) {
      expect(getCockpitStateLabel(state)).toBeTruthy();
    }
  });
});

describe("getCockpitStateBlockReason", () => {
  it("T32 — blocked_not_active has a reason", () => {
    expect(getCockpitStateBlockReason("blocked_not_active")).toBeTruthy();
  });

  it("T33 — blocked_not_paid has a reason", () => {
    expect(getCockpitStateBlockReason("blocked_not_paid")).toBeTruthy();
  });

  it("T34 — ready has no reason", () => {
    expect(getCockpitStateBlockReason("ready")).toBeNull();
  });

  it("T35 — degraded has no reason", () => {
    expect(getCockpitStateBlockReason("degraded")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 4 — Budget status
// ══════════════════════════════════════════════════════════════

describe("buildDefaultBudgetStatus", () => {
  it("T36 — default budget is safe (budget_ok=true)", () => {
    const budget = buildDefaultBudgetStatus();
    expect(budget.budget_ok).toBe(true);
  });

  it("T37 — default budget has mock ai_mode", () => {
    const budget = buildDefaultBudgetStatus();
    expect(budget.ai_mode).toBe("mock");
  });

  it("T38 — default budget has shield_active=true", () => {
    const budget = buildDefaultBudgetStatus();
    expect(budget.shield_active).toBe(true);
  });

  it("T39 — default budget has emergency_shutdown=false", () => {
    const budget = buildDefaultBudgetStatus();
    expect(budget.emergency_shutdown).toBe(false);
  });
});

describe("buildBudgetStatusFromAIStatus", () => {
  it("T40 — production mode resolves correctly", () => {
    const raw = { status: { mode: "production", emergency_shutdown: false } };
    const budget = buildBudgetStatusFromAIStatus(raw);
    expect(budget.ai_mode).toBe("production");
  });

  it("T41 — emergency_shutdown=true makes budget_ok=false", () => {
    const raw = { status: { mode: "production", emergency_shutdown: true } };
    const budget = buildBudgetStatusFromAIStatus(raw);
    expect(budget.budget_ok).toBe(false);
    expect(budget.emergency_shutdown).toBe(true);
  });

  it("T42 — daily cap exceeded makes budget_ok=false", () => {
    const raw = { status: { mode: "production", daily_used_cents: 310, daily_cap_cents: 300 } };
    const budget = buildBudgetStatusFromAIStatus(raw);
    expect(budget.budget_ok).toBe(false);
  });

  it("T43 — null input returns default budget", () => {
    const budget = buildBudgetStatusFromAIStatus(null);
    expect(budget.ai_mode).toBe("mock");
    expect(budget.budget_ok).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// GROUP 5 — Warnings and snapshot
// ══════════════════════════════════════════════════════════════

describe("buildSnapshotWarnings", () => {
  it("T44 — mock email mode generates warning", () => {
    const budget = buildDefaultBudgetStatus();
    const modes = buildDefaultRuntimeModes();
    const warnings = buildSnapshotWarnings("ready", budget, modes);
    expect(warnings.some((w) => w.includes("mock"))).toBe(true);
  });

  it("T45 — degraded state generates warning", () => {
    const budget = buildDefaultBudgetStatus();
    const modes = buildDefaultRuntimeModes();
    const warnings = buildSnapshotWarnings("degraded", budget, modes);
    expect(warnings.some((w) => w.includes("dégradé"))).toBe(true);
  });

  it("T46 — emergency shutdown generates warning", () => {
    const budget = { ...buildDefaultBudgetStatus(), emergency_shutdown: true };
    const modes = buildDefaultRuntimeModes();
    const warnings = buildSnapshotWarnings("ready", budget, modes);
    expect(warnings.some((w) => w.includes("Kill switch"))).toBe(true);
  });
});

describe("buildEmptySnapshot", () => {
  it("T47 — empty snapshot has correct tenant", () => {
    const tenant = makeTenant({ company_id: "company_abc" });
    const snapshot = buildEmptySnapshot(tenant, "ready");
    expect(snapshot.tenant.company_id).toBe("company_abc");
  });

  it("T48 — empty snapshot has no missions or tasks", () => {
    const tenant = makeTenant();
    const snapshot = buildEmptySnapshot(tenant, "ready");
    expect(snapshot.missions).toHaveLength(0);
    expect(snapshot.tasks).toHaveLength(0);
    expect(snapshot.deliverables).toHaveLength(0);
    expect(snapshot.validations).toHaveLength(0);
  });

  it("T49 — empty snapshot has generated_at timestamp", () => {
    const tenant = makeTenant();
    const snapshot = buildEmptySnapshot(tenant, "ready");
    expect(snapshot.generated_at).toBeTruthy();
    expect(() => new Date(snapshot.generated_at)).not.toThrow();
  });

  it("T50 — empty snapshot state is preserved", () => {
    const tenant = makeTenant();
    const snapshot = buildEmptySnapshot(tenant, "blocked_not_paid");
    expect(snapshot.state).toBe("blocked_not_paid");
  });
});
