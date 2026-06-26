// GO-LIVE 01C -- Adaptive RLS File Integrity Tests
// Verifies that the GO-LIVE 01C correction files are correct and safe:
//   - Introspection SQL is read-only
//   - Adaptive pack uses to_regclass guards
//   - No direct public.companies CREATE POLICY without guard
//   - Script references GO-LIVE 01C files and warns about companies
//   - Docs explain error 42P01
//   - Proof registry proofs remain pending (no auto-verified status)
//   - Public launch stays NO-GO

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readSql(filename: string): string {
  return readFileSync(join(ROOT, "docs", "sql", filename), "utf-8");
}

function readDoc(filename: string): string {
  return readFileSync(join(ROOT, "docs", filename), "utf-8");
}

function readScript(filename: string): string {
  return readFileSync(join(ROOT, "scripts", filename), "utf-8");
}

// ── Introspection SQL — read-only ─────────────────────────────────────────────

describe("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql — read-only safety", () => {
  let sql: string;

  it("file exists and is readable", () => {
    sql = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(sql.length).toBeGreaterThan(0);
  });

  it("contains no INSERT statements", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content.toUpperCase()).not.toMatch(/^\s*INSERT\s/m);
  });

  it("contains no UPDATE statements", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content.toUpperCase()).not.toMatch(/^\s*UPDATE\s/m);
  });

  it("contains no DELETE statements", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content.toUpperCase()).not.toMatch(/^\s*DELETE\s/m);
  });

  it("contains no DROP statements", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content.toUpperCase()).not.toMatch(/^\s*DROP\s/m);
  });

  it("contains no CREATE TABLE statements", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content.toUpperCase()).not.toMatch(/CREATE\s+TABLE/);
  });

  it("contains no ALTER TABLE statements", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content.toUpperCase()).not.toMatch(/ALTER\s+TABLE/);
  });

  it("contains 6 SELECT queries for schema discovery", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    const selectCount = (content.match(/^\s*SELECT\b/gim) || []).length;
    expect(selectCount).toBeGreaterThanOrEqual(6);
  });

  it("queries information_schema.tables", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content).toContain("information_schema.tables");
  });

  it("queries information_schema.columns", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content).toContain("information_schema.columns");
  });

  it("queries pg_policies", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content).toContain("pg_policies");
  });

  it("queries pg_tables for rowsecurity status", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content).toContain("pg_tables");
    expect(content).toContain("rowsecurity");
  });

  it("checks for Pierre-related tables", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content).toContain("pierre");
  });

  it("checks tenancy columns including user_id and company_id", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content).toContain("user_id");
    expect(content).toContain("company_id");
  });
});

// ── Adaptive RLS Pack — to_regclass guards ────────────────────────────────────

describe("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql — adaptive safety", () => {
  let sql: string;

  it("file exists and is readable", () => {
    sql = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(sql.length).toBeGreaterThan(0);
  });

  it("contains to_regclass guards", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("to_regclass");
  });

  it("uses to_regclass for each table block", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    const guardCount = (content.match(/to_regclass/g) || []).length;
    expect(guardCount).toBeGreaterThanOrEqual(10);
  });

  it("uses DROP POLICY IF EXISTS before CREATE POLICY (idempotent)", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("DROP POLICY IF EXISTS");
  });

  it("uses RAISE NOTICE for absent tables", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("RAISE NOTICE");
    expect(content).toContain("[SKIP]");
  });

  it("uses BEGIN and COMMIT (transaction-wrapped)", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toMatch(/^BEGIN;/m);
    expect(content).toMatch(/^COMMIT;/m);
  });

  it("covers pierre_missions table", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("pierre_missions");
  });

  it("covers pierre_tasks table", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("pierre_tasks");
  });

  it("covers orders table", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("orders");
  });

  it("covers audit_log (singular, not plural)", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("audit_log");
  });

  it("blocks INSERT on audit_log for authenticated users (immutable)", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toMatch(/audit_log[^;]*WITH CHECK \(false\)/s);
  });

  it("uses user_id = auth.uid() as primary tenancy", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("user_id = auth.uid()");
  });

  it("does NOT create public.companies table", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content.toUpperCase()).not.toMatch(/CREATE\s+TABLE\s+PUBLIC\.COMPANIES/);
    expect(content.toUpperCase()).not.toMatch(/CREATE\s+TABLE\s+COMPANIES/);
  });

  it("does NOT have CREATE POLICY referencing public.companies without to_regclass guard", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    // Any reference to companies in a CREATE POLICY must be guarded
    // The pack should only mention companies in a NOTICE/INFO block, not in a bare CREATE POLICY
    expect(content).not.toMatch(/CREATE POLICY[^;]*ON public\.companies/i);
  });

  it("includes NOTICE that companies does not need to be created", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("do NOT create");
  });

  it("checks column existence before applying user_id policy", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("information_schema.columns");
    expect(content).toContain("column_name = 'user_id'");
  });

  it("uses DO blocks (PL/pgSQL for conditional execution)", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    const doCount = (content.match(/^DO \$\$/gm) || []).length;
    expect(doCount).toBeGreaterThanOrEqual(8);
  });
});

// ── PowerShell script — GO-LIVE 01C guidance ─────────────────────────────────

describe("pfinal02-supabase-rls-verify.ps1 — GO-LIVE 01C guidance", () => {
  let script: string;

  it("file exists and is readable", () => {
    script = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(script.length).toBeGreaterThan(0);
  });

  it("mentions GO_LIVE_01C_SCHEMA_INTROSPECTION.sql", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).toContain("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
  });

  it("mentions GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).toContain("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
  });

  it("warns against creating companies table", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content.toLowerCase()).toContain("companies");
    expect(content.toLowerCase()).toMatch(/ne.*pas.*cr[eé]er|not.*create|pas.*companies/i);
  });

  it("mentions the adaptive pack documentation", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).toContain("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
  });

  it("warns that no proof should be checked until adaptive pack verified", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content.toLowerCase()).toContain("preuve");
    expect(content.toLowerCase()).toContain("adaptive");
  });

  it("does NOT set any public launch flag to true", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/i);
    expect(content).not.toMatch(/CLONESTORE_PUBLIC_LAUNCH_APPROVED\s*=\s*true/i);
  });

  it("does NOT connect to Supabase (no Invoke-WebRequest or curl to supabase)", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content.toLowerCase()).not.toContain("invoke-webrequest");
    expect(content.toLowerCase()).not.toContain("invoke-restmethod");
  });
});

// ── Documentation — explains 42P01 ───────────────────────────────────────────

describe("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md — documentation completeness", () => {
  let doc: string;

  it("file exists and is readable", () => {
    doc = readDoc("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
    expect(doc.length).toBeGreaterThan(0);
  });

  it("explains error 42P01", () => {
    const content = readDoc("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
    expect(content).toContain("42P01");
  });

  it("explains that companies does not exist", () => {
    const content = readDoc("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
    expect(content.toLowerCase()).toContain("companies");
    expect(content.toLowerCase()).toMatch(/does not exist|n.existe pas/i);
  });

  it("explains why NOT to create companies", () => {
    const content = readDoc("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
    expect(content.toLowerCase()).toMatch(/pourquoi ne pas cr[eé]er|do not create|interdit/i);
  });

  it("references introspection SQL file", () => {
    const content = readDoc("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
    expect(content).toContain("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
  });

  it("references adaptive pack SQL file", () => {
    const content = readDoc("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
    expect(content).toContain("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
  });

  it("states proof IDs remain pending", () => {
    const content = readDoc("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
    expect(content).toContain("SUPABASE_RLS_STAGING_APPLIED");
    expect(content.toLowerCase()).toContain("pending");
  });

  it("states public launch is NO-GO", () => {
    const content = readDoc("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
    expect(content.toUpperCase()).toContain("NO-GO");
  });

  it("explains the real tenancy model (user_id)", () => {
    const content = readDoc("GO_LIVE_01C_REAL_SCHEMA_ADAPTIVE_RLS.md");
    expect(content).toContain("user_id");
    expect(content).toContain("auth.uid()");
  });
});

// ── Proof registry — supabase proofs have no auto-verified status ─────────────

describe("go-live-01c — proof registry stays conservative", () => {
  it("PFINAL01_RLS_PRODUCTION_PACK.sql still exists (not deleted)", () => {
    const content = readSql("PFINAL01_RLS_PRODUCTION_PACK.sql");
    expect(content.length).toBeGreaterThan(0);
  });

  it("adaptive pack does not auto-mark any proof as verified", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    // No JSON with "status": "verified" should appear in the SQL
    expect(content).not.toContain('"status": "verified"');
    expect(content).not.toContain("verified: true");
  });

  it("introspection SQL does not claim any proof is verified", () => {
    const content = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content).not.toContain("verified");
  });

  it("adaptive pack explicitly instructs to update proofs only after verification", () => {
    const content = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(content).toContain("SUPABASE_RLS_STAGING_APPLIED");
  });
});
