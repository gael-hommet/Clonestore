// src/lib/pierre/v1/live-infrastructure-preflight.d.mts
import type { InfraStatus, EnvPresence } from "./live-infrastructure-contract.mjs";

export type PreflightCheck = { name: string; presence?: EnvPresence; status: InfraStatus; detail?: string };
export type DomainResult = { status: InfraStatus; checks: PreflightCheck[] };
export type PreflightReport = {
  phase: "P8.7.1";
  generated_at: string;
  environment: string;
  env_files_loaded: number;
  domains: Record<string, DomainResult>;
  legacy_checks: Record<string, { status: InfraStatus; reason: string; required_actions: string[] }>;
  ready_for_p87_2: boolean;
  blockers: Array<{ domain: string; status: InfraStatus; reason: string }>;
};

export type PgClient = { query(sql: string, params?: readonly unknown[]): Promise<{ rows: any[] }>; end(): Promise<void> };
export type PreflightDeps = {
  env: Record<string, string | undefined>;
  probe?: boolean;
  httpGet?: (url: string, headers: Record<string, string>) => Promise<{ ok: boolean; status: number; body: any }>;
  pgConnect?: (dsn: string) => Promise<PgClient>;
  dnsResolveTxt?: (host: string) => Promise<string[][] | string[]>;
  webhookRoute?: (domain: "billing" | "communications" | "signature") => "build" | "src_only" | "absent";
  environment?: string;
  env_files_loaded?: number;
  now?: string;
};

export function runPreflight(deps: PreflightDeps): Promise<PreflightReport>;

export type LoadEnvDeps = {
  cwd?: string;
  processEnv?: Record<string, string | undefined>;
  readFile?: (path: string) => string | null;
  fileExists?: (path: string) => boolean;
  join?: (a: string, b: string) => string;
};
export function loadEnvironment(environment: string, deps?: LoadEnvDeps): { env: Record<string, string | undefined>; loadedFiles: string[]; sourceMap: Record<string, "process" | "env_file"> };
