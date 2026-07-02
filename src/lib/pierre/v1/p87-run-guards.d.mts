// Type declarations for p87-run-guards.mjs (PHASE 8.7.4 remediation guards).

export interface BaseUrlAssertOpts { expectedHosts?: string[]; requireExpectedHost?: boolean }
export interface BaseUrlResult { origin: string; host: string; https: true }
export function assertProductionBaseUrl(rawUrl: string | null | undefined, opts?: BaseUrlAssertOpts): BaseUrlResult;

export interface SecureLinkPreflightInput { base: string | null | undefined; secret: string | null | undefined; expectedHosts?: string[]; requireExpectedHost?: boolean }
export interface SecureLinkPreflightResult { ok: boolean; host_is_production: true; host: string; secret_present: true; token_length: number; token_never_logged: true; token_transmitted: false }
export function previewSecureLinkPreflight(input: SecureLinkPreflightInput): SecureLinkPreflightResult;

export interface RunLockRecord { run_id: string; pid: number; status: string; acquired_at: number; updated_at?: number }
export interface AcquireLockOpts { runId: string; pid: number; ttlMs?: number; now?: number }
export interface AcquiredLock extends RunLockRecord { lockPath: string; reclaimed: boolean; reclaimed_from?: { run_id: string | null; status: string | null; reason: string } }
export function readRunLock(lockPath: string): RunLockRecord | null;
export function acquireSingleRunLock(lockPath: string, opts: AcquireLockOpts): AcquiredLock;
export function updateRunLockStatus(lockPath: string, status: string, opts?: { now?: number }): RunLockRecord | null;
export function releaseSingleRunLock(lockPath: string, opts?: { status?: string; now?: number }): RunLockRecord | null;
export function clearRunLock(lockPath: string, opts?: { force?: boolean }): boolean;

export interface RealEmailBudget { charge(context?: string): number; count(): number; assertExactlyOne(): boolean }
export function makeRealEmailBudget(max?: number): RealEmailBudget;

export const MAX_JOURNEY_MS: number;
export interface GlobalDeadline { start: number; deadline: number; budgetMs: number; remainingMs(): number; expired(): boolean; assertAlive(stage?: string): void; clampWaitMs(requestedMs: number): number }
export function makeGlobalDeadline(ms?: number, opts?: { nowFn?: () => number }): GlobalDeadline;

export function safeCorrelationAnchor(prefix: string, raw: string): string;
