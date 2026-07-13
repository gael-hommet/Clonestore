// Declarations for e1-2-preflight-core.mjs (the repo has allowJs:false, so the typed
// modules need this to see the shared core). Kept deliberately narrow: only what the
// typed command center and the tests consume.

export type MigrationState =
  | "NOT_APPLIED"
  | "PARTIALLY_APPLIED"
  | "FULLY_APPLIED"
  | "INCOMPATIBLE_EXISTING_STATE"
  | "UNVERIFIABLE";

export type CompatibilityState =
  | "REMOTE_SCHEMA_COMPATIBLE"
  | "REMOTE_SCHEMA_INCOMPLETE"
  | "REMOTE_SCHEMA_DRIFTED"
  | "REMOTE_SCHEMA_UNVERIFIABLE";

export type HistoryState =
  | "ENTRY_PRESENT"
  | "ENTRY_ABSENT_LEDGER_EXISTS"
  | "NO_LEDGER_FOR_THIS_MIGRATION"
  | "CONFLICTING_ENTRY"
  | "UNVERIFIABLE";

export type TargetCategory =
  | "absent"
  | "unparseable"
  | "local"
  | "managed_supabase_remote"
  | "managed_remote"
  | "unknown_remote";

/** UNVERIFIABLE is a first-class value: never coerce an unknown into a boolean. */
export type Tri = boolean | "UNVERIFIABLE";

export interface Blocker {
  code: string;
  detail: string;
  [k: string]: unknown;
}

export interface Classification {
  state: MigrationState;
  reasons: string[];
  blockers: Blocker[];
  detail: Record<string, unknown> | null;
  remoteExecutionPossible?: boolean;
}

export interface DriftResult {
  driftDetected: boolean;
  signals: { code: string; detail: string }[];
}

export interface E12Evidence {
  e11LocallyReconciled?: boolean;
  repositoryStable?: boolean;
  readOnlyAuthorizationReceived?: boolean;
  remoteConnectionAttempted?: boolean;
  remoteConnectionSucceeded?: boolean;
  remoteReadOnlyEnforced?: boolean;
  remoteTargetCategory?: TargetCategory;
  productionSuspected?: boolean;
  p941LocalMigrationPresent?: boolean;
  partnerPayoutMigrationPresent?: boolean;
  p941?: Classification;
  partner?: Classification;
  p941HistoryState?: HistoryState;
  partnerHistoryState?: HistoryState;
  drift941?: DriftResult;
  driftPartner?: DriftResult;
}

export interface E12CommandCenter {
  phase: "E1.2";
  e11LocallyReconciled: boolean;
  repositoryStable: boolean;
  readOnlyAuthorizationReceived: boolean;
  remoteConnectionAttempted: boolean;
  remoteConnectionSucceeded: boolean;
  remoteReadOnlyEnforced: boolean;
  customerRowsRead: 0;
  mutationsExecuted: 0;
  migrationsApplied: 0;
  remoteTargetCategory: TargetCategory;
  productionSuspected: boolean;
  p941LocalMigrationPresent: boolean;
  p941RemoteState: MigrationState;
  p941HistoryState: HistoryState;
  p941ObjectState: MigrationState;
  clonechatAppRoleExists: Tri;
  clonechatAppRoleLeastPrivilege: Tri;
  clonechatAppRoleBypassesRls: Tri;
  clonechatDurableTablesReady: Tri;
  clonechatDurableFunctionsReady: Tri;
  clonechatRlsReady: Tri;
  clonechatGrantsReady: Tri;
  partnerPayoutMigrationPresent: boolean;
  partnerPayoutRemoteState: MigrationState;
  partnerPayoutHistoryState: HistoryState;
  partnerPayoutObjectState: MigrationState;
  partnerPayoutConstraintsReady: Tri;
  partnerPayoutTestLiveSeparationReady: Tri;
  partnerPayoutRemoteExecutionEnabled: false;
  remoteSchemaCompatibility: CompatibilityState;
  remoteDriftDetected: Tri;
  backupRequired: Tri;
  migrationApplicationRequired: Tri;
  repairMigrationRequired: Tri;
  deploymentStillBlocked: true;
  productionAuthorized: false;
  paymentMode: "disabled";
  partnerPayoutLiveAuthorized: false;
  remoteDatabaseMutated: false;
  deploymentPerformed: false;
  exactWarnings: string[];
  exactBlockers: string[];
  nextSafeAction: string;
  verdict: string;
}

export interface SqlViolation {
  layer: number;
  code: string;
  detail: string;
}

export interface RegistryEntry {
  id: string;
  purpose: string;
  sql: string;
  category: string;
  mutationRisk: "none";
  customerRowRisk: "none";
  allowedSchemas: string[];
  expectedShape: string;
}

export declare const AUTHORIZATION_SENTENCE: string;
export declare const ALLOWED_ACTION: string;
export declare const AUTHORIZATION_TTL_MS: number;
export declare const MIGRATION_AUTHORIZATION_SENTENCE: string;
export declare const MIGRATION_ALLOWED_ACTION: string;
export declare const EXPECTED_TARGET_FINGERPRINT: string;
export declare const P941_MIGRATION_PATH: string;
export declare const P941_MIGRATION_SHA256: string;

export interface E13Postcheck {
  verdict: string;
  ok?: boolean;
  p941State?: MigrationState;
  partnerState?: MigrationState;
  compatibility?: CompatibilityState;
  roleBypassesRls?: boolean | null;
  dangerousExtensions?: string[];
}

export interface E13Evidence {
  e12RemoteStateVerified?: boolean;
  repositoryStable?: boolean;
  targetFingerprintMatched?: boolean;
  migrationFilePresent?: boolean;
  migrationChecksumMatched?: boolean;
  migrationTransactional?: boolean;
  backupConfirmed?: boolean;
  rollbackRunbookReady?: boolean;
  ownerMigrationAuthorizationReceived?: boolean;
  productionSuspected?: boolean;
  migrationConnectionAttempted?: boolean;
  migrationTransactionStarted?: boolean;
  migrationSqlExecuted?: boolean;
  migrationSqlExecutionCount?: number;
  inTransactionAssertionsPassed?: boolean;
  migrationCommitted?: boolean;
  migrationRolledBack?: boolean;
  p941RemoteStateBefore?: MigrationState;
  partnerPayoutStateBefore?: MigrationState;
  postcheck?: E13Postcheck | null;
  failure?: string | null;
  assertionBlockers?: string[];
}

export interface E13CommandCenter {
  phase: "E1.3";
  e12RemoteStateVerified: boolean;
  repositoryStable: boolean;
  targetFingerprintMatched: boolean;
  migrationFilePresent: boolean;
  migrationChecksumMatched: boolean;
  migrationTransactional: boolean;
  backupConfirmed: boolean;
  rollbackRunbookReady: boolean;
  ownerMigrationAuthorizationReceived: boolean;
  migrationConnectionAttempted: boolean;
  migrationTransactionStarted: boolean;
  migrationSqlExecuted: boolean;
  migrationSqlExecutionCount: number;
  inTransactionAssertionsPassed: boolean;
  migrationCommitted: boolean;
  migrationRolledBack: boolean;
  migrationsApplied: 0 | 1;
  p941RemoteStateBefore: MigrationState;
  p941RemoteStateAfter: MigrationState;
  clonechatAppRoleReady: boolean;
  clonechatAppRoleBypassesRls: boolean;
  clonechatDurableTablesReady: boolean;
  clonechatDurableFunctionsReady: boolean;
  clonechatRlsReady: boolean;
  clonechatGrantsReady: boolean;
  partnerPayoutStateBefore: MigrationState;
  partnerPayoutStateAfter: MigrationState;
  unrelatedSchemaPreserved: boolean;
  postMigrationReadOnlyVerificationComplete: boolean;
  remoteSchemaCompatibility: CompatibilityState;
  customerRowsRead: 0;
  liveProviderCalls: 0;
  productionAuthorized: false;
  paymentMode: "disabled";
  partnerPayoutLiveAuthorized: false;
  deploymentPerformed: false;
  remoteDatabaseMutated: boolean;
  exactMutationPerformed: "NONE" | "P9.4.1_CANONICAL_MIGRATION_ONLY";
  exactWarnings: string[];
  exactBlockers: string[];
  nextSafeAction: string;
  verdict: string;
}

export declare function deriveE13CommandCenter(ev: E13Evidence): E13CommandCenter;
export declare const MIGRATION_STATES: readonly MigrationState[];
export declare const COMPATIBILITY_STATES: readonly CompatibilityState[];
export declare const HISTORY_STATES: readonly HistoryState[];
export declare const ALLOWED_STATEMENT_TYPES: string[];
export declare const ALLOWED_RELATIONS: Set<string>;
export declare const QUERY_REGISTRY: Readonly<Record<string, RegistryEntry>>;
export declare const SESSION_SAFETY: {
  statementTimeoutMs: number;
  lockTimeoutMs: number;
  idleInTransactionTimeoutMs: number;
  searchPath: string;
  statements: { id: string; sql: string }[];
  rollback: { id: string; sql: string };
};
export declare const P941_CANONICAL: Record<string, never> | any;
export declare const P941_ALL_TABLES: string[];
export declare const PARTNER_PAYOUT_CANONICAL: any;

export declare function validateSql(sql: string): { ok: boolean; violations: SqlViolation[] };
export declare function statementType(sql: string): string;
export declare function extractRelations(sql: string): string[];
export declare function isCustomerRelation(rel: string): boolean;
export declare function auditRegistry(): {
  ok: boolean;
  results: { id: string; ok: boolean; violations: SqlViolation[]; statementType: string; relations: string[] }[];
  registeredQueryCount: number;
};
export declare function resolveRegisteredQuery(id: string): RegistryEntry;
export declare function verifySessionSafety(row: Record<string, unknown> | null): {
  ok: boolean;
  failures: { code: string; observed?: unknown }[];
  observed: Record<string, unknown> | null;
};
export declare function parseTimeoutMs(v: unknown): number | null;
export declare function detectLeaks(
  output: unknown,
  parts?: Record<string, string | undefined>,
): { clean: boolean; found: { kind: string; id: string }[] };
export declare function sanitizeError(e: unknown): {
  sanitized: true;
  code: string;
  meaning: string;
  messageIncluded: false;
};
export declare function classifyTarget(dsn: string): TargetCategory;
export declare function isProductionSuspected(category: TargetCategory): boolean;
export declare function buildAuthorization(input: {
  sessionId: string;
  nowMs: number;
  sentence?: string;
  sentenceSha256?: string;
}): { ok: boolean; reason?: string; authorization?: Record<string, unknown> };
export declare function validateAuthorization(
  auth: Record<string, unknown> | null,
  ctx: { sessionId: string; nowMs: number; action?: string },
): { ok: boolean; failures: { code: string; detail?: string }[] };
export declare function classifyP941(ev: Record<string, unknown>): Classification;
export declare function classifyPartnerPayout(ev: Record<string, unknown>): Classification;
export declare function reconcileHistory(input: Record<string, unknown>): { state: HistoryState; reason: string; [k: string]: unknown };
export declare function detectDrift(input: { objectState: MigrationState; historyState: HistoryState }): DriftResult;
export declare function evaluateCompatibility(input: {
  p941: Classification;
  partner: Classification;
  connected?: boolean;
  safetyOk?: boolean;
}): CompatibilityState;
export declare function deriveE12CommandCenter(ev: E12Evidence): E12CommandCenter;
