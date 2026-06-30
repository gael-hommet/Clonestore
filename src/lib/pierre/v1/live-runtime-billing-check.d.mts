// src/lib/pierre/v1/live-runtime-billing-check.d.mts
import type { InfraStatus } from "./live-infrastructure-contract.mjs";

export type PgClient = { query(sql: string, params?: readonly unknown[]): Promise<{ rows: any[] }>; end(): Promise<void> };
export type RuntimeBillingDeps = {
  env: Record<string, string | undefined>;
  probe?: boolean;
  pgConnect?: (dsn: string) => Promise<PgClient>;
  now?: string;
};
export type RuntimeBillingReport = {
  phase: "P8.7.2";
  generated_at: string;
  roles: Record<string, { status: InfraStatus; detail?: string }>;
  proof: Record<"runtime" | "billing" | "isolation", { status: InfraStatus; detail?: string }>;
  ready: boolean;
  blockers: Array<{ area: string; status: InfraStatus; reason: string }>;
};
export function runRuntimeBillingCheck(deps: RuntimeBillingDeps): Promise<RuntimeBillingReport>;
