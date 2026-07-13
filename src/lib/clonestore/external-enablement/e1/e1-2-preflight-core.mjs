// src/lib/clonestore/external-enablement/e1/e1-2-preflight-core.mjs
//
// E1.2 — CANONICAL read-only remote-preflight CORE.
//
// This is THE single implementation. Both the runner (scripts/e1-2-remote-state-preflight.mjs)
// and the vitest suite import THIS module: the SQL that is tested is the SQL that runs.
// It supersedes scripts/e1-1-clonechat-remote-preflight.mjs (kept only as E1.1 evidence).
//
// PURE: no fs, no network, no pg. It cannot mutate anything. It only:
//   - declares what the two canonical migrations SHOULD produce,
//   - declares the ONLY queries that may ever be sent (a registry, not free SQL),
//   - validates those queries structurally (statement type + token scan + relation allowlist),
//   - declares the read-only session safety contract,
//   - guards output against credential leaks,
//   - classifies remote state from METADATA ONLY,
//   - derives the command center from evidence (never from hardcoded green values).
//
// It is written as .mjs (with a sibling .d.mts) because the repo has no tsx/ts-node:
// a plain-ESM core is the only way for the runner AND the typed modules to share one
// source of truth instead of duplicating the SQL.

// ─────────────────────────────────────────────────────────────────────────────
// 0. Constants
// ─────────────────────────────────────────────────────────────────────────────

export const AUTHORIZATION_SENTENCE = "I AUTHORIZE READ-ONLY REMOTE DATABASE PREFLIGHT";
export const ALLOWED_ACTION = "READ_ONLY_REMOTE_PREFLIGHT";
export const AUTHORIZATION_TTL_MS = 15 * 60 * 1000; // short-lived, single-use

// ── E1.3 (migration application) — distinct sentence + action, never interchangeable ─
export const MIGRATION_AUTHORIZATION_SENTENCE = "I AUTHORIZE P9.4.1 REMOTE MIGRATION APPLICATION";
export const MIGRATION_ALLOWED_ACTION = "APPLY_P941_REMOTE_MIGRATION";
export const EXPECTED_TARGET_FINGERPRINT = "c049738d18e8"; // verified in E1.2
export const P941_MIGRATION_PATH = "supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql";
export const P941_MIGRATION_SHA256 = "4a879e8cbfa260e8bebdbef5203213f3086015b3a8c77c8748c2b7325d15dc7b";

/** Migration state classes (§11). */
export const MIGRATION_STATES = /** @type {const} */ ([
  "NOT_APPLIED",
  "PARTIALLY_APPLIED",
  "FULLY_APPLIED",
  "INCOMPATIBLE_EXISTING_STATE",
  "UNVERIFIABLE",
]);

/** Compatibility classes (§ deployment). */
export const COMPATIBILITY_STATES = /** @type {const} */ ([
  "REMOTE_SCHEMA_COMPATIBLE",
  "REMOTE_SCHEMA_INCOMPLETE",
  "REMOTE_SCHEMA_DRIFTED",
  "REMOTE_SCHEMA_UNVERIFIABLE",
]);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Canonical expectations — derived from the migration files, not from hope
//    supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql
// ─────────────────────────────────────────────────────────────────────────────

const T = (name, columns, extras = {}) => ({ name, columns, ...extras });

export const P941_CANONICAL = {
  migrationId: "P9.4.1",
  localFile: "supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql",
  role: {
    name: "clonechat_app",
    // The migration creates it NOLOGIN. Everything else must be off.
    mustBe: { rolcanlogin: false, rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false },
  },
  // Tenant tables carry company_id and MUST be isolated by the app.current_company GUC.
  tenantTables: [
    "clonechat_conversations",
    "clonechat_messages",
    "clonechat_bug_occurrences",
    "clonechat_support_cases",
    "clonechat_proposals",
    "clonechat_commands",
  ],
  // Global neutralized tables (no tenant PII by design) — RLS still enabled+forced.
  globalTables: ["clonechat_bug_cases", "clonechat_budget_counters", "clonechat_usage_events", "clonechat_action_executions"],
  tables: [
    T("clonechat_conversations", {
      id: "uuid", company_id: "uuid", user_id: "uuid", title: "text", rolling_summary: "text",
      created_at: "timestamp with time zone", updated_at: "timestamp with time zone",
      last_activity_at: "timestamp with time zone", archived_at: "timestamp with time zone",
    }, { notNull: ["id", "company_id", "user_id", "title", "created_at", "updated_at", "last_activity_at"], indexes: ["cc_conv_company_user_idx"] }),
    T("clonechat_messages", {
      id: "uuid", conversation_id: "uuid", company_id: "uuid", user_id: "uuid", seq: "bigint", role: "text",
      content: "jsonb", source_ids: "ARRAY", action_proposal: "jsonb", action_result: "jsonb",
      usage: "jsonb", image_meta: "jsonb", created_at: "timestamp with time zone",
    }, { notNull: ["id", "conversation_id", "company_id", "user_id", "seq", "role", "content", "source_ids", "created_at"],
         indexes: ["cc_msg_conv_seq_idx", "cc_msg_company_idx"], uniqueIndexes: ["cc_msg_conv_seq_idx"],
         foreignKeys: [{ column: "conversation_id", references: "clonechat_conversations" }] }),
    T("clonechat_bug_occurrences", {
      id: "uuid", fingerprint: "text", company_id: "uuid", user_id: "uuid", route: "text",
      release_channel: "text", redacted_symptom: "text", evidence: "jsonb", created_at: "timestamp with time zone",
    }, { notNull: ["id", "fingerprint", "company_id", "redacted_symptom", "evidence", "created_at"], indexes: ["cc_bugocc_company_idx", "cc_bugocc_fp_idx"] }),
    T("clonechat_support_cases", {
      id: "uuid", company_id: "uuid", user_id: "uuid", fingerprint: "text", title: "text", status: "text",
      severity: "text", redacted_summary: "text", evidence: "jsonb",
      created_at: "timestamp with time zone", updated_at: "timestamp with time zone",
    }, { notNull: ["id", "company_id", "user_id", "title", "status", "severity", "redacted_summary", "evidence", "created_at", "updated_at"],
         indexes: ["cc_case_company_idx", "cc_case_fp_idx"], uniqueIndexes: ["cc_case_fp_idx"] }),
    T("clonechat_bug_cases", {
      fingerprint: "text", title: "text", symptoms: "ARRAY", workaround: "text", solution: "text", status: "text",
      reusable: "boolean", occurrences: "integer", evidence: "jsonb", verified_by: "text",
      verified_at: "timestamp with time zone", version: "integer",
      first_seen_at: "timestamp with time zone", last_seen_at: "timestamp with time zone",
    }, { notNull: ["fingerprint", "title", "symptoms", "status", "reusable", "occurrences", "evidence", "version", "first_seen_at", "last_seen_at"] }),
    T("clonechat_action_executions", {
      fingerprint: "text", company_id: "uuid", user_id: "uuid", kind: "text", status: "text", result: "jsonb",
      created_at: "timestamp with time zone", updated_at: "timestamp with time zone",
    }, { notNull: ["fingerprint", "kind", "status", "created_at", "updated_at"], indexes: ["cc_exec_company_idx"] }),
    T("clonechat_proposals", {
      id: "uuid", company_id: "uuid", user_id: "uuid", conversation_id: "uuid", action_kind: "text",
      payload: "jsonb", created_at: "timestamp with time zone",
    }, { notNull: ["id", "company_id", "user_id", "action_kind", "payload", "created_at"], indexes: ["cc_prop_company_idx"] }),
    T("clonechat_commands", {
      id: "uuid", fingerprint: "text", company_id: "uuid", actor_id: "uuid", conversation_id: "uuid",
      proposal_id: "uuid", action_kind: "text", payload_sha256: "text", target_ref: "text", status: "text",
      attempt_count: "integer", lease_owner: "text", lease_expiry: "timestamp with time zone",
      result: "jsonb", recovery: "jsonb", created_at: "timestamp with time zone", updated_at: "timestamp with time zone",
    }, { notNull: ["id", "fingerprint", "company_id", "actor_id", "action_kind", "payload_sha256", "status", "attempt_count", "created_at", "updated_at"],
         indexes: ["cc_cmd_company_idx", "cc_cmd_lease_idx"],
         // fingerprint UNIQUE = the durable exactly-once command identity (P9.4.2)
         uniqueColumns: ["fingerprint"] }),
    T("clonechat_budget_counters", {
      scope_key: "text", window_kind: "text", committed_tokens: "bigint", reserved_tokens: "bigint",
      updated_at: "timestamp with time zone",
    }, { notNull: ["scope_key", "window_kind", "committed_tokens", "reserved_tokens", "updated_at"] }),
    T("clonechat_usage_events", {
      id: "uuid", company_id: "uuid", user_id: "uuid", model: "text", input_tokens: "integer",
      output_tokens: "integer", cached_tokens: "integer", kind: "text", at: "timestamp with time zone",
    }, { notNull: ["id", "model", "input_tokens", "output_tokens", "cached_tokens", "kind", "at"], indexes: ["cc_usage_at_idx"] }),
  ],
  // All three are plpgsql and SECURITY INVOKER (no `security definer` in the migration).
  functions: [
    { name: "clonechat_budget_try_reserve", args: "text[], text[], bigint[], bigint", mustNotBeSecurityDefiner: true },
    { name: "clonechat_budget_commit", args: "text[], bigint, bigint", mustNotBeSecurityDefiner: true },
    { name: "clonechat_budget_release", args: "text[], bigint", mustNotBeSecurityDefiner: true },
  ],
  policies: {
    // cc_iso_<table> on every tenant table, scoped by the company GUC.
    tenantPolicyPrefix: "cc_iso_",
    tenantPolicyMustReference: ["company_id", "app.current_company"],
    globalPolicies: {
      clonechat_bug_cases: ["cc_bugcases_read", "cc_bugcases_write"],
      clonechat_budget_counters: ["cc_budget_all"],
      clonechat_usage_events: ["cc_usage_all"],
      clonechat_action_executions: ["cc_exec_all"],
    },
  },
  grants: {
    role: "clonechat_app",
    tablePrivileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
    functionPrivileges: ["EXECUTE"],
    // Any grant to clonechat_app on a relation OUTSIDE this prefix is a hard blocker.
    perimeterPrefix: "clonechat_",
  },
};

export const P941_ALL_TABLES = P941_CANONICAL.tables.map((t) => t.name);

// ─────────────────────────────────────────────────────────────────────────────
//    supabase/migrations/2026-07-11_05__clonestore_pp_payout_automation.sql
//    NOTE: this migration is ADDITIVE over the finance base (2026-07-10_02).
//    The idempotency + test/live guarantees live in the BASE and must both hold.
// ─────────────────────────────────────────────────────────────────────────────

export const PARTNER_PAYOUT_CANONICAL = {
  migrationId: "CLONESTORE_PP_PAYOUT_AUTOMATION (2026-07-11_05)",
  localFile: "supabase/migrations/2026-07-11_05__clonestore_pp_payout_automation.sql",
  // Tables the migration ALTERs — all must pre-exist (from _01/_02/_03).
  baseTables: [
    "clonestore_pp_partners",
    "clonestore_pp_transfers",
    "clonestore_pp_payout_runs",
    "clonestore_pp_transfer_items",
    "clonestore_pp_commission_entries",
    "clonestore_pp_email_outbox",
  ],
  // Tables that HOST a canonical addedIndex but are only INDEXED (never ALTERed) by this
  // migration. They must be included in the objects.tables/objects.indexes scan or the
  // classifier can never observe their indexes and would report FALSE PARTIALLY_APPLIED
  // against a fully-applied database. (Lines 70-71 of the migration index these.)
  indexHostTables: ["clonestore_pp_attributions", "clonestore_pp_referral_touches"],
  // Columns THIS migration adds. Absent ⇒ NOT applied (or partially).
  addedColumns: {
    clonestore_pp_transfers: ["batch_hash", "attempts", "last_attempt_at", "required_action"],
    clonestore_pp_commission_entries: ["available_notified_at"],
    clonestore_pp_partners: ["stripe_details_submitted", "stripe_requirements_due", "stripe_disabled_reason", "last_payout_at"],
  },
  addedIndexes: [
    "uq_pp_transfer_partner_period", // partial UNIQUE — one LIVE transfer per (partner, period)
    "idx_pp_transfer_needs_attention",
    "idx_pp_entry_available_pool",
    "idx_pp_entry_partner_status",
    "idx_pp_attr_partner_status",
    "idx_pp_touch_partner",
    "idx_pp_partner_status_country",
  ],
  // The new status vocabulary must be in the transfers CHECK constraint.
  transferStatusesRequired: ["pending", "transferred", "failed_retryable", "failed_permanent", "reconciliation_required"],
  emailKindsRequired: ["connect_ready", "payout_blocked"],
  // ── Guarantees that must hold REGARDLESS of this migration (from the base) ──
  idempotency: {
    // run-key uniqueness: one payout run per logical key
    runKeyUnique: { table: "clonestore_pp_payout_runs", column: "run_key" },
    // one transfer per (partner, period) idempotency key
    transferIdempotencyUnique: { table: "clonestore_pp_transfers", column: "idempotency_key" },
    // a commission entry can belong to only ONE live batch (anti double-payment)
    singleLiveBatchIndex: { index: "uq_pp_item_entry_live", table: "clonestore_pp_transfer_items" },
    // one LIVE transfer per (partner, period) — this migration DROPs the base index and
    // RECREATEs it with a WIDER status predicate. The name pre-exists in the base with a
    // narrower predicate, so a name-only check cannot tell applied from not-applied: the
    // recreated index MUST carry the new statuses in its definition.
    singleLiveTransferIndex: {
      index: "uq_pp_transfer_partner_period",
      table: "clonestore_pp_transfers",
      predicateMustInclude: ["reconciliation_required", "failed_retryable"],
    },
  },
  testLiveSeparation: {
    // stripe_mode exists on both money tables, defaults to 'test', constrained to test|live.
    columns: [
      { table: "clonestore_pp_transfers", column: "stripe_mode", requiredDefault: "test", allowed: ["test", "live"] },
      { table: "clonestore_pp_commission_entries", column: "stripe_mode", requiredDefault: "test", allowed: ["test", "live"] },
    ],
    // A payout run must default to a DRY RUN — never to a real one.
    dryRunDefaultTrue: { table: "clonestore_pp_payout_runs", column: "dry_run" },
  },
  // Extensions that would make a DB-side Stripe call / remote cron possible at all.
  dangerousExtensions: ["pg_cron", "pg_net", "http"],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Statement validation — three INDEPENDENT layers, never substring-only
// ─────────────────────────────────────────────────────────────────────────────

/** Statement types this tool may ever emit. Anything else is refused. */
export const ALLOWED_STATEMENT_TYPES = ["select", "set", "begin", "rollback", "show"];

/** Word-boundary forbidden tokens (layer 2). */
const FORBIDDEN_TOKENS = [
  "create", "alter", "drop", "grant", "revoke", "insert", "update", "delete", "truncate",
  "merge", "copy", "vacuum", "analyze", "refresh", "call", "do", "comment", "reindex",
  "cluster", "listen", "notify", "prepare", "execute", "declare", "fetch", "move",
  "import", "reassign", "security",
];
/** Multi-word / structural forbidden forms (layer 2b). */
const FORBIDDEN_PATTERNS = [
  { id: "select_into", re: /\bselect\b[\s\S]*?\binto\b/i },
  { id: "create_temp", re: /\bcreate\s+(global\s+|local\s+)?temp(orary)?\b/i },
  { id: "lock_table", re: /\block\s+table\b/i },
  { id: "for_update", re: /\bfor\s+(update|no\s+key\s+update|share)\b/i },
  { id: "set_role", re: /\bset\s+role\b/i },
  { id: "set_session_authorization", re: /\bset\s+session\s+authorization\b/i },
  { id: "pg_read_file", re: /\bpg_read_(file|binary_file)\b/i },
  { id: "dblink", re: /\bdblink\b/i },
  { id: "pg_sleep", re: /\bpg_sleep\b/i },
];

/** Relations this tool may read (layer 3 allowlist). Metadata + migration history ONLY. */
export const ALLOWED_RELATIONS = new Set([
  // pg_catalog
  "pg_roles", "pg_class", "pg_namespace", "pg_proc", "pg_constraint", "pg_index", "pg_indexes",
  "pg_attribute", "pg_policies", "pg_trigger", "pg_auth_members", "pg_extension", "pg_language",
  "pg_type", "pg_stat_ssl", "pg_settings", "pg_tables", "pg_attrdef",
  // information_schema
  "information_schema.columns", "information_schema.role_table_grants",
  "information_schema.role_routine_grants", "information_schema.role_usage_grants",
  "information_schema.table_constraints",
  // migration history (explicitly allowed metadata — filenames/checksums, no customer content)
  "public.pierre_rt_schema_migrations", "supabase_migrations.schema_migrations",
]);

/**
 * Relations that hold BUSINESS/CUSTOMER rows. Reading rows from these is forbidden
 * outright — a second, independent guard (defense in depth) even if someone were to
 * add one of them to ALLOWED_RELATIONS by mistake.
 * `pierre_rt_schema_migrations` is deliberately exempt: it is a migration ledger.
 */
export function isCustomerRelation(rel) {
  const r = String(rel).toLowerCase();
  if (r === "public.pierre_rt_schema_migrations" || r === "pierre_rt_schema_migrations") return false;
  return (
    /^(public\.)?clonechat_/.test(r) ||
    /^(public\.)?clonestore_/.test(r) ||
    /^(public\.)?pierre_rt_/.test(r) ||
    /^auth\./.test(r) ||
    /^storage\./.test(r) ||
    /^vault\./.test(r) ||
    /^(public\.)?(users|customers|profiles)$/.test(r)
  );
}

/**
 * Extract every relation a statement reads — including comma-joined FROM items
 * (`from a, b, c`), which a naive `\bfrom\s+(\w+)` regex misses entirely. Over-extraction
 * is deliberately safe here: an extra token can only cause a stricter refusal, never a
 * looser acceptance. Parameters ($1) are values, never relations — by design.
 */
export function extractRelations(sql) {
  const out = new Set();
  // Accept an optional double-quoted identifier on each part: `"clonechat_messages"`,
  // `public."clonechat_messages"`. Quotes are stripped from the captured value below.
  const IDENT = '"?[a-zA-Z_][\\w$]*"?(?:\\."?[a-zA-Z_][\\w$]*"?)?';
  const unquote = (s) => s.replace(/"/g, "").toLowerCase();
  const NOISE = new Set(["select", "lateral", "unnest", "only", "as", "on", "using"]);
  // Anything that ends a FROM-list and starts a new clause.
  const STOP = /^(where|group|order|having|limit|offset|union|intersect|except|join|inner|left|right|full|cross|on|using|returning|window|for|fetch)$/i;

  // 1. the relation immediately after each FROM / JOIN
  const anchor = new RegExp(`\\b(?:from|join)\\s+(?:only\\s+|lateral\\s+)?(${IDENT})`, "gi");
  let m;
  while ((m = anchor.exec(sql)) !== null) {
    const rel = unquote(m[1]);
    if (!NOISE.has(rel)) out.add(rel);

    // 2. walk the comma-separated FROM-list that follows this FROM anchor
    if (/from$/i.test(sql.slice(m.index, m.index + m[0].length - m[1].length).trim())) {
      let rest = sql.slice(anchor.lastIndex);
      // skip an optional alias on the FIRST relation (`from t c, ...` / `from t as c, ...`)
      // before looking for the comma-list; a leading alias must not hide the next item.
      rest = rest.replace(/^\s*(as\s+)?(?!,)[a-zA-Z_][\w$]*(?=\s*,)/i, "");
      // consume `, <ident>` items until a clause keyword or an open paren (subquery/func)
      const listRe = new RegExp(`^\\s*,\\s*(?:only\\s+|lateral\\s+)?(${IDENT})`, "i");
      // Only continue while the immediate token sequence is comma-separated relations.
      // Guard against runaway with a bounded loop.
      for (let i = 0; i < 64; i++) {
        const lm = rest.match(listRe);
        if (!lm) break;
        const rel2 = unquote(lm[1]);
        if (STOP.test(rel2) || NOISE.has(rel2)) break;
        out.add(rel2);
        rest = rest.slice(lm[0].length);
        // skip an optional alias (`b x` / `b as x`) before the next comma
        rest = rest.replace(/^\s*(as\s+)?[a-zA-Z_][\w$]*/i, "");
      }
    }
  }
  return [...out];
}

export function statementType(sql) {
  const s = String(sql).trim().replace(/^\(+/, "").toLowerCase();
  const m = s.match(/^([a-z_]+)/);
  return m ? m[1] : "";
}

/**
 * Structural validation. Returns {ok, violations[]}.
 * Layer 1: statement type allowlist.
 * Layer 2: forbidden token scan (word boundaries) + forbidden structural patterns.
 * Layer 3: relation allowlist + customer-relation denylist.
 * Layer 4: no statement stacking, no string interpolation (only $n binding).
 */
export function validateSql(sql) {
  const violations = [];
  const raw = String(sql);
  // ORDER MATTERS. Strip block comments first (they can also be used as token separators:
  // `from/**/clonechat_messages`). Then strip STRING LITERALS *before* line comments, so a
  // `--` that lives inside a literal (e.g. `'a--b'`) can no longer blank out the rest of the
  // line and smuggle a stacked mutation past the scanners. A `--` block comment that opens a
  // real line comment is still removed afterwards.
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, " ");

  const type = statementType(stripped);
  if (!ALLOWED_STATEMENT_TYPES.includes(type)) violations.push({ layer: 1, code: "STATEMENT_TYPE_NOT_ALLOWED", detail: type || "(empty)" });

  for (const tok of FORBIDDEN_TOKENS) {
    // `analyze`/`do`/`security` etc. must match as standalone words only
    const re = new RegExp(`(^|[^\\w.])${tok}([^\\w]|$)`, "i");
    if (re.test(stripped)) violations.push({ layer: 2, code: "FORBIDDEN_TOKEN", detail: tok });
  }
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.re.test(stripped)) violations.push({ layer: 2, code: "FORBIDDEN_PATTERN", detail: p.id });
  }

  for (const rel of extractRelations(stripped)) {
    if (isCustomerRelation(rel)) violations.push({ layer: 3, code: "CUSTOMER_RELATION", detail: rel });
    else if (!ALLOWED_RELATIONS.has(rel)) violations.push({ layer: 3, code: "RELATION_NOT_ALLOWED", detail: rel });
  }

  // statement stacking (a trailing `;` is fine, an inner one is not)
  if (/;\s*\S/.test(stripped)) violations.push({ layer: 4, code: "STATEMENT_STACKING", detail: "multiple statements" });
  // interpolation markers other than $n binding
  if (/\$\{|%s|\+\s*['"]/.test(raw)) violations.push({ layer: 4, code: "STRING_INTERPOLATION", detail: "use $n binding" });

  return { ok: violations.length === 0, violations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Session safety contract (§7)
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_SAFETY = {
  statementTimeoutMs: 5000,
  lockTimeoutMs: 2000,
  idleInTransactionTimeoutMs: 10000,
  searchPath: "pg_catalog, information_schema",
  statements: [
    { id: "safety.read_only_session", sql: "set session characteristics as transaction read only" },
    { id: "safety.statement_timeout", sql: "set statement_timeout = 5000" },
    { id: "safety.lock_timeout", sql: "set lock_timeout = 2000" },
    { id: "safety.idle_in_transaction_timeout", sql: "set idle_in_transaction_session_timeout = 10000" },
    { id: "safety.search_path", sql: "set search_path = pg_catalog, information_schema" },
    { id: "safety.begin_read_only", sql: "begin read only" },
  ],
  rollback: { id: "safety.rollback", sql: "rollback" },
};

/** Assert the session REALLY is what we asked for. Fail closed. */
export function verifySessionSafety(row) {
  const failures = [];
  if (!row) return { ok: false, failures: [{ code: "NO_SAFETY_ROW" }], observed: null };
  const readOnly = String(row.transaction_read_only ?? "").toLowerCase();
  if (readOnly !== "on") failures.push({ code: "TRANSACTION_NOT_READ_ONLY", observed: readOnly });

  const sp = String(row.search_path ?? "").replace(/\s|"/g, "").toLowerCase();
  if (sp !== "pg_catalog,information_schema") failures.push({ code: "SEARCH_PATH_NOT_SAFE", observed: sp });

  const st = parseTimeoutMs(row.statement_timeout);
  if (st === null || st <= 0 || st > 30000) failures.push({ code: "STATEMENT_TIMEOUT_NOT_ACTIVE", observed: String(row.statement_timeout) });

  const lt = parseTimeoutMs(row.lock_timeout);
  if (lt === null || lt <= 0 || lt > 30000) failures.push({ code: "LOCK_TIMEOUT_NOT_ACTIVE", observed: String(row.lock_timeout) });

  const it = parseTimeoutMs(row.idle_in_transaction_session_timeout);
  if (it === null || it <= 0 || it > 60000) failures.push({ code: "IDLE_TIMEOUT_NOT_ACTIVE", observed: String(row.idle_in_transaction_session_timeout) });

  return {
    ok: failures.length === 0,
    failures,
    observed: { transactionReadOnly: readOnly === "on", searchPath: sp, statementTimeoutMs: st, lockTimeoutMs: lt, idleInTransactionTimeoutMs: it },
  };
}

/** '5s' | '5000ms' | '5000' → ms. Postgres reports these in several shapes. */
export function parseTimeoutMs(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "" || s === "0") return 0;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(ms|s|min)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] || "ms";
  return unit === "s" ? n * 1000 : unit === "min" ? n * 60000 : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Query registry — the ONLY SQL that may ever leave this process
// ─────────────────────────────────────────────────────────────────────────────

const Q = (id, purpose, sql, expectedShape) => ({
  id,
  purpose,
  sql,
  category: "metadata",
  mutationRisk: "none",
  customerRowRisk: "none",
  allowedSchemas: ["pg_catalog", "information_schema", "public(migration-ledger only)", "supabase_migrations"],
  expectedShape,
});

export const QUERY_REGISTRY = Object.freeze({
  // ── session identity & safety ──────────────────────────────────────────────
  "safety.verify": Q(
    "safety.verify",
    "Prove the session is read-only, timed-out and search-path-pinned BEFORE any inspection",
    `select current_setting('transaction_read_only') as transaction_read_only,
            current_setting('search_path') as search_path,
            current_setting('statement_timeout') as statement_timeout,
            current_setting('lock_timeout') as lock_timeout,
            current_setting('idle_in_transaction_session_timeout') as idle_in_transaction_session_timeout`,
    "1 row",
  ),
  "target.version": Q("target.version", "PostgreSQL major version (target truth §8)",
    `select current_setting('server_version_num') as server_version_num`, "1 row"),
  "target.current_role": Q("target.current_role", "Current-role privilege CATEGORY (never the username's credentials)",
    `select current_user as role_name,
            (select rolsuper from pg_roles where rolname = current_user) as rolsuper,
            (select rolbypassrls from pg_roles where rolname = current_user) as rolbypassrls,
            (select rolcreaterole from pg_roles where rolname = current_user) as rolcreaterole`, "1 row"),
  "target.ssl": Q("target.ssl", "SSL category of this backend connection",
    `select ssl from pg_stat_ssl where pid = pg_backend_pid()`, "0..1 row"),
  "target.extensions": Q("target.extensions", "Installed extensions — decides whether DB-side cron/HTTP is even POSSIBLE",
    `select extname from pg_extension order by extname`, "N rows"),

  // ── migration history (the REAL mechanism, not an assumed one) ─────────────
  "history.ledger_present": Q("history.ledger_present", "Does the pierre_rt_schema_migrations ledger exist at all?",
    `select to_regclass('public.pierre_rt_schema_migrations') is not null as present,
            to_regclass('supabase_migrations.schema_migrations') is not null as supabase_cli_present`, "1 row"),
  "history.pierre_ledger": Q("history.pierre_ledger", "Migration ledger entries (filename + checksum — metadata, no customer content)",
    `select filename, checksum from public.pierre_rt_schema_migrations order by filename`, "N rows"),
  "history.supabase_cli": Q("history.supabase_cli", "Supabase CLI migration history, if that mechanism is in use",
    `select version, name from supabase_migrations.schema_migrations order by version`, "N rows"),

  // ── P9.4.1 ─────────────────────────────────────────────────────────────────
  "precheck.p941_absent": Q("precheck.p941_absent", "Quick pre-mutation recheck that P9.4.1 is still absent (role + a canonical table)",
    `select (to_regclass('public.clonechat_conversations') is not null) as any_table,
            exists (select 1 from pg_roles where rolname = 'clonechat_app') as role_exists`, "1 row"),
  "p941.role": Q("p941.role", "clonechat_app role attributes (§5A)",
    `select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolinherit
       from pg_roles where rolname = $1`, "0..1 row"),
  "p941.role_memberships": Q("p941.role_memberships", "Roles that clonechat_app is a member of (privilege inheritance)",
    `select r.rolname as member, g.rolname as granted_role
       from pg_auth_members m
       join pg_roles r on r.oid = m.member
       join pg_roles g on g.oid = m.roleid
      where r.rolname = $1`, "N rows"),
  "objects.tables": Q("objects.tables", "Table existence, owner, RLS enabled/forced (§5B/5C)",
    `select c.relname, n.nspname, pg_get_userbyid(c.relowner) as owner,
            c.relrowsecurity, c.relforcerowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname = 'public' and c.relname = any($1::text[])
      order by c.relname`, "N rows"),
  "objects.columns": Q("objects.columns", "Columns: type, nullability, default, identity (§5B)",
    `select table_name, column_name, data_type, is_nullable, column_default, is_identity, is_generated
       from information_schema.columns
      where table_schema = 'public' and table_name = any($1::text[])
      order by table_name, ordinal_position`, "N rows"),
  "objects.constraints": Q("objects.constraints", "PK / UNIQUE / FK / CHECK definitions (§5B)",
    `select c.relname as table_name, con.conname, con.contype, pg_get_constraintdef(con.oid) as definition
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any($1::text[])
      order by c.relname, con.conname`, "N rows"),
  "objects.indexes": Q("objects.indexes", "Index definitions incl. UNIQUE and partial predicates (§5B)",
    `select tablename as table_name, indexname, indexdef
       from pg_indexes
      where schemaname = 'public' and tablename = any($1::text[])
      order by tablename, indexname`, "N rows"),
  "objects.policies": Q("objects.policies", "RLS policy expressions — USING and WITH CHECK (§5C)",
    `select tablename as table_name, policyname, permissive, roles, cmd, qual, with_check
       from pg_policies
      where schemaname = 'public' and tablename = any($1::text[])
      order by tablename, policyname`, "N rows"),
  "objects.triggers": Q("objects.triggers", "Triggers — proves nothing DB-side auto-initiates a transfer (§10)",
    `select c.relname as table_name, t.tgname, p.proname as function_name, t.tgenabled
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_proc p on p.oid = t.tgfoid
      where n.nspname = 'public' and c.relname = any($1::text[]) and not t.tgisinternal
      order by c.relname, t.tgname`, "N rows"),
  "objects.functions": Q("objects.functions", "Function signature, SECURITY DEFINER, proconfig/search_path, owner (§5E)",
    `select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef,
            p.provolatile, l.lanname as language, p.proconfig, pg_get_userbyid(p.proowner) as owner
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and p.proname = any($1::text[])
      order by p.proname`, "N rows"),
  "objects.functions_like": Q("objects.functions_like", "Partner-program functions by prefix — proves none is an unexpected SECURITY DEFINER (§10)",
    `select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef,
            p.provolatile, l.lanname as language, p.proconfig, pg_get_userbyid(p.proowner) as owner
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and p.proname like $1
      order by p.proname`, "N rows"),
  "grants.tables": Q("grants.tables", "Table privileges held by a role (§5D) — the perimeter check",
    `select table_schema, table_name, privilege_type
       from information_schema.role_table_grants
      where grantee = $1
      order by table_schema, table_name, privilege_type`, "N rows"),
  "grants.routines": Q("grants.routines", "EXECUTE privileges held by a role (§5D)",
    `select routine_schema, routine_name, privilege_type
       from information_schema.role_routine_grants
      where grantee = $1
      order by routine_schema, routine_name`, "N rows"),
  "grants.schema_usage": Q("grants.schema_usage", "Schema USAGE for a role (metadata-safe built-in); null when the role is absent",
    `select n.nspname,
            case when exists (select 1 from pg_roles where rolname = $1)
                 then has_schema_privilege($1, n.nspname, 'USAGE')
                 else null end as has_usage
       from pg_namespace n
      where n.nspname in ('public', 'information_schema')
      order by n.nspname`, "N rows"),
});

/** Every registered query is validated at MODULE LOAD — a bad query cannot even be defined. */
export function auditRegistry() {
  const results = [];
  for (const [id, entry] of Object.entries(QUERY_REGISTRY)) {
    const v = validateSql(entry.sql);
    results.push({ id, ok: v.ok, violations: v.violations, statementType: statementType(entry.sql), relations: extractRelations(entry.sql) });
  }
  for (const s of SESSION_SAFETY.statements.concat([SESSION_SAFETY.rollback])) {
    const v = validateSql(s.sql);
    results.push({ id: s.id, ok: v.ok, violations: v.violations, statementType: statementType(s.sql), relations: [] });
  }
  return { ok: results.every((r) => r.ok), results, registeredQueryCount: Object.keys(QUERY_REGISTRY).length };
}

/** The ONLY execution entry point. Takes an ID — never SQL. Arbitrary SQL is unrepresentable. */
export function resolveRegisteredQuery(id) {
  const entry = QUERY_REGISTRY[id];
  if (!entry) throw new Error(`E1.2: query "${String(id)}" is not in the registry — refused.`);
  const v = validateSql(entry.sql);
  if (!v.ok) throw new Error(`E1.2: registered query "${id}" failed structural validation — refused.`);
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Leak prevention (§8)
// ─────────────────────────────────────────────────────────────────────────────

const SECRET_PATTERNS = [
  { id: "postgres_dsn", re: /postgres(ql)?:\/\/[^\s"']+/i },
  { id: "stripe_secret", re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{6,}/ },
  { id: "stripe_webhook", re: /\bwhsec_[A-Za-z0-9]{6,}/ },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { id: "supabase_url", re: /https?:\/\/[a-z0-9-]+\.supabase\.(co|com|net)/i },
  { id: "openai_key", re: /\bsk-[A-Za-z0-9]{20,}/ },
  { id: "bearer", re: /\bBearer\s+[A-Za-z0-9._-]{12,}/i },
];

/**
 * Values that identify nothing on their own. A managed Supabase DSN's database is
 * literally `postgres`; treating that as a secret would make the guard cry wolf on every
 * run (and the word appears in our own finding ids). The USERNAME is NOT exempt — on
 * Supabase it embeds the project ref, which is identifying.
 */
const NON_IDENTIFYING_VALUES = new Set(["postgres", "public", "supabase", "database", "user", "root", "admin", "localhost"]);

/**
 * Scan any output for secrets. `parts` = the sensitive substrings we know about
 * (dsn, host, user, password, database) — each is checked INDEPENDENTLY, not merely as
 * one whole DSN (the E1.1 tool only ever compared the whole DSN, so a leaked username
 * or host would have slipped straight through).
 */
export function detectLeaks(output, parts = {}) {
  const text = typeof output === "string" ? output : JSON.stringify(output ?? "");
  const found = [];
  for (const p of SECRET_PATTERNS) if (p.re.test(text)) found.push({ kind: "pattern", id: p.id });
  // Credentials (user/password) are high-value and may be SHORT — Postgres imposes no minimum
  // password length. They are checked down to 3 chars. Structural parts (dsn/host/database)
  // are long by nature, so a 6-char floor there just avoids matching common words.
  const CREDENTIAL_KEYS = new Set(["user", "password", "passwordRaw", "userRaw"]);
  for (const [key, value] of Object.entries(parts)) {
    if (!value) continue;
    const v = String(value);
    if (key === "port") continue; // a port number is not a secret
    const minLen = CREDENTIAL_KEYS.has(key) ? 3 : 6;
    if (v.length < minLen) continue;
    if (NON_IDENTIFYING_VALUES.has(v.toLowerCase())) continue;
    if (text.includes(v)) found.push({ kind: "substring", id: key });
  }
  return { clean: found.length === 0, found };
}

/** Never surface driver messages: they routinely embed host, port, user and database. */
export function sanitizeError(e) {
  const code = e && typeof e === "object" && "code" in e ? String(e.code ?? "") : "";
  const known = {
    ECONNREFUSED: "connection refused",
    ENOTFOUND: "host not resolvable",
    ETIMEDOUT: "connection timed out",
    "28P01": "authentication failed",
    "28000": "invalid authorization specification",
    "3D000": "database does not exist",
    "42501": "insufficient privilege",
    "57014": "statement timeout",
    "55P03": "lock not available",
  };
  return {
    sanitized: true,
    code: code || "unknown",
    meaning: known[code] ?? "unclassified driver error",
    messageIncluded: false, // we NEVER include error.message
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Target classification (§8) — no connection required
// ─────────────────────────────────────────────────────────────────────────────

export function classifyTarget(dsn) {
  if (!dsn) return "absent";
  let host = "";
  try {
    host = new URL(dsn).hostname.toLowerCase();
  } catch {
    return "unparseable";
  }
  if (/^(localhost|127\.0\.0\.1|::1|host\.docker\.internal)$/.test(host)) return "local";
  if (/supabase\.(co|com|net)$/.test(host)) return "managed_supabase_remote";
  if (/\.(neon|render|railway|rds\.amazonaws|azure|googleapis)\./.test(host)) return "managed_remote";
  return "unknown_remote";
}

export function isProductionSuspected(category) {
  return category !== "local" && category !== "absent" && category !== "unparseable";
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Authorization contract (§5) — file-based, short-lived, single-use.
//    Deliberately NOT an env var: an env var can silently persist across sessions.
// ─────────────────────────────────────────────────────────────────────────────

export function buildAuthorization({ sessionId, nowMs, sentence, sentenceSha256 }) {
  if (sentence !== undefined && sentence !== AUTHORIZATION_SENTENCE) {
    return { ok: false, reason: "SENTENCE_MISMATCH" };
  }
  return {
    ok: true,
    authorization: {
      version: 1,
      sessionId,
      allowedAction: ALLOWED_ACTION,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + AUTHORIZATION_TTL_MS,
      consumedAtMs: null,
      sentenceSha256: sentenceSha256 ?? null, // proof of the exact sentence; never a credential
    },
  };
}

export function validateAuthorization(auth, { sessionId, nowMs, action = ALLOWED_ACTION }) {
  const failures = [];
  if (!auth || typeof auth !== "object") return { ok: false, failures: [{ code: "AUTHORIZATION_ABSENT" }] };
  if (auth.allowedAction !== action) failures.push({ code: "ACTION_MISMATCH", detail: String(auth.allowedAction) });
  if (auth.sessionId !== sessionId) failures.push({ code: "SESSION_MISMATCH" });
  if (typeof auth.expiresAtMs !== "number" || nowMs > auth.expiresAtMs) failures.push({ code: "AUTHORIZATION_EXPIRED" });
  if (auth.consumedAtMs !== null && auth.consumedAtMs !== undefined) failures.push({ code: "AUTHORIZATION_ALREADY_CONSUMED" });
  return { ok: failures.length === 0, failures };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Classification (§11) — from METADATA ONLY, never from a file's existence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param ev {{connected:boolean, safetyOk:boolean, role:object|null, memberships:array,
 *            tables:array, columns:array, constraints:array, indexes:array, policies:array,
 *            functions:array, tableGrants:array, routineGrants:array, history:object}}
 */
export function classifyP941(ev) {
  const reasons = [];
  const blockers = [];
  if (!ev || !ev.connected || !ev.safetyOk) {
    return { state: "UNVERIFIABLE", reasons: ["no authorized read-only connection was established"], blockers: [], detail: null };
  }
  // An inspection that did not RUN TO COMPLETION cannot yield a definite classification —
  // partial evidence would read as "some objects missing" when they were simply never
  // queried. Fail closed to UNVERIFIABLE. (undefined = the pure-function tests, which pass
  // fully-formed evidence; only an explicit false from the runner's catch path trips this.)
  if (ev.inspectionComplete === false) {
    return { state: "UNVERIFIABLE", reasons: ["metadata inspection did not run to completion — classification would be based on partial evidence"], blockers: [], detail: null };
  }

  // Scope EVERY table-shaped check to the P9.4.1 perimeter. ev.tables also contains the
  // partner-program base tables (the runner sweeps both perimeters in one query), so an
  // unscoped RLS/count check would blame a partner-table gap on P9.4.1.
  const p941TableRows = (ev.tables ?? []).filter((t) => P941_ALL_TABLES.includes(t.relname));
  const tablesFound = p941TableRows.map((t) => t.relname);
  const missingTables = P941_ALL_TABLES.filter((t) => !tablesFound.includes(t));
  const roleExists = Boolean(ev.role);

  // ── NOT_APPLIED: nothing of this migration exists ────────────────────────
  if (!roleExists && tablesFound.length === 0 && (ev.functions ?? []).length === 0) {
    return {
      state: "NOT_APPLIED",
      reasons: ["role clonechat_app absent", "0 of 10 canonical clonechat_* tables present", "0 canonical budget functions present"],
      blockers: [],
      detail: { tablesFound: 0, tablesExpected: P941_ALL_TABLES.length, roleExists: false },
    };
  }

  // ── Safety violations ⇒ INCOMPATIBLE (takes precedence over PARTIAL) ─────
  if (roleExists) {
    const r = ev.role;
    if (r.rolbypassrls) blockers.push({ code: "ROLE_BYPASSES_RLS", detail: "clonechat_app has BYPASSRLS — tenant isolation is circumventable" });
    if (r.rolsuper) blockers.push({ code: "ROLE_IS_SUPERUSER", detail: "clonechat_app is SUPERUSER" });
    if (r.rolcanlogin) blockers.push({ code: "ROLE_CAN_LOGIN", detail: "clonechat_app has LOGIN (canonical is NOLOGIN)" });
    if (r.rolcreatedb) blockers.push({ code: "ROLE_CAN_CREATEDB", detail: "clonechat_app has CREATEDB" });
    if (r.rolcreaterole) blockers.push({ code: "ROLE_CAN_CREATEROLE", detail: "clonechat_app has CREATEROLE" });
    if (r.rolreplication) blockers.push({ code: "ROLE_CAN_REPLICATE", detail: "clonechat_app has REPLICATION" });
  }

  // Grants outside the clonechat_ perimeter are a hard blocker.
  const outsidePerimeter = (ev.tableGrants ?? [])
    .filter((g) => !String(g.table_name).startsWith(P941_CANONICAL.grants.perimeterPrefix))
    .map((g) => `${g.table_schema}.${g.table_name}`);
  const uniqueOutside = [...new Set(outsidePerimeter)];
  if (uniqueOutside.length > 0) {
    blockers.push({ code: "GRANTS_OUTSIDE_PERIMETER", detail: `clonechat_app holds rights on ${uniqueOutside.length} relation(s) outside clonechat_*`, relations: uniqueOutside });
  }

  // RLS must be enabled AND forced on every present canonical table — P9.4.1 tables ONLY.
  const rlsMissing = p941TableRows.filter((t) => !t.relrowsecurity).map((t) => t.relname);
  const rlsNotForced = p941TableRows.filter((t) => t.relrowsecurity && !t.relforcerowsecurity).map((t) => t.relname);
  if (rlsMissing.length > 0) blockers.push({ code: "RLS_NOT_ENABLED", detail: `${rlsMissing.length} table(s) without RLS`, tables: rlsMissing });
  if (rlsNotForced.length > 0) blockers.push({ code: "RLS_NOT_FORCED", detail: `${rlsNotForced.length} table(s) with RLS not FORCED`, tables: rlsNotForced });

  // SECURITY DEFINER on a canonical function is an escalation we never asked for.
  const secDef = (ev.functions ?? []).filter((f) => f.prosecdef).map((f) => f.proname);
  if (secDef.length > 0) blockers.push({ code: "UNSAFE_SECURITY_DEFINER", detail: `${secDef.length} canonical function(s) are SECURITY DEFINER`, functions: secDef });

  // Tenant policies must actually scope by company + the GUC.
  const tenantPolicyProblems = [];
  for (const t of P941_CANONICAL.tenantTables) {
    if (!tablesFound.includes(t)) continue;
    const pols = (ev.policies ?? []).filter((p) => p.table_name === t);
    if (pols.length === 0) {
      tenantPolicyProblems.push({ table: t, problem: "NO_POLICY" });
      continue;
    }
    const scoped = pols.some((p) => {
      const expr = `${p.qual ?? ""} ${p.with_check ?? ""}`.toLowerCase();
      return P941_CANONICAL.policies.tenantPolicyMustReference.every((needle) => expr.includes(needle.toLowerCase()));
    });
    const permissiveGlobal = pols.some((p) => {
      const expr = String(p.qual ?? "").trim().toLowerCase();
      return expr === "true" && String(p.cmd ?? "").toLowerCase() === "all";
    });
    if (!scoped) tenantPolicyProblems.push({ table: t, problem: "POLICY_NOT_TENANT_SCOPED" });
    if (permissiveGlobal) tenantPolicyProblems.push({ table: t, problem: "PERMISSIVE_POLICY_GRANTS_GLOBAL_ACCESS" });
  }
  if (tenantPolicyProblems.length > 0) {
    blockers.push({ code: "TENANT_POLICY_UNSAFE", detail: `${tenantPolicyProblems.length} tenant policy problem(s)`, problems: tenantPolicyProblems });
  }

  // Deep object completeness: columns / indexes / unique constraints.
  const colsByTable = new Map();
  for (const c of ev.columns ?? []) {
    if (!colsByTable.has(c.table_name)) colsByTable.set(c.table_name, new Map());
    colsByTable.get(c.table_name).set(c.column_name, c);
  }
  const idxByTable = new Map();
  for (const i of ev.indexes ?? []) {
    if (!idxByTable.has(i.table_name)) idxByTable.set(i.table_name, []);
    idxByTable.get(i.table_name).push(i);
  }
  const objectGaps = [];
  for (const spec of P941_CANONICAL.tables) {
    if (!tablesFound.includes(spec.name)) continue;
    const cols = colsByTable.get(spec.name) ?? new Map();
    for (const [col, type] of Object.entries(spec.columns)) {
      const found = cols.get(col);
      if (!found) {
        objectGaps.push({ table: spec.name, column: col, problem: "COLUMN_MISSING" });
        continue;
      }
      const dt = String(found.data_type ?? "").toLowerCase();
      if (dt !== String(type).toLowerCase()) objectGaps.push({ table: spec.name, column: col, problem: "COLUMN_TYPE_MISMATCH", expected: type, observed: dt });
    }
    for (const req of spec.notNull ?? []) {
      const found = cols.get(req);
      if (found && String(found.is_nullable).toUpperCase() === "YES") objectGaps.push({ table: spec.name, column: req, problem: "NULLABILITY_MISMATCH" });
    }
    const idxNames = (idxByTable.get(spec.name) ?? []).map((i) => i.indexname);
    for (const req of spec.indexes ?? []) if (!idxNames.includes(req)) objectGaps.push({ table: spec.name, index: req, problem: "INDEX_MISSING" });
    for (const req of spec.uniqueIndexes ?? []) {
      const def = (idxByTable.get(spec.name) ?? []).find((i) => i.indexname === req);
      if (def && !/create unique index/i.test(String(def.indexdef))) objectGaps.push({ table: spec.name, index: req, problem: "INDEX_NOT_UNIQUE" });
    }
    // A column that MUST be unique (e.g. clonechat_commands.fingerprint = the durable
    // exactly-once command identity). Uniqueness may be a constraint or a unique index.
    for (const col of spec.uniqueColumns ?? []) {
      const byConstraint = (ev.constraints ?? []).some(
        (c) => c.table_name === spec.name && (c.contype === "u" || c.contype === "p") && String(c.definition).includes(col),
      );
      const byIndex = (idxByTable.get(spec.name) ?? []).some(
        (i) => /create unique index/i.test(String(i.indexdef)) && String(i.indexdef).includes(col),
      );
      if (!byConstraint && !byIndex) objectGaps.push({ table: spec.name, column: col, problem: "UNIQUE_CONSTRAINT_MISSING" });
    }
  }

  const fnFound = (ev.functions ?? []).map((f) => f.proname);
  const missingFns = P941_CANONICAL.functions.filter((f) => !fnFound.includes(f.name)).map((f) => f.name);

  // Grants must actually cover the canonical tables.
  const grantedTables = new Set((ev.tableGrants ?? []).map((g) => g.table_name));
  const tablesWithoutGrant = P941_ALL_TABLES.filter((t) => tablesFound.includes(t) && !grantedTables.has(t));
  const grantedRoutines = new Set((ev.routineGrants ?? []).map((g) => g.routine_name));
  const fnsWithoutGrant = P941_CANONICAL.functions.filter((f) => fnFound.includes(f.name) && !grantedRoutines.has(f.name)).map((f) => f.name);

  const complete =
    roleExists &&
    missingTables.length === 0 &&
    missingFns.length === 0 &&
    objectGaps.length === 0 &&
    tablesWithoutGrant.length === 0 &&
    fnsWithoutGrant.length === 0;

  const detail = {
    roleExists,
    tablesFound: tablesFound.length,
    tablesExpected: P941_ALL_TABLES.length,
    missingTables,
    functionsFound: fnFound.length,
    missingFunctions: missingFns,
    objectGaps,
    tenantPolicyProblems,
    grantsOutsidePerimeter: uniqueOutside,
    tablesWithoutGrant,
    functionsWithoutGrant: fnsWithoutGrant,
    rlsMissing,
    rlsNotForced,
    securityDefinerFunctions: secDef,
  };

  // A safety blocker means the EXISTING state is incompatible — never "fully applied".
  if (blockers.length > 0) {
    return { state: "INCOMPATIBLE_EXISTING_STATE", reasons: blockers.map((b) => b.detail), blockers, detail };
  }
  if (complete) {
    reasons.push("all 10 canonical tables present with expected columns/indexes");
    reasons.push("all 3 budget functions present, none SECURITY DEFINER");
    reasons.push("RLS enabled AND forced on every canonical table; tenant policies scoped by app.current_company");
    reasons.push("clonechat_app is least-privilege (NOLOGIN, no BYPASSRLS) with grants confined to clonechat_*");
    return { state: "FULLY_APPLIED", reasons, blockers: [], detail };
  }
  if (missingTables.length > 0) reasons.push(`${missingTables.length} canonical table(s) missing`);
  if (missingFns.length > 0) reasons.push(`${missingFns.length} canonical function(s) missing`);
  if (objectGaps.length > 0) reasons.push(`${objectGaps.length} column/index gap(s)`);
  if (!roleExists) reasons.push("role clonechat_app absent while objects exist");
  if (tablesWithoutGrant.length > 0) reasons.push(`${tablesWithoutGrant.length} table(s) present without a clonechat_app grant`);
  return { state: "PARTIALLY_APPLIED", reasons, blockers: [], detail };
}

export function classifyPartnerPayout(ev) {
  const reasons = [];
  const blockers = [];
  if (!ev || !ev.connected || !ev.safetyOk) {
    return { state: "UNVERIFIABLE", reasons: ["no authorized read-only connection was established"], blockers: [], detail: null };
  }
  if (ev.inspectionComplete === false) {
    return { state: "UNVERIFIABLE", reasons: ["metadata inspection did not run to completion — classification would be based on partial evidence"], blockers: [], detail: null };
  }
  const C = PARTNER_PAYOUT_CANONICAL;
  const tablesFound = (ev.tables ?? []).map((t) => t.relname);
  const missingBase = C.baseTables.filter((t) => !tablesFound.includes(t));

  if (missingBase.length === C.baseTables.length) {
    return {
      state: "NOT_APPLIED",
      reasons: ["none of the partner-program base tables exist — the partner program itself is not installed"],
      blockers: [],
      detail: { missingBaseTables: missingBase },
    };
  }

  const colsByTable = new Map();
  for (const c of ev.columns ?? []) {
    if (!colsByTable.has(c.table_name)) colsByTable.set(c.table_name, new Map());
    colsByTable.get(c.table_name).set(c.column_name, c);
  }
  const idxNames = new Set((ev.indexes ?? []).map((i) => i.indexname));
  const consByTable = new Map();
  for (const c of ev.constraints ?? []) {
    if (!consByTable.has(c.table_name)) consByTable.set(c.table_name, []);
    consByTable.get(c.table_name).push(c);
  }

  // ── delta of THIS migration ──────────────────────────────────────────────
  const missingColumns = [];
  for (const [table, cols] of Object.entries(C.addedColumns)) {
    if (!tablesFound.includes(table)) continue;
    const present = colsByTable.get(table) ?? new Map();
    for (const col of cols) if (!present.has(col)) missingColumns.push({ table, column: col });
  }
  const missingIndexes = C.addedIndexes.filter((i) => !idxNames.has(i));

  const transferChecks = (consByTable.get("clonestore_pp_transfers") ?? []).filter((c) => c.contype === "c");
  const statusCheckDef = transferChecks.map((c) => String(c.definition)).join(" ");
  const missingStatuses = C.transferStatusesRequired.filter((s) => !statusCheckDef.includes(`'${s}'`));

  const outboxChecks = (consByTable.get("clonestore_pp_email_outbox") ?? []).filter((c) => c.contype === "c");
  const outboxDef = outboxChecks.map((c) => String(c.definition)).join(" ");
  const missingKinds = tablesFound.includes("clonestore_pp_email_outbox")
    ? C.emailKindsRequired.filter((k) => !outboxDef.includes(`'${k}'`))
    : C.emailKindsRequired;

  // ── idempotency (base guarantees) — MISSING = BLOCKER ─────────────────────
  const idem = C.idempotency;
  // Uniqueness may be expressed either as a constraint or as a unique index — accept both.
  const runKeyUnique = (consByTable.get(idem.runKeyUnique.table) ?? []).some(
    (c) => (c.contype === "u" || c.contype === "p") && String(c.definition).includes(idem.runKeyUnique.column),
  );
  const runKeyUniqueIdx = (ev.indexes ?? []).some(
    (i) => i.table_name === idem.runKeyUnique.table && /create unique index/i.test(String(i.indexdef)) && String(i.indexdef).includes(idem.runKeyUnique.column),
  );
  const transferIdemUnique =
    (consByTable.get(idem.transferIdempotencyUnique.table) ?? []).some(
      (c) => c.contype === "u" && String(c.definition).includes(idem.transferIdempotencyUnique.column),
    ) ||
    (ev.indexes ?? []).some(
      (i) => i.table_name === idem.transferIdempotencyUnique.table && /create unique index/i.test(String(i.indexdef)) && String(i.indexdef).includes(idem.transferIdempotencyUnique.column),
    );
  const singleLiveBatch = idxNames.has(idem.singleLiveBatchIndex.index);
  // Name presence is necessary but NOT sufficient: the base migration ships an index of the
  // SAME NAME with a narrower predicate. Require the recreated definition to carry the new
  // statuses, so an un-migrated (old, narrow) index is not mistaken for the applied one.
  const singleLiveTransferByName = idxNames.has(idem.singleLiveTransferIndex.index);
  const singleLiveTransferDef = (ev.indexes ?? []).find((i) => i.indexname === idem.singleLiveTransferIndex.index);
  const singleLiveTransferPredicateOk =
    singleLiveTransferByName &&
    (idem.singleLiveTransferIndex.predicateMustInclude ?? []).every((s) => String(singleLiveTransferDef?.indexdef ?? "").includes(s));
  const singleLiveTransfer = singleLiveTransferByName && singleLiveTransferPredicateOk;

  if (!(runKeyUnique || runKeyUniqueIdx)) blockers.push({ code: "MISSING_RUN_KEY_UNIQUENESS", detail: "clonestore_pp_payout_runs.run_key is not UNIQUE — the monthly job has no logical lock" });
  if (!transferIdemUnique) blockers.push({ code: "MISSING_TRANSFER_IDEMPOTENCY", detail: "clonestore_pp_transfers.idempotency_key is not UNIQUE — a transfer could be duplicated" });
  if (!singleLiveBatch) blockers.push({ code: "MISSING_SINGLE_LIVE_BATCH_CONSTRAINT", detail: "uq_pp_item_entry_live absent — a commission entry could belong to several live batches (double payment)" });
  if (singleLiveTransferByName && !singleLiveTransferPredicateOk) {
    blockers.push({ code: "SINGLE_LIVE_TRANSFER_INDEX_STALE", detail: "uq_pp_transfer_partner_period exists but its predicate lacks the new statuses — the base (narrow) index is still in place; this migration's DROP+RECREATE did not run" });
  } else if (!singleLiveTransfer && !missingIndexes.includes("uq_pp_transfer_partner_period")) {
    blockers.push({ code: "MISSING_SINGLE_LIVE_TRANSFER_CONSTRAINT", detail: "uq_pp_transfer_partner_period absent" });
  }

  // ── test/live separation ─────────────────────────────────────────────────
  const separationProblems = [];
  for (const spec of C.testLiveSeparation.columns) {
    if (!tablesFound.includes(spec.table)) continue;
    const col = (colsByTable.get(spec.table) ?? new Map()).get(spec.column);
    if (!col) {
      separationProblems.push({ table: spec.table, column: spec.column, problem: "MODE_COLUMN_MISSING" });
      continue;
    }
    const def = String(col.column_default ?? "").toLowerCase();
    if (!def.includes(`'${spec.requiredDefault}'`)) {
      separationProblems.push({ table: spec.table, column: spec.column, problem: "DEFAULT_NOT_TEST", observed: def || "(none)" });
    }
    const checks = (consByTable.get(spec.table) ?? []).filter((c) => c.contype === "c" && String(c.definition).includes(spec.column));
    const constrained = checks.some((c) => spec.allowed.every((a) => String(c.definition).includes(`'${a}'`)));
    if (!constrained) separationProblems.push({ table: spec.table, column: spec.column, problem: "MODE_NOT_CONSTRAINED" });
  }
  const dry = C.testLiveSeparation.dryRunDefaultTrue;
  if (tablesFound.includes(dry.table)) {
    const col = (colsByTable.get(dry.table) ?? new Map()).get(dry.column);
    if (!col) separationProblems.push({ table: dry.table, column: dry.column, problem: "DRY_RUN_COLUMN_MISSING" });
    else if (!/true/i.test(String(col.column_default ?? ""))) {
      separationProblems.push({ table: dry.table, column: dry.column, problem: "DRY_RUN_DEFAULT_NOT_TRUE", observed: String(col.column_default ?? "(none)") });
    }
  }
  if (separationProblems.length > 0) {
    blockers.push({ code: "TEST_LIVE_SEPARATION_UNSAFE", detail: `${separationProblems.length} test/live separation problem(s)`, problems: separationProblems });
  }

  // ── nothing DB-side may initiate a transfer ──────────────────────────────
  const extNames = (ev.extensions ?? []).map((e) => String(e.extname).toLowerCase());
  const dangerousExt = C.dangerousExtensions.filter((e) => extNames.includes(e));
  const suspiciousTriggers = (ev.triggers ?? []).filter((t) =>
    /stripe|payout|transfer_exec|http|net_/i.test(`${t.tgname} ${t.function_name}`),
  );
  // A trigger merely NAMED *_guard (immutability) is expected; only outbound-effect names matter.
  const outboundTriggers = suspiciousTriggers.filter((t) => /http|net_|stripe_call|send/i.test(String(t.function_name)));
  if (outboundTriggers.length > 0) {
    blockers.push({ code: "TRIGGER_MAY_INITIATE_TRANSFER", detail: `${outboundTriggers.length} trigger(s) look outbound-effectful`, triggers: outboundTriggers.map((t) => `${t.table_name}.${t.tgname}`) });
  }

  // A SECURITY DEFINER partner function is not by itself a migration defect, but it is a
  // privilege surface: record it. (It still cannot move the P10 floor — that floor is a
  // compile-time constant in APPLICATION code, not a database flag, so no SQL can reach it.)
  const ppSecurityDefiner = (ev.ppFunctions ?? []).filter((f) => f.prosecdef).map((f) => f.proname);

  const remoteExecutionPossible = dangerousExt.length > 0;
  const detail = {
    partnerSecurityDefinerFunctions: ppSecurityDefiner,
    p10FloorReachableFromDatabase: false, // structural: the floor is a TS const, not a DB row
    missingBaseTables: missingBase,
    missingColumns,
    missingIndexes,
    missingTransferStatuses: missingStatuses,
    missingEmailKinds: missingKinds,
    idempotency: {
      runKeyUnique: runKeyUnique || runKeyUniqueIdx,
      transferIdempotencyUnique: transferIdemUnique,
      singleLiveBatchIndex: singleLiveBatch,
      singleLiveTransferIndex: singleLiveTransfer,
    },
    testLiveSeparationProblems: separationProblems,
    dangerousExtensionsInstalled: dangerousExt,
    // §10: a remote cron is NEVER inferred from table presence. Without pg_cron, it is
    // structurally impossible; with it, we say UNVERIFIABLE rather than guess.
    remoteCronPossible: extNames.includes("pg_cron"),
    triggersObserved: (ev.triggers ?? []).map((t) => `${t.table_name}.${t.tgname}→${t.function_name}`),
    outboundTriggers: outboundTriggers.map((t) => `${t.table_name}.${t.tgname}`),
  };

  if (blockers.length > 0) {
    return { state: "INCOMPATIBLE_EXISTING_STATE", reasons: blockers.map((b) => b.detail), blockers, detail, remoteExecutionPossible };
  }

  const deltaComplete =
    missingBase.length === 0 &&
    missingColumns.length === 0 &&
    missingIndexes.length === 0 &&
    missingStatuses.length === 0 &&
    missingKinds.length === 0;

  if (deltaComplete) {
    reasons.push("every column, index and CHECK vocabulary added by 2026-07-11_05 is present");
    reasons.push("run-key uniqueness, transfer idempotency and the single-live-batch constraint all hold");
    reasons.push("stripe_mode defaults to 'test' on both money tables; payout runs default to dry_run=true");
    return { state: "FULLY_APPLIED", reasons, blockers: [], detail, remoteExecutionPossible };
  }
  if (missingBase.length > 0) reasons.push(`${missingBase.length} partner base table(s) missing`);
  if (missingColumns.length > 0) reasons.push(`${missingColumns.length} column(s) added by this migration are absent`);
  if (missingIndexes.length > 0) reasons.push(`${missingIndexes.length} index(es) added by this migration are absent`);
  if (missingStatuses.length > 0) reasons.push(`transfers CHECK lacks: ${missingStatuses.join(", ")}`);
  if (missingKinds.length > 0) reasons.push(`email_outbox CHECK lacks: ${missingKinds.join(", ")}`);
  return { state: "PARTIALLY_APPLIED", reasons, blockers: [], detail, remoteExecutionPossible };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. History reconciliation (§11)
//    THE REAL MECHANISM: only `public.pierre_rt_schema_migrations` exists, it is
//    written ONLY by scripts/p87-activate-remote.mjs, and that script filters on
//    "pierre_v". `apply-partner-program-production.mjs` records NO history at all,
//    and NOTHING applies supabase/migrations-p941/. So for BOTH of our migrations
//    the ledger structurally cannot hold an entry: history can neither confirm nor
//    refute them, and the OBJECT state is the only admissible evidence.
// ─────────────────────────────────────────────────────────────────────────────

export const HISTORY_STATES = /** @type {const} */ ([
  "ENTRY_PRESENT",
  "ENTRY_ABSENT_LEDGER_EXISTS",
  "NO_LEDGER_FOR_THIS_MIGRATION",
  "CONFLICTING_ENTRY",
  "UNVERIFIABLE",
]);

export function reconcileHistory({ connected, safetyOk, ledgerPresent, supabaseCliPresent, entries, migrationFileName, ledgerTracksThisMigration }) {
  if (!connected || !safetyOk) return { state: "UNVERIFIABLE", reason: "no authorized read-only connection" };
  if (!ledgerTracksThisMigration) {
    return {
      state: "NO_LEDGER_FOR_THIS_MIGRATION",
      reason:
        "No migration-history mechanism records this file. The only remote ledger is public.pierre_rt_schema_migrations, written solely by scripts/p87-activate-remote.mjs, which filters on \"pierre_v\". History can therefore neither confirm nor refute this migration — object state is the only admissible evidence.",
      ledgerPresent: Boolean(ledgerPresent),
      supabaseCliPresent: Boolean(supabaseCliPresent),
    };
  }
  const names = (entries ?? []).map((e) => String(e.filename ?? e.name ?? ""));
  const matches = names.filter((n) => n.includes(migrationFileName));
  if (matches.length > 1) return { state: "CONFLICTING_ENTRY", reason: `${matches.length} conflicting ledger entries`, matches };
  if (matches.length === 1) return { state: "ENTRY_PRESENT", reason: "ledger entry found", matches };
  return { state: "ENTRY_ABSENT_LEDGER_EXISTS", reason: "the ledger exists and tracks this class of migration, but holds no entry for it" };
}

/**
 * §7 hard rule, made mechanical: history presence NEVER proves the schema, and schema
 * presence NEVER proves the migration ran. Report the disagreement instead of hiding it.
 */
export function detectDrift({ objectState, historyState }) {
  const signals = [];
  if (objectState === "FULLY_APPLIED" && historyState === "ENTRY_ABSENT_LEDGER_EXISTS") {
    signals.push({ code: "OBJECTS_WITHOUT_HISTORY", detail: "objects are complete but the ledger has no entry — applied out of band" });
  }
  if (objectState === "FULLY_APPLIED" && historyState === "NO_LEDGER_FOR_THIS_MIGRATION") {
    signals.push({ code: "OBJECTS_WITHOUT_LEDGER_MECHANISM", detail: "objects are complete and NO ledger tracks this migration — application is real but unrecorded" });
  }
  if (historyState === "ENTRY_PRESENT" && objectState !== "FULLY_APPLIED") {
    signals.push({ code: "HISTORY_WITHOUT_OBJECTS", detail: "a ledger entry claims this migration ran, but the objects are not complete — partial or reverted" });
  }
  if (objectState === "INCOMPATIBLE_EXISTING_STATE") {
    signals.push({ code: "INCOMPATIBLE_OBJECTS", detail: "objects exist with definitions incompatible with the canonical migration" });
  }
  if (historyState === "CONFLICTING_ENTRY") signals.push({ code: "CONFLICTING_HISTORY", detail: "duplicate/conflicting ledger entries" });
  return { driftDetected: signals.length > 0, signals };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Compatibility + command center (§13) — DERIVED, never hardcoded green
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateCompatibility({ p941, partner, connected, safetyOk } = {}) {
  // Explicit connection guard: never let a reassuring value out without a proven session,
  // independent of the migration states (belt-and-braces with those states being UNVERIFIABLE).
  if (connected === false || safetyOk === false) return "REMOTE_SCHEMA_UNVERIFIABLE";
  if (!p941 || !partner || p941.state === "UNVERIFIABLE" || partner.state === "UNVERIFIABLE") return "REMOTE_SCHEMA_UNVERIFIABLE";
  if (p941.state === "INCOMPATIBLE_EXISTING_STATE" || partner.state === "INCOMPATIBLE_EXISTING_STATE") return "REMOTE_SCHEMA_DRIFTED";
  if (p941.state === "FULLY_APPLIED" && partner.state === "FULLY_APPLIED") return "REMOTE_SCHEMA_COMPATIBLE";
  return "REMOTE_SCHEMA_INCOMPLETE";
}

/**
 * Derive the E1.2 command center from evidence. Hard values are constants of the phase,
 * not measurements — but every *remote* value comes from `ev` and nowhere else.
 */
export function deriveE12CommandCenter(ev) {
  const e = ev ?? {};
  const connected = Boolean(e.remoteConnectionSucceeded);
  const safetyOk = Boolean(e.remoteReadOnlyEnforced);
  const p941 = e.p941 ?? { state: "UNVERIFIABLE", detail: null, blockers: [] };
  const partner = e.partner ?? { state: "UNVERIFIABLE", detail: null, blockers: [] };
  const compatibility = evaluateCompatibility({ p941, partner, connected, safetyOk });
  const drift941 = e.drift941 ?? { driftDetected: false, signals: [] };
  const driftPartner = e.driftPartner ?? { driftDetected: false, signals: [] };
  const driftDetected = connected && safetyOk ? drift941.driftDetected || driftPartner.driftDetected : "UNVERIFIABLE";

  const d941 = p941.detail;
  const dPartner = partner.detail;
  const tri = (v) => (connected && safetyOk && v !== undefined && v !== null ? v : "UNVERIFIABLE");

  const warnings = [];
  const blockers = [];

  if (!e.repositoryStable) blockers.push("Repository is not single-writer — measurements cannot be trusted.");
  if (!e.readOnlyAuthorizationReceived) blockers.push("Owner read-only authorization not received — no connection may be opened.");
  if (connected && !safetyOk) blockers.push("Read-only session safety could not be proven — inspection refused.");
  for (const b of p941.blockers ?? []) blockers.push(`P9.4.1: ${b.detail}`);
  for (const b of partner.blockers ?? []) blockers.push(`Partner payout: ${b.detail}`);

  if (e.productionSuspected) warnings.push("The configured target is a managed remote with productionSuspected=true.");
  for (const s of drift941.signals ?? []) warnings.push(`P9.4.1 drift: ${s.detail}`);
  for (const s of driftPartner.signals ?? []) warnings.push(`Partner payout drift: ${s.detail}`);
  if (dPartner?.remoteCronPossible) warnings.push("pg_cron is installed — DB-side scheduling is POSSIBLE; remote payout automation must be ruled out explicitly, not assumed.");
  if ((dPartner?.dangerousExtensionsInstalled ?? []).length > 0) {
    warnings.push(`Outbound-capable extension(s) installed: ${dPartner.dangerousExtensionsInstalled.join(", ")} — a database-side HTTP call becomes technically possible.`);
  }
  if ((dPartner?.partnerSecurityDefinerFunctions ?? []).length > 0) {
    warnings.push(`${dPartner.partnerSecurityDefinerFunctions.length} partner function(s) are SECURITY DEFINER — a privilege surface worth reviewing (they still cannot move the P10 floor, which is a compile-time constant in application code).`);
  }

  const migrationApplicationRequired = !connected || !safetyOk
    ? "UNVERIFIABLE"
    : p941.state !== "FULLY_APPLIED" || partner.state !== "FULLY_APPLIED";
  const repairMigrationRequired = !connected || !safetyOk
    ? "UNVERIFIABLE"
    : p941.state === "INCOMPATIBLE_EXISTING_STATE" || partner.state === "INCOMPATIBLE_EXISTING_STATE";
  const backupRequired = !connected || !safetyOk
    ? "UNVERIFIABLE"
    : Boolean(e.productionSuspected) && migrationApplicationRequired === true;

  let nextSafeAction;
  if (!e.repositoryStable) nextSafeAction = "MANUAL_REVIEW_REQUIRED";
  else if (!e.readOnlyAuthorizationReceived) nextSafeAction = "OWNER_READ_ONLY_AUTHORIZATION_REQUIRED";
  else if (!connected || !safetyOk) nextSafeAction = "UNVERIFIABLE";
  else if (repairMigrationRequired === true) nextSafeAction = "CREATE_REPAIR_MIGRATION";
  else if (migrationApplicationRequired === true) nextSafeAction = "APPLY_CANONICAL_MIGRATION";
  else nextSafeAction = "NO_ACTION_REQUIRED";

  let verdict;
  if (!e.repositoryStable) verdict = "E1.2 — REMOTE PREFLIGHT BLOCKED / REPOSITORY WRITER STILL ACTIVE";
  else if (!e.readOnlyAuthorizationReceived) verdict = "E1.2 — READ-ONLY PREFLIGHT PREPARED / OWNER AUTHORIZATION REQUIRED";
  else if (!connected || !safetyOk) verdict = "E1.2 — REMOTE PREFLIGHT BLOCKED / CONNECTION OR SAFETY FAILURE";
  else if (compatibility === "REMOTE_SCHEMA_DRIFTED") verdict = "E1.2 — REMOTE SCHEMA PARTIAL OR DRIFTED / REPAIR PLAN REQUIRED";
  else if (compatibility === "REMOTE_SCHEMA_INCOMPLETE") verdict = "E1.2 — REMOTE DATABASE STATE VERIFIED / MIGRATION APPLICATION AUTHORIZATION REQUIRED";
  else if (compatibility === "REMOTE_SCHEMA_COMPATIBLE") verdict = "E1.2 — REMOTE DATABASE ALREADY COMPATIBLE / DEPLOYMENT AUTHORIZATION STILL REQUIRED";
  else verdict = "E1.2 — REMOTE PREFLIGHT BLOCKED / CONNECTION OR SAFETY FAILURE";

  return {
    phase: "E1.2",
    // ── local ──
    e11LocallyReconciled: Boolean(e.e11LocallyReconciled),
    repositoryStable: Boolean(e.repositoryStable),
    readOnlyAuthorizationReceived: Boolean(e.readOnlyAuthorizationReceived),
    // ── connection ──
    remoteConnectionAttempted: Boolean(e.remoteConnectionAttempted),
    remoteConnectionSucceeded: connected,
    remoteReadOnlyEnforced: safetyOk,
    // ── HARD VALUES: constants of E1.2, not measurements ──
    customerRowsRead: 0,
    mutationsExecuted: 0,
    migrationsApplied: 0,
    // ── target ──
    remoteTargetCategory: e.remoteTargetCategory ?? "absent",
    productionSuspected: Boolean(e.productionSuspected),
    // ── P9.4.1 ──
    p941LocalMigrationPresent: Boolean(e.p941LocalMigrationPresent),
    p941RemoteState: p941.state,
    p941HistoryState: e.p941HistoryState ?? "UNVERIFIABLE",
    p941ObjectState: p941.state,
    clonechatAppRoleExists: tri(d941?.roleExists),
    clonechatAppRoleLeastPrivilege: tri(
      d941 ? (p941.blockers ?? []).every((b) => !String(b.code).startsWith("ROLE_")) && d941.roleExists : null,
    ),
    clonechatAppRoleBypassesRls: tri(d941 ? (p941.blockers ?? []).some((b) => b.code === "ROLE_BYPASSES_RLS") : null),
    clonechatDurableTablesReady: tri(d941 ? d941.missingTables?.length === 0 && d941.objectGaps?.length === 0 : null),
    clonechatDurableFunctionsReady: tri(d941 ? d941.missingFunctions?.length === 0 && d941.securityDefinerFunctions?.length === 0 : null),
    clonechatRlsReady: tri(d941 ? d941.rlsMissing?.length === 0 && d941.rlsNotForced?.length === 0 && d941.tenantPolicyProblems?.length === 0 : null),
    clonechatGrantsReady: tri(d941 ? d941.grantsOutsidePerimeter?.length === 0 && d941.tablesWithoutGrant?.length === 0 : null),
    // ── partner payout ──
    partnerPayoutMigrationPresent: Boolean(e.partnerPayoutMigrationPresent),
    partnerPayoutRemoteState: partner.state,
    partnerPayoutHistoryState: e.partnerHistoryState ?? "UNVERIFIABLE",
    partnerPayoutObjectState: partner.state,
    partnerPayoutConstraintsReady: tri(
      dPartner?.idempotency
        ? dPartner.idempotency.runKeyUnique &&
          dPartner.idempotency.transferIdempotencyUnique &&
          dPartner.idempotency.singleLiveBatchIndex &&
          dPartner.idempotency.singleLiveTransferIndex
        : null,
    ),
    partnerPayoutTestLiveSeparationReady: tri(dPartner ? dPartner.testLiveSeparationProblems?.length === 0 : null),
    // Held false unless INDEPENDENTLY and SAFELY proven otherwise (§12).
    partnerPayoutRemoteExecutionEnabled: false,
    // ── schema ──
    remoteSchemaCompatibility: compatibility,
    remoteDriftDetected: driftDetected,
    backupRequired,
    migrationApplicationRequired,
    repairMigrationRequired,
    // ── gates that E1.2 can never open ──
    deploymentStillBlocked: true,
    productionAuthorized: false,
    paymentMode: "disabled",
    partnerPayoutLiveAuthorized: false,
    remoteDatabaseMutated: false,
    deploymentPerformed: false,
    // ── narrative ──
    exactWarnings: warnings,
    exactBlockers: blockers,
    nextSafeAction,
    verdict,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. E1.3 migration command center — DERIVED from the migration run's evidence.
//     Hard values are constants of the phase; every schema value comes from `ev`.
// ─────────────────────────────────────────────────────────────────────────────

export function deriveE13CommandCenter(ev) {
  const e = ev ?? {};
  const committed = e.migrationCommitted === true;
  const rolledBack = e.migrationRolledBack === true;
  const postcheck = e.postcheck ?? null; // { verdict, ok, p941State, partnerState, compatibility, roleBypassesRls, dangerousExtensions }
  const postOk = committed && postcheck?.ok === true;
  // A committed migration is only CERTIFIED when the read-only postcheck actually ran to
  // completion (POSTCHECK_COMPLETE) and reported a state. A commit WITHOUT that evidence
  // (postcheck null / blocked / safety-failed) must NOT claim FULLY_APPLIED — it is
  // UNVERIFIABLE-after-commit. Absence of post-commit evidence fails closed.
  const postCertified = committed && postcheck?.verdict === "POSTCHECK_COMPLETE";

  const p941After = committed ? (postCertified ? postcheck.p941State ?? "UNVERIFIABLE" : "UNVERIFIABLE") : e.p941RemoteStateBefore ?? "UNVERIFIABLE";
  const partnerAfter = committed ? (postCertified ? postcheck.partnerState ?? "UNVERIFIABLE" : "UNVERIFIABLE") : e.partnerPayoutStateBefore ?? "UNVERIFIABLE";
  const compatibility = committed ? (postCertified ? postcheck.compatibility ?? "REMOTE_SCHEMA_UNVERIFIABLE" : "REMOTE_SCHEMA_UNVERIFIABLE") : "REMOTE_SCHEMA_UNVERIFIABLE";
  const failure = e.failure ?? null;

  let verdict, nextSafeAction;
  if (!committed && failure === "ALREADY_APPLIED") { verdict = "E1.3 — MIGRATION NO LONGER REQUIRED / REMOTE ALREADY COMPATIBLE"; nextSafeAction = "PROCEED_TO_DEPLOYMENT_AUTHORIZATION"; }
  else if (!committed && (failure === "STATE_CHANGED_OR_PARTIAL" || failure === "STATE_CHANGED_INSIDE_TXN" || failure === "PARTNER_STATE_UNEXPECTED")) { verdict = "E1.3 — MIGRATION APPLICATION BLOCKED / REMOTE STATE CHANGED OR PARTIAL"; nextSafeAction = "RE_RUN_E1_2_VERIFICATION"; }
  else if (rolledBack) { verdict = "E1.3 — P9.4.1 MIGRATION ROLLED BACK / REMOTE STATE UNCHANGED"; nextSafeAction = "REVIEW_ASSERTION_FAILURE"; }
  else if (!committed) { verdict = "E1.3 — P9.4.1 MIGRATION ROLLED BACK / REMOTE STATE UNCHANGED"; nextSafeAction = "REVIEW_CONNECTION_FAILURE"; }
  // Certification UNAVAILABLE (no postcheck, transport-blocked, or safety could not be proven)
  // ⇒ COMMITTED / POSTCHECK BLOCKED — never a success or a false "inconsistent".
  else if (committed && (!postcheck || postcheck.verdict === "POSTCHECK_BLOCKED" || postcheck.verdict === "POSTCHECK_SAFETY_FAILED")) { verdict = "E1.3 — P9.4.1 COMMITTED / POST-MIGRATION CERTIFICATION BLOCKED"; nextSafeAction = "RE_RUN_READ_ONLY_CERTIFICATION"; }
  // Certification COMPLETED but the schema is genuinely not compatible ⇒ INCONSISTENT.
  else if (committed && !postOk) { verdict = "E1.3 — REMOTE MIGRATION PARTIAL OR INCONSISTENT / DEPLOYMENT BLOCKED"; nextSafeAction = "MANUAL_REVIEW_REQUIRED"; }
  else { verdict = "E1.3 — P9.4.1 REMOTE MIGRATION VERIFIED / DEPLOYMENT AUTHORIZATION STILL REQUIRED"; nextSafeAction = "REQUEST_DEPLOYMENT_AUTHORIZATION"; }

  const warnings = [];
  if (e.productionSuspected) warnings.push("Target is a managed remote with productionSuspected=true.");
  const dext = postcheck?.dangerousExtensions ?? [];
  if (dext.length) warnings.push(`Outbound-capable extensions installed: ${dext.join(", ")} — DB-side scheduling/HTTP remains possible; re-confirm before any live payout.`);

  return {
    phase: "E1.3",
    e12RemoteStateVerified: Boolean(e.e12RemoteStateVerified),
    repositoryStable: Boolean(e.repositoryStable),
    targetFingerprintMatched: Boolean(e.targetFingerprintMatched),
    migrationFilePresent: Boolean(e.migrationFilePresent),
    migrationChecksumMatched: Boolean(e.migrationChecksumMatched),
    migrationTransactional: Boolean(e.migrationTransactional),
    backupConfirmed: Boolean(e.backupConfirmed),
    rollbackRunbookReady: Boolean(e.rollbackRunbookReady),
    ownerMigrationAuthorizationReceived: Boolean(e.ownerMigrationAuthorizationReceived),
    migrationConnectionAttempted: Boolean(e.migrationConnectionAttempted),
    migrationTransactionStarted: Boolean(e.migrationTransactionStarted),
    migrationSqlExecuted: Boolean(e.migrationSqlExecuted),
    migrationSqlExecutionCount: e.migrationSqlExecutionCount ?? 0,
    inTransactionAssertionsPassed: Boolean(e.inTransactionAssertionsPassed),
    migrationCommitted: committed,
    migrationRolledBack: rolledBack,
    migrationsApplied: committed ? 1 : 0,
    p941RemoteStateBefore: e.p941RemoteStateBefore ?? "UNVERIFIABLE",
    p941RemoteStateAfter: p941After,
    clonechatAppRoleReady: postOk,
    clonechatAppRoleBypassesRls: committed ? Boolean(postcheck?.roleBypassesRls) : false,
    clonechatDurableTablesReady: postOk,
    clonechatDurableFunctionsReady: postOk,
    clonechatRlsReady: postOk,
    clonechatGrantsReady: postOk,
    partnerPayoutStateBefore: e.partnerPayoutStateBefore ?? "UNVERIFIABLE",
    partnerPayoutStateAfter: partnerAfter,
    unrelatedSchemaPreserved: partnerAfter === "FULLY_APPLIED",
    postMigrationReadOnlyVerificationComplete: Boolean(committed && postcheck && postcheck.verdict === "POSTCHECK_COMPLETE"),
    remoteSchemaCompatibility: compatibility,
    // hard values
    customerRowsRead: 0,
    liveProviderCalls: 0,
    productionAuthorized: false,
    paymentMode: "disabled",
    partnerPayoutLiveAuthorized: false,
    deploymentPerformed: false,
    remoteDatabaseMutated: committed,
    exactMutationPerformed: committed ? "P9.4.1_CANONICAL_MIGRATION_ONLY" : "NONE",
    exactWarnings: warnings,
    exactBlockers: Array.isArray(e.assertionBlockers) ? e.assertionBlockers : [],
    nextSafeAction,
    verdict,
  };
}
