// Types for live-external-providers-check.mjs (P8.7.3 read-only external-providers verifier).
export const STRIPE_REQUIRED_EVENTS: string[];

export interface ProviderDomainStatus {
  status: "READY_LIVE" | "READY_SANDBOX" | "BLOCKED_MISSING_SECRET" | "BLOCKED_CONFIGURATION" | "BLOCKED_PERMISSION" | string;
  detail: string;
}

export interface ExternalProvidersReport {
  phase: string;
  generated_at: string;
  domains: Record<string, ProviderDomainStatus>;
  ready: boolean;
  blockers: Array<{ area: string; status: string; reason: string }>;
}

export interface FetchJsonResult { status: number; ok: boolean; json: any }

export interface ExternalProvidersDeps {
  env?: Record<string, string | undefined>;
  fetchJson?: (url: string, init?: { headers?: Record<string, string>; method?: string; body?: string }) => Promise<FetchJsonResult>;
  readProof?: () => any;
  now?: string | null;
}

export function runExternalProvidersCheck(deps: ExternalProvidersDeps): Promise<ExternalProvidersReport>;
