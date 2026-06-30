// src/lib/pierre/v1/live-infrastructure-contract.d.mts
// PHASE 8.7.1 — TYPE declarations for the canonical ESM contract. These are TYPES ONLY (no values, no
// logic): the single runtime definition lives in live-infrastructure-contract.mjs. Consumers (tests) import
// from the .mjs and get these types via this sibling declaration.

export type InfraDomain =
  | "database" | "runtime" | "billing" | "communications" | "signature" | "storage" | "application";

export type InfraStatus =
  | "READY_LIVE" | "READY_SANDBOX"
  | "BLOCKED_MISSING_SECRET" | "BLOCKED_MISSING_ACCOUNT" | "BLOCKED_NETWORK"
  | "BLOCKED_CONFIGURATION" | "BLOCKED_PERMISSION" | "NOT_IMPLEMENTED";

export type EnvPresence = "PRESENT" | "MISSING" | "INVALID_FORMAT" | "REDACTED" | "NOT_REQUIRED";

export type EnvVarSpec = {
  name: string;
  domain: InfraDomain;
  required_for: string;
  environments: Array<"local" | "test" | "staging" | "production">;
  secret: boolean;
  format?: RegExp;
  dependencies?: string[];
  blocks: string;
  aliases?: string[];
  /** the dedicated PostgreSQL role this DSN must bind to (runtime/billing DSNs only). */
  role?: string;
};

export const HTTPS_URL: RegExp;
export const POSTGRES_DSN: RegExp;
export const EMAILISH: RegExp;
export const EXPECTED_PIERRE_PRICE_AMOUNT: number;
export const EXPECTED_PIERRE_CURRENCY: string;
export const ALL_DOMAINS: InfraDomain[];
export const PLACEHOLDER_PATTERNS: RegExp[];
export const LIVE_INFRA_CONTRACT: EnvVarSpec[];
export const LIVE_SMOKE_OPT_INS: Record<"signature" | "communications" | "runtime" | "billing", string[]>;
export const LEGACY_CHECK_MAP: Record<string, { domain: InfraDomain; optIns: string[] }>;

export function looksLikePlaceholder(value: string): boolean;
export function redactSecret(value: string | undefined | null): "REDACTED" | "MISSING";
export function redactError(err: unknown): string;
export function classifyEnv(spec: EnvVarSpec, env: Record<string, string | undefined>, required: boolean): EnvPresence;
export function resolveValue(spec: EnvVarSpec, env: Record<string, string | undefined>): string | undefined;
export function specByName(name: string): EnvVarSpec | null;
export function requireEnv(name: string, env: Record<string, string | undefined>): { ok: boolean; presence: EnvPresence; reason: string | null };
export function envFileOrder(environment: string): string[];
export const YOUSIGN_BASE_URLS: { sandbox: string; live: string };
export function recognizeYousignUrl(url: string | undefined): "sandbox" | "live" | null;
export const EXPECTED_WEBHOOK_ROUTES: Record<"billing" | "communications" | "signature", string>;
export const BUILD_ROUTE_ARTIFACTS: Record<"billing" | "communications" | "signature", string>;
export const WEBHOOK_PATHS: Record<"billing" | "communications" | "signature", string>;
export const STRIPE_REQUIRED_WEBHOOK_EVENTS: string[];
export const RESEND_REQUIRED_WEBHOOK_EVENTS: string[];
export const OPT_IN_SPECS: Record<string, { equals?: string; format?: RegExp }>;
export function evaluateOptIn(name: string, env: Record<string, string | undefined>): { ok: boolean; reason: string | null };
export const FORBIDDEN_ROLE_ATTRS: string[];
export const FORBIDDEN_DIRECT_SELECT: string[];
export const ROLE_PERMISSION_MATRIX: Record<string, { mustExecute: string[] }>;
export function classifyPgError(err: unknown): InfraStatus;
