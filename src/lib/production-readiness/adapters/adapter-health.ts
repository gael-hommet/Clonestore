// P-FINAL 01 — Phase 4 — Adapter Health Check.
// Verify all critical adapters are present and marked real.
// Pure: no Supabase, no Next, no async, no throw.

import type { AdapterHealthCheck, AdapterHealthReport } from "./adapter-types";
import {
  ADAPTER_REGISTRY,
  getCriticalAdapters,
  getBlockingAdapters,
} from "./adapter-registry";

export function buildAdapterHealthReport(
  activeMockAdapterIds: string[] = []
): AdapterHealthReport {
  const mockSet = new Set(activeMockAdapterIds);

  const checks: AdapterHealthCheck[] = ADAPTER_REGISTRY.map((adapter) => {
    const is_mock = mockSet.has(adapter.id) || adapter.status === "mock";
    const is_real = !is_mock && adapter.status === "real";
    const is_blocking = is_mock && adapter.blocking_if_mock_in_production;

    return {
      adapter_id: adapter.id,
      is_real,
      is_mock,
      is_blocking,
      reason: is_blocking
        ? `Mock adapter active for critical component: ${adapter.name}`
        : undefined,
    };
  });

  const mock_in_production = checks.filter((c) => c.is_mock).map((c) => c.adapter_id);
  const blocking_adapter_count = checks.filter((c) => c.is_blocking).length;

  const criticalAdapterIds = new Set(getCriticalAdapters().map((a) => a.id));
  const all_critical_real = checks
    .filter((c) => criticalAdapterIds.has(c.adapter_id))
    .every((c) => c.is_real);

  return {
    checks,
    all_critical_real,
    mock_in_production,
    blocking_adapter_count,
    is_production_ready: all_critical_real && blocking_adapter_count === 0,
  };
}

export function isAdapterProductionReady(activeMockAdapterIds: string[] = []): boolean {
  return buildAdapterHealthReport(activeMockAdapterIds).is_production_ready;
}

export function getBlockingAdapterIds(activeMockAdapterIds: string[] = []): string[] {
  const report = buildAdapterHealthReport(activeMockAdapterIds);
  return report.checks.filter((c) => c.is_blocking).map((c) => c.adapter_id);
}

export function getAdapterCoverageSummary(): {
  total: number;
  critical: number;
  has_mock_fallback: number;
  blocking_if_mocked: number;
} {
  return {
    total: ADAPTER_REGISTRY.length,
    critical: getCriticalAdapters().length,
    has_mock_fallback: ADAPTER_REGISTRY.filter((a) => a.has_mock_fallback).length,
    blocking_if_mocked: getBlockingAdapters().length,
  };
}
