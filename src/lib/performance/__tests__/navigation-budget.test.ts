// src/lib/performance/__tests__/navigation-budget.test.ts
// B31.6 — Pure unit tests for navigation latency classification.

import { describe, it, expect } from "vitest";
import {
  classifyNavigationLatency,
  assertNavigationBudget,
  assertUiInstant,
  assertCheckoutBudget,
  formatLatency,
  BUDGET_MS,
} from "../navigation-budget";

// ── classifyNavigationLatency ──────────────────────────────────

describe("classifyNavigationLatency", () => {
  it("classifies 0ms as instant", () => {
    expect(classifyNavigationLatency(0)).toBe("instant");
  });

  it("classifies 50ms as instant", () => {
    expect(classifyNavigationLatency(50)).toBe("instant");
  });

  it("classifies 99ms as instant (boundary)", () => {
    expect(classifyNavigationLatency(99)).toBe("instant");
  });

  it("classifies 100ms as acceptable (instant threshold exclusive)", () => {
    expect(classifyNavigationLatency(100)).toBe("acceptable");
  });

  it("classifies 400ms as acceptable", () => {
    expect(classifyNavigationLatency(400)).toBe("acceptable");
  });

  it("classifies 799ms as acceptable (boundary)", () => {
    expect(classifyNavigationLatency(799)).toBe("acceptable");
  });

  it("classifies 800ms as slow (acceptable threshold exclusive)", () => {
    expect(classifyNavigationLatency(800)).toBe("slow");
  });

  it("classifies 1000ms as slow", () => {
    expect(classifyNavigationLatency(1000)).toBe("slow");
  });

  it("classifies 2999ms as slow (boundary below critical)", () => {
    expect(classifyNavigationLatency(2999)).toBe("slow");
  });

  it("classifies 3000ms as critical", () => {
    expect(classifyNavigationLatency(3000)).toBe("critical");
  });

  it("classifies 5000ms as critical", () => {
    expect(classifyNavigationLatency(5000)).toBe("critical");
  });

  it("BUDGET_MS.instant is 100", () => {
    expect(BUDGET_MS.instant).toBe(100);
  });

  it("BUDGET_MS.acceptable is 800", () => {
    expect(BUDGET_MS.acceptable).toBe(800);
  });

  it("BUDGET_MS.critical is 3000", () => {
    expect(BUDGET_MS.critical).toBe(3000);
  });
});

// ── assertNavigationBudget ─────────────────────────────────────

describe("assertNavigationBudget", () => {
  it("returns true for 0ms", () => {
    expect(assertNavigationBudget(0)).toBe(true);
  });

  it("returns true for 2999ms (below critical)", () => {
    expect(assertNavigationBudget(2999)).toBe(true);
  });

  it("returns false for 3000ms (critical threshold)", () => {
    expect(assertNavigationBudget(3000)).toBe(false);
  });

  it("returns false for 5000ms", () => {
    expect(assertNavigationBudget(5000)).toBe(false);
  });
});

// ── assertUiInstant ────────────────────────────────────────────

describe("assertUiInstant", () => {
  it("returns true for 0ms", () => {
    expect(assertUiInstant(0)).toBe(true);
  });

  it("returns true for 99ms (below instant threshold)", () => {
    expect(assertUiInstant(99)).toBe(true);
  });

  it("returns false for 100ms (at instant threshold)", () => {
    expect(assertUiInstant(100)).toBe(false);
  });

  it("returns false for 500ms", () => {
    expect(assertUiInstant(500)).toBe(false);
  });
});

// ── assertCheckoutBudget ───────────────────────────────────────

describe("assertCheckoutBudget", () => {
  it("returns true for 0ms", () => {
    expect(assertCheckoutBudget(0)).toBe(true);
  });

  it("returns true for 799ms (below acceptable threshold)", () => {
    expect(assertCheckoutBudget(799)).toBe(true);
  });

  it("returns false for 800ms (at acceptable threshold)", () => {
    expect(assertCheckoutBudget(800)).toBe(false);
  });

  it("returns false for 2000ms", () => {
    expect(assertCheckoutBudget(2000)).toBe(false);
  });
});

// ── formatLatency ──────────────────────────────────────────────

describe("formatLatency", () => {
  it("formats 0ms as '0ms'", () => {
    expect(formatLatency(0)).toBe("0ms");
  });

  it("formats 50ms as '50ms'", () => {
    expect(formatLatency(50)).toBe("50ms");
  });

  it("formats 999ms as '999ms'", () => {
    expect(formatLatency(999)).toBe("999ms");
  });

  it("formats 1000ms as '1.00s'", () => {
    expect(formatLatency(1000)).toBe("1.00s");
  });

  it("formats 1500ms as '1.50s'", () => {
    expect(formatLatency(1500)).toBe("1.50s");
  });

  it("formats 3000ms as '3.00s'", () => {
    expect(formatLatency(3000)).toBe("3.00s");
  });

  it("result ends with 'ms' for sub-second values", () => {
    expect(formatLatency(750).endsWith("ms")).toBe(true);
  });

  it("result ends with 's' for second+ values", () => {
    expect(formatLatency(2500).endsWith("s")).toBe(true);
  });
});
