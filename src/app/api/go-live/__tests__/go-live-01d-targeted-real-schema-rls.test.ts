// GO-LIVE 01D -- Targeted Real Schema RLS File Integrity Tests
// Verifies that GO-LIVE 01D files are correct, safe, and match the real schema:
//   - Mapping check SQL is read-only
//   - Targeted pack uses to_regclass guards and correct tenancy columns
//   - Minimal safe pack enables RLS without permissive policies on unconfirmed tables
//   - Documentation covers mixed tenancy, proof IDs, and NO-GO status
//   - PS1 script references GO-LIVE 01D files and warns appropriately
//   - No auto-verified proofs, no public.companies creation, no public launch flip

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

// ── Mapping Check SQL — read-only ─────────────────────────────────────────────

describe("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql — read-only safety", () => {
  it("file exists and is readable", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content.length).toBeGreaterThan(0);
  });

  it("contains no INSERT statements", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content.toUpperCase()).not.toMatch(/^\s*INSERT\s/m);
  });

  it("contains no UPDATE statements", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content.toUpperCase()).not.toMatch(/^\s*UPDATE\s/m);
  });

  it("contains no DELETE statements", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content.toUpperCase()).not.toMatch(/^\s*DELETE\s/m);
  });

  it("contains no DROP statements", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content.toUpperCase()).not.toMatch(/^\s*DROP\s/m);
  });

  it("contains no CREATE TABLE or ALTER TABLE statements", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content.toUpperCase()).not.toMatch(/CREATE\s+TABLE/);
    expect(content.toUpperCase()).not.toMatch(/ALTER\s+TABLE/);
  });

  it("has at least 6 SELECT queries", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    const selectCount = (content.match(/^\s*SELECT\b/gim) || []).length;
    expect(selectCount).toBeGreaterThanOrEqual(6);
  });

  it("queries auth.users for UUID comparison", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content).toContain("auth.users");
  });

  it("includes UUID regex check pattern for client_id text", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content).toMatch(/\[0-9a-f\]\{8\}/);
  });

  it("queries rowsecurity status in pg_tables", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content).toContain("pg_tables");
    expect(content).toContain("rowsecurity");
  });

  it("covers all 8 client_id text tables", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    const tables = [
      "agent_configs",
      "audit_log",
      "deadlines",
      "documents",
      "employees",
      "hr_events",
      "pierre_jobs",
      "pierre_queue",
    ];
    for (const tbl of tables) {
      expect(content).toContain(tbl);
    }
  });

  it("covers client_id uuid tables (agents_owned, api_tokens, router_logs)", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content).toContain("agents_owned");
    expect(content).toContain("api_tokens");
    expect(content).toContain("router_logs");
  });

  it("includes an interpretation guide", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content.toUpperCase()).toContain("INTERPRET");
  });
});

// ── Targeted RLS Pack — full schema ──────────────────────────────────────────

describe("GO_LIVE_01D_TARGETED_RLS_PACK.sql — targeted pack safety", () => {
  it("file exists and is readable", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content.length).toBeGreaterThan(0);
  });

  it("is wrapped in a transaction (BEGIN / COMMIT)", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toMatch(/^BEGIN;/m);
    expect(content).toMatch(/^COMMIT;/m);
  });

  it("uses DROP POLICY IF EXISTS before each CREATE POLICY (idempotent)", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toContain("DROP POLICY IF EXISTS");
  });

  it("uses to_regclass guards for every table block", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    const guardCount = (content.match(/to_regclass/g) || []).length;
    expect(guardCount).toBeGreaterThanOrEqual(10);
  });

  it("uses user_id = auth.uid() for user_id uuid tables", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toContain("user_id = auth.uid()");
  });

  it("uses client_id = auth.uid() for client_id uuid tables", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toContain("client_id = auth.uid()");
  });

  it("uses client_id = auth.uid()::text for client_id text tables", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toContain("auth.uid()::text");
  });

  it("covers pierre_missions with user_id policy", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toContain("pierre_missions");
  });

  it("covers employees table", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toContain("employees");
  });

  it("covers profiles with id = auth.uid()", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toContain("profiles");
    expect(content).toContain("id = auth.uid()");
  });

  it("does NOT create public.companies table", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content.toUpperCase()).not.toMatch(/CREATE\s+TABLE\s+PUBLIC\.COMPANIES/);
    expect(content.toUpperCase()).not.toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+PUBLIC\.COMPANIES/);
  });

  it("does NOT apply CREATE POLICY directly on pierre_queue_view (VIEW)", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).not.toMatch(/CREATE POLICY[^;]*ON public\.pierre_queue_view/i);
    // Check only non-comment lines for ALTER TABLE on the view
    const nonCommentLines = content.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    expect(nonCommentLines).not.toMatch(/ALTER TABLE[^;]*pierre_queue_view/i);
  });

  it("blocks INSERT on audit_log for authenticated users", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toMatch(/audit_log[^;]*WITH CHECK \(false\)/s);
  });

  it("api_tokens has no permissive SELECT policy for authenticated", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).not.toMatch(/CREATE POLICY[^;]*api_tokens[^;]*FOR SELECT[^;]*TO authenticated[^;]*USING\s*\(\s*client_id/is);
  });

  it("uses DO blocks with PL/pgSQL for conditional execution", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    const doCount = (content.match(/^DO \$\$/gm) || []).length;
    expect(doCount).toBeGreaterThanOrEqual(8);
  });

  it("uses RAISE NOTICE [OK] and [SKIP] markers", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).toContain("[OK]");
    expect(content).toContain("[SKIP]");
  });
});

// ── Minimal Safe Pack — safe defaults ────────────────────────────────────────

describe("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql — minimal safe pack safety", () => {
  it("file exists and is readable", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content.length).toBeGreaterThan(0);
  });

  it("is wrapped in a transaction (BEGIN / COMMIT)", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).toMatch(/^BEGIN;/m);
    expect(content).toMatch(/^COMMIT;/m);
  });

  it("applies user_id = auth.uid() policy on pierre_missions", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).toContain("pierre_missions");
    expect(content).toContain("user_id = auth.uid()");
  });

  it("enables RLS on client_id text tables without permissive client policy", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).toContain("ENABLE ROW LEVEL SECURITY");
    expect(content).toContain("service_role only");
  });

  it("uses FOREACH loop to enable RLS on legacy tables", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).toContain("FOREACH");
    expect(content).toContain("tbl_list");
  });

  it("covers all 8 client_id text tables in the FOREACH loop", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    const tables = [
      "agent_configs",
      "audit_log",
      "deadlines",
      "documents",
      "employees",
      "hr_events",
      "pierre_jobs",
      "pierre_queue",
    ];
    for (const tbl of tables) {
      expect(content).toContain(tbl);
    }
  });

  it("blocks INSERT on audit_log (immutable audit trail)", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).toMatch(/audit_log[^;]*WITH CHECK \(false\)/s);
  });

  it("does NOT create public.companies table", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content.toUpperCase()).not.toMatch(/CREATE\s+TABLE\s+PUBLIC\.COMPANIES/);
  });

  it("uses to_regclass guards", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).toContain("to_regclass");
  });

  it("references the targeted pack as the upgrade path", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).toContain("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
  });

  it("does NOT apply CREATE POLICY on pierre_queue_view (VIEW)", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).not.toMatch(/CREATE POLICY[^;]*ON public\.pierre_queue_view/i);
    expect(content).not.toMatch(/ALTER TABLE[^;]*pierre_queue_view/i);
  });
});

// ── Documentation — GO-LIVE 01D ───────────────────────────────────────────────

describe("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md — documentation completeness", () => {
  it("file exists and is readable", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content.length).toBeGreaterThan(0);
  });

  it("explains the mixed tenancy model", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content.toLowerCase()).toContain("user_id");
    expect(content.toLowerCase()).toContain("client_id");
    expect(content.toLowerCase()).toMatch(/mixte|mixed/i);
  });

  it("states that public.companies does not exist", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content.toLowerCase()).toContain("companies");
    expect(content.toLowerCase()).toMatch(/does not exist|n.existe pas|pas de table/i);
  });

  it("references the mapping check SQL", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content).toContain("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
  });

  it("references the targeted RLS pack SQL", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content).toContain("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
  });

  it("references the minimal safe RLS pack SQL", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content).toContain("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
  });

  it("explains the risk of client_id text not being a UUID", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content.toLowerCase()).toMatch(/risque|risk/i);
    expect(content.toLowerCase()).toContain("client_id text");
  });

  it("lists the 6 Supabase proof IDs", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content).toContain("SUPABASE_RLS_STAGING_APPLIED");
    expect(content).toContain("SUPABASE_RLS_STAGING_VERIFIED");
    expect(content).toContain("SUPABASE_RLS_PRODUCTION_APPLIED");
    expect(content).toContain("SUPABASE_RLS_PRODUCTION_VERIFIED");
    expect(content).toContain("SUPABASE_USER_A_CANNOT_READ_USER_B");
    expect(content).toContain("SUPABASE_SERVICE_ROLE_ROUTES_VERIFIED");
  });

  it("states public launch is NO-GO", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content.toUpperCase()).toContain("NO-GO");
  });

  it("mentions pierre_queue_view is a VIEW", () => {
    const content = readDoc("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
    expect(content.toLowerCase()).toContain("pierre_queue_view");
    expect(content.toLowerCase()).toMatch(/view|vue/i);
  });
});

// ── PowerShell script — GO-LIVE 01D guidance ─────────────────────────────────

describe("pfinal02-supabase-rls-verify.ps1 — GO-LIVE 01D guidance", () => {
  it("file exists and is readable", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content.length).toBeGreaterThan(0);
  });

  it("mentions GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).toContain("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
  });

  it("mentions GO_LIVE_01D_TARGETED_RLS_PACK.sql", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).toContain("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
  });

  it("mentions GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).toContain("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
  });

  it("warns against creating companies table", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content.toLowerCase()).toContain("companies");
  });

  it("references GO_LIVE_01D documentation guide", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).toContain("GO_LIVE_01D_TARGETED_REAL_SCHEMA_RLS.md");
  });

  it("does NOT set any public launch flag to true", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/i);
    expect(content).not.toMatch(/CLONESTORE_PUBLIC_LAUNCH_APPROVED\s*=\s*true/i);
  });

  it("does NOT connect to Supabase directly", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content.toLowerCase()).not.toContain("invoke-webrequest");
    expect(content.toLowerCase()).not.toContain("invoke-restmethod");
  });

  it("still references GO-LIVE 01C files (not removed)", () => {
    const content = readScript("pfinal02-supabase-rls-verify.ps1");
    expect(content).toContain("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    expect(content).toContain("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
  });
});

// ── Proof registry — GO-LIVE 01D proofs stay conservative ────────────────────

describe("go-live-01d — proof registry stays conservative", () => {
  it("targeted pack does not auto-mark any proof as verified", () => {
    const content = readSql("GO_LIVE_01D_TARGETED_RLS_PACK.sql");
    expect(content).not.toContain('"status": "verified"');
    expect(content).not.toContain("verified: true");
  });

  it("minimal safe pack does not auto-mark any proof as verified", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).not.toContain('"status": "verified"');
    expect(content).not.toContain("verified: true");
  });

  it("mapping check SQL does not claim any proof is verified", () => {
    const content = readSql("GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql");
    expect(content).not.toContain("verified: true");
  });

  it("minimal safe pack references SUPABASE_RLS_STAGING_APPLIED as a future step", () => {
    const content = readSql("GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql");
    expect(content).toContain("SUPABASE_RLS_STAGING_APPLIED");
  });

  it("GO-LIVE 01C files are not deleted (backwards compatibility)", () => {
    const introspection = readSql("GO_LIVE_01C_SCHEMA_INTROSPECTION.sql");
    const adaptivePack = readSql("GO_LIVE_01C_ADAPTIVE_RLS_PACK.sql");
    expect(introspection.length).toBeGreaterThan(0);
    expect(adaptivePack.length).toBeGreaterThan(0);
  });
});
