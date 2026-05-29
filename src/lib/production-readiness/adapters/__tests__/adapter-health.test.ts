// P-FINAL 01 — Phase 4 — Tests for adapter health and mock guard.
// All simulate-route: pure functions only, no Supabase, no Next, no async.

import { describe, it, expect } from "vitest";
import {
  ADAPTER_REGISTRY,
  getAllAdapters,
  getCriticalAdapters,
  getAdaptersByCategory,
  getAdapterById,
  getBlockingAdapters,
  getAdaptersByCriticality,
} from "../adapter-registry";
import {
  checkNoMocksInProduction,
  checkMockEnvVars,
  buildProductionEnvSnapshot,
  getMockGuardSummary,
  KNOWN_MOCK_ADAPTER_IDS,
} from "../adapter-mock-guard";
import {
  buildAdapterHealthReport,
  isAdapterProductionReady,
  getBlockingAdapterIds,
  getAdapterCoverageSummary,
} from "../adapter-health";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROD_ENV = buildProductionEnvSnapshot({ NODE_ENV: "production" });
const DEV_ENV = buildProductionEnvSnapshot({ NODE_ENV: "development" });
const PROD_WITH_MOCK_ENV = buildProductionEnvSnapshot({
  NODE_ENV: "production",
  MOCK_SUPABASE: "true",
});

// ── Registry ──────────────────────────────────────────────────────────────────

describe("adapter-registry", () => {
  it("registry is not empty", () => {
    expect(ADAPTER_REGISTRY.length).toBeGreaterThan(0);
  });

  it("all adapter entries have required fields", () => {
    for (const a of ADAPTER_REGISTRY) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.file_path).toBeTruthy();
      expect(a.category).toBeTruthy();
      expect(a.criticality).toBeTruthy();
      expect(a.status).toBeTruthy();
    }
  });

  it("all adapter ids are unique", () => {
    const ids = ADAPTER_REGISTRY.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getCriticalAdapters returns only critical", () => {
    const critical = getCriticalAdapters();
    expect(critical.length).toBeGreaterThan(0);
    for (const a of critical) {
      expect(a.criticality).toBe("critical");
    }
  });

  it("supabase_client adapter exists and is critical", () => {
    const adapter = getAdapterById("supabase_client");
    expect(adapter).toBeDefined();
    expect(adapter!.criticality).toBe("critical");
    expect(adapter!.status).toBe("real");
  });

  it("order_activation adapter exists and blocks if mocked", () => {
    const adapter = getAdapterById("order_activation");
    expect(adapter).toBeDefined();
    expect(adapter!.blocking_if_mock_in_production).toBe(true);
  });

  it("getAdaptersByCategory database returns at least 1", () => {
    const dbAdapters = getAdaptersByCategory("database");
    expect(dbAdapters.length).toBeGreaterThan(0);
  });

  it("getAdaptersByCategory billing returns billing adapters", () => {
    const billing = getAdaptersByCategory("billing");
    expect(billing.length).toBeGreaterThan(0);
    for (const a of billing) {
      expect(a.category).toBe("billing");
    }
  });

  it("getBlockingAdapters all have blocking_if_mock_in_production: true", () => {
    const blocking = getBlockingAdapters();
    for (const a of blocking) {
      expect(a.blocking_if_mock_in_production).toBe(true);
    }
  });

  it("getAdapterById returns undefined for unknown id", () => {
    expect(getAdapterById("nonexistent_adapter")).toBeUndefined();
  });

  it("all real adapters have file_path starting with src/", () => {
    const real = ADAPTER_REGISTRY.filter((a) => a.status === "real");
    for (const a of real) {
      expect(a.file_path).toMatch(/^src\//);
    }
  });

  it("getAdaptersByCriticality important returns important adapters", () => {
    const important = getAdaptersByCriticality("important");
    for (const a of important) {
      expect(a.criticality).toBe("important");
    }
  });
});

// ── Mock Guard ────────────────────────────────────────────────────────────────

describe("adapter-mock-guard", () => {
  it("no mocks in production → blocks_launch: false", () => {
    const result = checkNoMocksInProduction(PROD_ENV, []);
    expect(result.has_mocks).toBe(false);
    expect(result.blocks_launch).toBe(false);
    expect(result.mock_list).toHaveLength(0);
  });

  it("non-blocking mock in production → blocks_launch: false", () => {
    const result = checkNoMocksInProduction(PROD_ENV, ["rgpd_export"]);
    expect(result.has_mocks).toBe(true);
    expect(result.blocks_launch).toBe(false);
  });

  it("blocking mock in production → blocks_launch: true", () => {
    const result = checkNoMocksInProduction(PROD_ENV, ["supabase_client"]);
    expect(result.has_mocks).toBe(true);
    expect(result.blocks_launch).toBe(true);
    expect(result.blocking_mocks).toContain("supabase_client");
  });

  it("blocking mock in dev → blocks_launch: false (not production)", () => {
    const result = checkNoMocksInProduction(DEV_ENV, ["supabase_client"]);
    expect(result.blocks_launch).toBe(false);
  });

  it("checkMockEnvVars: clean env → is_safe: true", () => {
    const result = checkMockEnvVars(PROD_ENV);
    expect(result.is_safe).toBe(true);
    expect(result.mock_env_vars_found).toHaveLength(0);
  });

  it("checkMockEnvVars: MOCK_SUPABASE=true → is_safe: false", () => {
    const result = checkMockEnvVars(PROD_WITH_MOCK_ENV);
    expect(result.is_safe).toBe(false);
    expect(result.mock_env_vars_found).toContain("MOCK_SUPABASE");
  });

  it("getMockGuardSummary: no mocks, production → is_safe_for_production: true", () => {
    const summary = getMockGuardSummary(PROD_ENV, []);
    expect(summary.is_safe_for_production).toBe(true);
    expect(summary.reason).toBeNull();
  });

  it("getMockGuardSummary: blocking mock, production → is_safe_for_production: false", () => {
    const summary = getMockGuardSummary(PROD_ENV, ["supabase_client"]);
    expect(summary.is_safe_for_production).toBe(false);
    expect(summary.reason).toBeTruthy();
  });

  it("getMockGuardSummary: dev env → always safe regardless of mocks", () => {
    const summary = getMockGuardSummary(DEV_ENV, ["supabase_client", "order_activation"]);
    expect(summary.is_safe_for_production).toBe(true);
  });

  it("KNOWN_MOCK_ADAPTER_IDS only contains ids with has_mock_fallback: true", () => {
    const mockFallbackIds = ADAPTER_REGISTRY.filter((a) => a.has_mock_fallback).map((a) => a.id);
    for (const id of KNOWN_MOCK_ADAPTER_IDS) {
      expect(mockFallbackIds).toContain(id);
    }
  });
});

// ── Health Report ─────────────────────────────────────────────────────────────

describe("adapter-health", () => {
  it("no mocks → is_production_ready: true", () => {
    const report = buildAdapterHealthReport([]);
    expect(report.is_production_ready).toBe(true);
    expect(report.all_critical_real).toBe(true);
    expect(report.blocking_adapter_count).toBe(0);
  });

  it("non-blocking mock → is_production_ready: true", () => {
    const report = buildAdapterHealthReport(["rgpd_export"]);
    expect(report.is_production_ready).toBe(true);
    expect(report.mock_in_production).toContain("rgpd_export");
  });

  it("blocking mock → is_production_ready: false", () => {
    const report = buildAdapterHealthReport(["supabase_client"]);
    expect(report.is_production_ready).toBe(false);
    expect(report.blocking_adapter_count).toBeGreaterThan(0);
  });

  it("all_critical_real: false when critical adapter mocked", () => {
    const report = buildAdapterHealthReport(["supabase_auth"]);
    expect(report.all_critical_real).toBe(false);
  });

  it("report checks array has one entry per adapter", () => {
    const report = buildAdapterHealthReport([]);
    expect(report.checks.length).toBe(ADAPTER_REGISTRY.length);
  });

  it("isAdapterProductionReady: true with no mocks", () => {
    expect(isAdapterProductionReady([])).toBe(true);
  });

  it("isAdapterProductionReady: false with blocking mock", () => {
    expect(isAdapterProductionReady(["pierre_core"])).toBe(false);
  });

  it("getBlockingAdapterIds: empty with no mocks", () => {
    expect(getBlockingAdapterIds([])).toHaveLength(0);
  });

  it("getBlockingAdapterIds: returns blocking ids when mocked", () => {
    const blocking = getBlockingAdapterIds(["supabase_client", "rgpd_export"]);
    expect(blocking).toContain("supabase_client");
    expect(blocking).not.toContain("rgpd_export");
  });

  it("getAdapterCoverageSummary returns correct totals", () => {
    const summary = getAdapterCoverageSummary();
    expect(summary.total).toBe(ADAPTER_REGISTRY.length);
    expect(summary.critical).toBe(getCriticalAdapters().length);
    expect(summary.blocking_if_mocked).toBe(getBlockingAdapters().length);
  });

  it("non-blocking adapters in report have is_blocking: false", () => {
    const report = buildAdapterHealthReport([]);
    const nonBlocking = report.checks.filter((c) => !c.is_blocking);
    expect(nonBlocking.length).toBe(ADAPTER_REGISTRY.length);
  });

  it("mock_in_production list matches active mock ids found in registry", () => {
    const report = buildAdapterHealthReport(["rgpd_export", "supabase_client"]);
    expect(report.mock_in_production).toContain("rgpd_export");
    expect(report.mock_in_production).toContain("supabase_client");
  });

  it("checks with is_blocking: true have a reason", () => {
    const report = buildAdapterHealthReport(["supabase_client"]);
    const blockingChecks = report.checks.filter((c) => c.is_blocking);
    for (const c of blockingChecks) {
      expect(c.reason).toBeTruthy();
    }
  });

  it("checks with is_blocking: false have no reason", () => {
    const report = buildAdapterHealthReport([]);
    for (const c of report.checks) {
      expect(c.is_blocking).toBe(false);
      expect(c.reason).toBeUndefined();
    }
  });

  it("multiple blocking mocks → blocking_adapter_count matches", () => {
    const report = buildAdapterHealthReport(["supabase_client", "pierre_core", "order_activation"]);
    expect(report.blocking_adapter_count).toBeGreaterThanOrEqual(3);
  });
});

// ─── Cross-cutting ────────────────────────────────────────────────────────────

describe("cross-cutting adapter invariants", () => {
  it("supabase_auth is auth category", () => {
    const adapter = getAdapterById("supabase_auth");
    expect(adapter!.category).toBe("auth");
  });

  it("ai_cost_tracker is observability category", () => {
    const adapter = getAdapterById("ai_cost_tracker");
    expect(adapter!.category).toBe("observability");
  });

  it("rgpd adapters have has_mock_fallback: true", () => {
    const rgpdExport = getAdapterById("rgpd_export");
    const rgpdPurge = getAdapterById("rgpd_purge");
    expect(rgpdExport!.has_mock_fallback).toBe(true);
    expect(rgpdPurge!.has_mock_fallback).toBe(true);
  });

  it("all critical adapters are blocking_if_mock_in_production", () => {
    const critical = getCriticalAdapters();
    for (const a of critical) {
      expect(a.blocking_if_mock_in_production).toBe(true);
    }
  });

  it("all adapters have at least one used_by entry", () => {
    for (const a of getAllAdapters()) {
      expect(a.used_by.length).toBeGreaterThan(0);
    }
  });
});
