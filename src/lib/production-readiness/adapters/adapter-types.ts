// P-FINAL 01 — Phase 4 — Adapter types.
// Pure types only. No imports, no side effects.

export type AdapterStatus = "real" | "mock" | "partial" | "unknown";
export type AdapterCriticality = "critical" | "important" | "optional";
export type AdapterCategory =
  | "database"
  | "billing"
  | "auth"
  | "ai"
  | "email"
  | "storage"
  | "observability";

export interface AdapterDefinition {
  id: string;
  name: string;
  file_path: string;
  category: AdapterCategory;
  criticality: AdapterCriticality;
  status: AdapterStatus;
  has_mock_fallback: boolean;
  description: string;
  blocking_if_mock_in_production: boolean;
  used_by: string[];
}

export interface AdapterHealthCheck {
  adapter_id: string;
  is_real: boolean;
  is_mock: boolean;
  is_blocking: boolean;
  reason?: string;
}

export interface AdapterHealthReport {
  checks: AdapterHealthCheck[];
  all_critical_real: boolean;
  mock_in_production: string[];
  blocking_adapter_count: number;
  is_production_ready: boolean;
}

export interface MockGuardResult {
  has_mocks: boolean;
  mock_list: string[];
  blocks_launch: boolean;
  blocking_mocks: string[];
}
