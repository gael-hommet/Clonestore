// Type declarations for p89-load-guards.mjs (PHASE 8.9 load harness guards).
export const SYNTHETIC_TENANT_PREFIX: string;
export function isProductionTarget(value: string | null | undefined): boolean;
export function isLocalTarget(value: string | null | undefined): boolean;
export interface BenchEnvOpts { mode?: string; env?: Record<string, string | undefined>; allowRealProviders?: boolean }
export function assertSyntheticBenchEnv(opts: BenchEnvOpts): { ok: true; mode: string; engine: string; providers: string };
export function syntheticTenantId(runId: string, index: number): string;
export function assertSyntheticTenant(name: string | null | undefined): true;
export function percentile(samples: number[], p: number): number;
export function stats(samples: number[]): { n: number; p50: number; p95: number; p99: number; max: number };
