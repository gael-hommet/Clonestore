// GO-LIVE 01E -- RLS Runtime Script Integrity Tests
// Verifies that the runtime verification scripts exist, are safe, and contain
// the correct checks. These are static file-content tests — no real Supabase
// connection is made, and no proof is auto-verified.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readScript(filename: string): string {
  return readFileSync(join(ROOT, "scripts", filename), "utf-8");
}

function readPkg(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
}

// ── PS1 wrapper script exists and is safe ─────────────────────────────────────

describe("pfinal02-supabase-rls-runtime-verify.ps1 — script safety", () => {
  it("file exists and is readable", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content.length).toBeGreaterThan(0);
  });

  it("references rls-runtime-verify.mjs", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content).toContain("rls-runtime-verify.mjs");
  });

  it("reads .env.local for env vars", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content).toContain(".env.local");
  });

  it("checks NEXT_PUBLIC_SUPABASE_URL presence", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("checks NEXT_PUBLIC_SUPABASE_ANON_KEY presence", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("does NOT display env variable values (masked/hidden)", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    // Should say "masquee" or "not displayed" — never echo the actual key
    expect(content.toLowerCase()).toMatch(/masqu[eé]e|not displayed|hidden/i);
  });

  it("does NOT set public launch flag to true", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/i);
    expect(content).not.toMatch(/CLONESTORE_PUBLIC_LAUNCH_APPROVED\s*=\s*true/i);
  });

  it("does NOT connect to Supabase directly (no Invoke-WebRequest)", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content.toLowerCase()).not.toContain("invoke-webrequest");
    expect(content.toLowerCase()).not.toContain("invoke-restmethod");
  });

  it("does NOT import or invoke OpenAI, Stripe, or Resend SDKs", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    // Only check for actual API invocations, not informational mentions in comments
    expect(content).not.toMatch(/Invoke-WebRequest.*openai|Invoke-RestMethod.*openai/i);
    expect(content).not.toMatch(/Invoke-WebRequest.*stripe|Invoke-RestMethod.*stripe/i);
    expect(content).not.toMatch(/Invoke-WebRequest.*resend|Invoke-RestMethod.*resend/i);
  });

  it("states proof is not modified automatically", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content.toLowerCase()).toContain("go-live-proofs");
  });

  it("states public launch remains NO-GO", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content.toLowerCase()).toMatch(/no-go|toujours no/i);
  });

  it("checks for Node.js availability", () => {
    const content = readScript("pfinal02-supabase-rls-runtime-verify.ps1");
    expect(content.toLowerCase()).toContain("node.js");
  });
});

// ── rls-runtime-verify.mjs — runtime script safety ───────────────────────────

describe("rls-runtime-verify.mjs — runtime verification logic", () => {
  it("file exists and is readable", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content.length).toBeGreaterThan(0);
  });

  it("loads env from .env.local", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain(".env.local");
    expect(content).toContain("loadEnvLocal");
  });

  it("uses NEXT_PUBLIC_SUPABASE_ANON_KEY for client creation", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(content).toContain("createClient");
  });

  it("masks the Supabase URL in output (never logs raw URL with project ID)", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("urlMasked");
    expect(content).toContain("[PROJECT]");
  });

  it("never logs service_role key value — always masks it", () => {
    const content = readScript("rls-runtime-verify.mjs");
    // The script must reference SERVICE_ROLE_KEY
    expect(content).toContain("SERVICE_ROLE_KEY");
    // It must show a masked placeholder like "[SET - not displayed]"
    expect(content).toContain("[SET - not displayed]");
    // Must NOT log the raw variable value directly (no string concatenation that exposes the key)
    // Allowed: SERVICE_ROLE_KEY ? '[SET]' : '[NOT SET]'  (ternary — safe)
    // Forbidden: console.log(SERVICE_ROLE_KEY) or console.log('key: ' + SERVICE_ROLE_KEY)
    expect(content).not.toMatch(/console\.log\(\s*SERVICE_ROLE_KEY\s*\)/);
    expect(content).not.toMatch(/console\.log\([^)]*'\s*\+\s*SERVICE_ROLE_KEY\s*\+/);
  });

  it("tests anon SELECT on pierre_missions", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("pierre_missions");
  });

  it("tests anon SELECT on pierre_tasks", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("pierre_tasks");
  });

  it("tests anon SELECT on pierre_documents", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("pierre_documents");
  });

  it("tests anon SELECT on pierre_company_memory", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("pierre_company_memory");
  });

  it("tests anon SELECT on orders", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("orders");
  });

  it("tests audit_log INSERT resistance", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("audit_log");
    expect(content).toContain("rls_test_01e_insert_should_fail");
  });

  it("considers data.length === 0 as PASS for anon SELECT", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("data.length === 0");
    expect(content).toContain("PASS");
  });

  it("considers data.length > 0 as FAIL for anon SELECT", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("data.length > 0");
    expect(content).toContain("FAIL");
  });

  it("handles NOT NULL constraint error on audit_log gracefully (WARN, not crash)", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("isConstraintError");
    expect(content).toMatch(/WARN.*NOT NULL|NOT NULL.*WARN/s);
  });

  it("generates proof template JSON for SUPABASE_RLS_STAGING_VERIFIED", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("SUPABASE_RLS_STAGING_VERIFIED");
    expect(content).toContain("proof_id");
    expect(content).toContain("evidence_ref");
  });

  it("writes evidence file to go-live-evidence/supabase/", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("go-live-evidence");
    expect(content).toContain("rls-runtime-verification-staging.txt");
  });

  it("does NOT use writeFileSync on go-live-proofs.local.json", () => {
    const content = readScript("rls-runtime-verify.mjs");
    // The file may MENTION go-live-proofs.local.json (to say it doesn't write it),
    // but must NEVER call writeFileSync or writeFile with that path
    expect(content).not.toMatch(/writeFileSync[^;]*go-live-proofs/);
    expect(content).not.toMatch(/writeFile\([^)]*go-live-proofs/);
  });

  it("explicitly states proof must be updated manually", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content.toLowerCase()).toMatch(/does not write|not.*write|manually|manuel/i);
  });

  it("does NOT import or call OpenAI or Anthropic SDK", () => {
    const content = readScript("rls-runtime-verify.mjs");
    // Comments may mention "no OpenAI calls" — check for actual imports/invocations
    expect(content).not.toMatch(/import.*from\s+['"]openai['"]/i);
    expect(content).not.toMatch(/import.*from\s+['"]@anthropic/i);
    expect(content).not.toMatch(/new OpenAI\(|openai\.chat|openai\.completions/i);
  });

  it("does NOT import or call Stripe SDK", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).not.toMatch(/import.*from\s+['"]stripe['"]/i);
    expect(content).not.toMatch(/new Stripe\(/i);
  });

  it("does NOT import or call email provider (Resend/SMTP)", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).not.toMatch(/import.*from\s+['"]resend['"]/i);
    expect(content.toLowerCase()).not.toContain("nodemailer");
    expect(content.toLowerCase()).not.toContain("sendmail");
  });

  it("explains why postgres role bypasses RLS", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content.toLowerCase()).toContain("bypassrls");
  });

  it("supports cross-user test with RLS_TEST_USER_A/B credentials", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("RLS_TEST_USER_A_EMAIL");
    expect(content).toContain("RLS_TEST_USER_B_EMAIL");
  });

  it("gracefully skips cross-user test if no credentials provided", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("SKIP");
    expect(content).toContain("No test user credentials");
  });

  it("exits with code 1 on FAIL verdict", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content).toContain("process.exit(1)");
  });

  it("states public launch is always NO-GO", () => {
    const content = readScript("rls-runtime-verify.mjs");
    expect(content.toUpperCase()).toContain("NO-GO");
  });
});

// ── package.json — check:supabase-rls-runtime script present ─────────────────

describe("package.json — GO-LIVE 01E scripts", () => {
  it("has check:supabase-rls-runtime script", () => {
    const pkg = readPkg();
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts).toHaveProperty("check:supabase-rls-runtime");
    expect(scripts["check:supabase-rls-runtime"]).toContain("pfinal02-supabase-rls-runtime-verify.ps1");
  });

  it("check:supabase-rls-runtime uses powershell with bypass policy", () => {
    const pkg = readPkg();
    const scripts = pkg.scripts as Record<string, string>;
    const cmd = scripts["check:supabase-rls-runtime"] || "";
    expect(cmd.toLowerCase()).toContain("executionpolicy bypass");
  });
});

// ── .env.example — RLS test user variables documented ────────────────────────

describe(".env.example — GO-LIVE 01E env vars documented", () => {
  it(".env.example documents RLS_TEST_USER_A_EMAIL", () => {
    const content = readFileSync(join(ROOT, ".env.example"), "utf-8");
    expect(content).toContain("RLS_TEST_USER_A_EMAIL");
  });

  it(".env.example documents RLS_TEST_USER_B_EMAIL", () => {
    const content = readFileSync(join(ROOT, ".env.example"), "utf-8");
    expect(content).toContain("RLS_TEST_USER_B_EMAIL");
  });

  it(".env.example documents RLS_TEST_USER passwords", () => {
    const content = readFileSync(join(ROOT, ".env.example"), "utf-8");
    expect(content).toContain("RLS_TEST_USER_A_PASSWORD");
    expect(content).toContain("RLS_TEST_USER_B_PASSWORD");
  });
});
