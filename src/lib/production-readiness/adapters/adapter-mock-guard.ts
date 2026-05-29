// P-FINAL 01 — Phase 4 — Mock Guard.
// Verify that no mock adapters are active in production.
// Pure: no Supabase, no Next, no async, no throw.

import type { MockGuardResult } from "./adapter-types";
import { ADAPTER_REGISTRY, getBlockingAdapters } from "./adapter-registry";

// Known mock adapter ids — adapters that have a mock_fallback or could be mocked
export const KNOWN_MOCK_ADAPTER_IDS: string[] = ADAPTER_REGISTRY.filter(
  (a) => a.has_mock_fallback
).map((a) => a.id);

// Known environment variable patterns that indicate mock/test mode
export const MOCK_ENV_INDICATORS = [
  "MOCK_SUPABASE",
  "MOCK_STRIPE",
  "MOCK_AI",
  "MOCK_EMAIL",
  "USE_MOCK_ADAPTERS",
  "FORCE_MOCK",
  "TEST_MODE",
] as const;

export interface EnvSnapshot {
  is_production: boolean;
  env_vars: Record<string, string | undefined>;
  node_env?: string;
}

export function checkNoMocksInProduction(
  env: EnvSnapshot,
  activeMockAdapterIds: string[]
): MockGuardResult {
  const blockingAdapterIds = new Set(getBlockingAdapters().map((a) => a.id));

  const blocking_mocks = activeMockAdapterIds.filter((id) => blockingAdapterIds.has(id));
  const has_mocks = activeMockAdapterIds.length > 0;
  const blocks_launch = env.is_production && blocking_mocks.length > 0;

  return {
    has_mocks,
    mock_list: activeMockAdapterIds,
    blocks_launch,
    blocking_mocks,
  };
}

export function checkMockEnvVars(env: EnvSnapshot): {
  mock_env_vars_found: string[];
  is_safe: boolean;
} {
  const mock_env_vars_found = MOCK_ENV_INDICATORS.filter((indicator) => {
    const value = env.env_vars[indicator];
    return value === "true" || value === "1";
  });

  return {
    mock_env_vars_found,
    is_safe: mock_env_vars_found.length === 0,
  };
}

export function buildProductionEnvSnapshot(envVars: Record<string, string | undefined>): EnvSnapshot {
  return {
    is_production: envVars["NODE_ENV"] === "production",
    env_vars: envVars,
    node_env: envVars["NODE_ENV"],
  };
}

export function getMockGuardSummary(
  env: EnvSnapshot,
  activeMockAdapterIds: string[]
): {
  is_safe_for_production: boolean;
  reason: string | null;
} {
  if (!env.is_production) {
    return { is_safe_for_production: true, reason: null };
  }

  const result = checkNoMocksInProduction(env, activeMockAdapterIds);
  const envCheck = checkMockEnvVars(env);

  if (result.blocks_launch) {
    return {
      is_safe_for_production: false,
      reason: `Mock adapters active in production: ${result.blocking_mocks.join(", ")}`,
    };
  }

  if (!envCheck.is_safe) {
    return {
      is_safe_for_production: false,
      reason: `Mock env vars set in production: ${envCheck.mock_env_vars_found.join(", ")}`,
    };
  }

  return { is_safe_for_production: true, reason: null };
}
