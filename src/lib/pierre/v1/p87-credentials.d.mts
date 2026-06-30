// src/lib/pierre/v1/p87-credentials.d.mts
export const ROLE_DSN_VARS: Array<[string, string]>;
export const SYSTEM_SECRET_VARS: string[];
export function generateRolePassword(randomBytes?: (n: number) => Buffer): string;
export function generateSystemSecret(randomBytes?: (n: number) => Buffer): string;
export function buildRoleDsn(adminDsn: string, role: string, password: string): string;
export type CredentialBundle = {
  values: Record<string, string>;
  manifest: { phase: string; environment: string; generated_at: string | null; entries: Array<{ variable: string; role: string | null; kind: string; tls?: string; status: "REDACTED" }> };
};
export function buildCredentialBundle(adminDsn: string, opts?: { randomBytes?: (n: number) => Buffer; environment?: string; now?: string }): CredentialBundle;
export function renderEnvFragment(values: Record<string, string>): string;
