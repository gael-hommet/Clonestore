// GO-LIVE 08 — Paid Customer Test Mode E2E Tests
// Static + unit tests. No Stripe live. No Supabase writes. No real payments.
// Only readFileSync (NOT existsSync — causes TypeError in Vitest).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildTestModeE2EVerdict,
  assertTestModeInputSafe,
  GO_LIVE_08_TEST_PROOF_IDS,
} from "@/lib/production-readiness/paid-customer/paid-customer-testmode-e2e";

const ROOT = process.cwd();

function readScript(relPath: string): string {
  return readFileSync(join(ROOT, "scripts", relPath), "utf-8");
}

function readDoc(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

// ── Script existence & safety ─────────────────────────────────────────────────

describe("go-live-08 — PowerShell script safety", () => {
  it("PowerShell script exists", () => {
    const content = readScript("pfinal08-paid-customer-testmode-e2e.ps1");
    expect(content.length).toBeGreaterThan(100);
  });

  it("script refuses sk_live_", () => {
    const content = readScript("pfinal08-paid-customer-testmode-e2e.ps1");
    expect(content).toContain("sk_live_");
    expect(content).toMatch(/BLOCKED|Refusing|refuse/i);
  });

  it("script requires sk_test_", () => {
    const content = readScript("pfinal08-paid-customer-testmode-e2e.ps1");
    expect(content).toContain("sk_test_");
  });

  it("script masks STRIPE_SECRET_KEY — never prints raw value", () => {
    const content = readScript("pfinal08-paid-customer-testmode-e2e.ps1");
    expect(content).toMatch(/mask|masked|\*\*\*\*/i);
    expect(content).not.toMatch(/Write-Host.*\$stripeKey[^M]/i);
  });

  it("script masks STRIPE_WEBHOOK_SECRET", () => {
    const content = readScript("pfinal08-paid-customer-testmode-e2e.ps1");
    expect(content).toContain("STRIPE_WEBHOOK_SECRET");
    expect(content).toMatch(/mask|masked|\*\*\*\*/i);
  });

  it("script checks STRIPE_PRICE_PIERRE", () => {
    expect(readScript("pfinal08-paid-customer-testmode-e2e.ps1")).toContain("STRIPE_PRICE_PIERRE");
  });

  it("script checks Supabase env vars", () => {
    const content = readScript("pfinal08-paid-customer-testmode-e2e.ps1");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("script mentions TEST MODE ONLY", () => {
    expect(readScript("pfinal08-paid-customer-testmode-e2e.ps1")).toMatch(/TEST MODE ONLY/i);
  });

  it("script creates/mentions evidence file path", () => {
    const content = readScript("pfinal08-paid-customer-testmode-e2e.ps1");
    expect(content).toContain("go-live-evidence");
    expect(content).toContain("paid-customer-testmode-e2e.txt");
  });

  it("script does not modify go-live-proofs.local.json", () => {
    const content = readScript("pfinal08-paid-customer-testmode-e2e.ps1");
    expect(content).not.toMatch(/go-live-proofs\.local\.json.*Set-Content|Out-File.*go-live-proofs/i);
    expect(content).not.toMatch(/\$json.*go-live-proofs/i);
  });

  it("script does not call OpenAI", () => {
    expect(readScript("pfinal08-paid-customer-testmode-e2e.ps1")).not.toMatch(/api\.openai\.com/i);
  });

  it("script does not call Anthropic", () => {
    expect(readScript("pfinal08-paid-customer-testmode-e2e.ps1")).not.toMatch(/api\.anthropic\.com/i);
  });

  it("script does not send email", () => {
    expect(readScript("pfinal08-paid-customer-testmode-e2e.ps1")).not.toMatch(/Send-Mail|resend\.com|sendgrid/i);
  });
});

// ── Node/MJS script ───────────────────────────────────────────────────────────

describe("go-live-08 — Node MJS script safety", () => {
  it("Node/MJS script exists", () => {
    const content = readScript("paid-customer-testmode-e2e.mjs");
    expect(content.length).toBeGreaterThan(100);
  });

  it("MJS script refuses sk_live_", () => {
    const content = readScript("paid-customer-testmode-e2e.mjs");
    expect(content).toContain("sk_live_");
    expect(content).toMatch(/BLOCKED|refuse|refusing/i);
  });

  it("MJS script requires sk_test_", () => {
    expect(readScript("paid-customer-testmode-e2e.mjs")).toContain("sk_test_");
  });

  it("MJS script masks secrets with mask() function", () => {
    const content = readScript("paid-customer-testmode-e2e.mjs");
    expect(content).toContain("function mask");
    expect(content).toMatch(/\*\*\*\*/);
  });

  it("MJS script mentions TEST MODE ONLY", () => {
    expect(readScript("paid-customer-testmode-e2e.mjs")).toMatch(/TEST MODE ONLY/i);
  });

  it("MJS script does not modify go-live-proofs.local.json", () => {
    const content = readScript("paid-customer-testmode-e2e.mjs");
    expect(content).not.toMatch(/writeFileSync.*go-live-proofs\.local\.json/);
    expect(content).not.toMatch(/go-live-proofs\.local\.json.*write/i);
  });

  it("MJS script does not call OpenAI directly", () => {
    expect(readScript("paid-customer-testmode-e2e.mjs")).not.toMatch(/api\.openai\.com/i);
  });

  it("MJS script does not call Anthropic directly", () => {
    expect(readScript("paid-customer-testmode-e2e.mjs")).not.toMatch(/api\.anthropic\.com/i);
  });

  it("MJS script does not send real email", () => {
    expect(readScript("paid-customer-testmode-e2e.mjs")).not.toMatch(/resend\.com|sendEmail.*live/i);
  });

  it("MJS script creates evidence file path", () => {
    const content = readScript("paid-customer-testmode-e2e.mjs");
    expect(content).toContain("go-live-evidence");
    expect(content).toContain("paid-customer-testmode-e2e.txt");
  });
});

// ── Doc checklist ─────────────────────────────────────────────────────────────

describe("go-live-08 — doc checklist", () => {
  it("doc checklist exists", () => {
    const doc = readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md");
    expect(doc.length).toBeGreaterThan(500);
  });

  it("doc includes Stripe test card 4242", () => {
    expect(readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md")).toContain("4242 4242 4242 4242");
  });

  it("doc includes Stripe CLI webhook forwarding command", () => {
    const doc = readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md");
    expect(doc).toMatch(/stripe listen.*forward-to/i);
  });

  it("doc mentions /checkout?agent=pierre", () => {
    expect(readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md")).toContain("/checkout?agent=pierre");
  });

  it("doc mentions /paiement/success", () => {
    expect(readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md")).toContain("/paiement/success");
  });

  it("doc mentions /agents/pierre/setup", () => {
    expect(readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md")).toContain("/agents/pierre/setup");
  });

  it("doc mentions /agents/pierre/use", () => {
    expect(readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md")).toContain("/agents/pierre/use");
  });

  it("doc includes cancel subscription verification step", () => {
    const doc = readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md");
    expect(doc).toMatch(/cancel.*subscription|annul.*abonnement/i);
  });

  it("doc states NO live Stripe keys", () => {
    expect(readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md")).toMatch(/no.*live|sk_live_/i);
  });

  it("doc does not contain sk_live_ as a usable value", () => {
    const doc = readDoc("docs/GO_LIVE_08_PAID_CUSTOMER_TEST_MODE_E2E.md");
    expect(doc).not.toMatch(/STRIPE_SECRET_KEY=sk_live_/);
  });
});

// ── TypeScript helper unit tests ──────────────────────────────────────────────

describe("go-live-08 — paid-customer-testmode-e2e helper", () => {
  it("helper verdict includes all required fields", () => {
    const verdict = buildTestModeE2EVerdict({ stripeKeyPrefix: "sk_test_abc" });
    expect(verdict).toHaveProperty("env_ok");
    expect(verdict).toHaveProperty("stripe_test_mode_ok");
    expect(verdict).toHaveProperty("checkout_session_seen");
    expect(verdict).toHaveProperty("webhook_seen");
    expect(verdict).toHaveProperty("order_active");
    expect(verdict).toHaveProperty("pierre_access_active");
    expect(verdict).toHaveProperty("setup_access_ok");
    expect(verdict).toHaveProperty("cockpit_access_ok");
    expect(verdict).toHaveProperty("cancel_seen");
    expect(verdict).toHaveProperty("access_after_cancel_ok");
    expect(verdict).toHaveProperty("blockers");
    expect(verdict).toHaveProperty("warnings");
    expect(verdict).toHaveProperty("overall");
    expect(verdict).toHaveProperty("evidence_ref");
    expect(verdict).toHaveProperty("safety_note");
  });

  it("helper returns stripe_test_mode_ok=true for sk_test_ prefix", () => {
    const verdict = buildTestModeE2EVerdict({ stripeKeyPrefix: "sk_test_xyz" });
    expect(verdict.stripe_test_mode_ok).toBe(true);
  });

  it("helper returns stripe_test_mode_ok=false for missing prefix", () => {
    const verdict = buildTestModeE2EVerdict({});
    expect(verdict.stripe_test_mode_ok).toBe(false);
    expect(verdict.blockers.length).toBeGreaterThan(0);
  });

  it("helper blocks and returns no_go for sk_live_ prefix", () => {
    const verdict = buildTestModeE2EVerdict({ stripeKeyPrefix: "sk_live_xxx" });
    expect(verdict.stripe_test_mode_ok).toBe(false);
    expect(verdict.overall).toBe("no_go");
    expect(verdict.checkout_session_seen).toBe("blocked");
  });

  it("helper detects active order status", () => {
    const verdict = buildTestModeE2EVerdict({
      stripeKeyPrefix: "sk_test_abc",
      orderStatus: "active",
    });
    expect(verdict.order_active).toBe(true);
    expect(verdict.pierre_access_active).toBe(true);
  });

  it("helper detects trialing order status as active", () => {
    const verdict = buildTestModeE2EVerdict({
      stripeKeyPrefix: "sk_test_abc",
      orderStatus: "trialing",
    });
    expect(verdict.order_active).toBe(true);
    expect(verdict.pierre_access_active).toBe(true);
  });

  it("helper detects canceled order as non-active", () => {
    const verdict = buildTestModeE2EVerdict({
      stripeKeyPrefix: "sk_test_abc",
      orderStatus: "canceled",
    });
    expect(verdict.order_active).toBe(false);
    expect(verdict.pierre_access_active).toBe(false);
  });

  it("helper evidence_ref points to correct path", () => {
    const verdict = buildTestModeE2EVerdict({});
    expect(verdict.evidence_ref).toContain("go-live-evidence");
    expect(verdict.evidence_ref).toContain("paid-customer-testmode-e2e.txt");
  });

  it("helper safety_note mentions TEST MODE ONLY", () => {
    const verdict = buildTestModeE2EVerdict({});
    expect(verdict.safety_note).toMatch(/TEST MODE ONLY/i);
  });

  it("assertTestModeInputSafe throws for sk_live_", () => {
    expect(() => assertTestModeInputSafe({ stripeKeyPrefix: "sk_live_xxx" })).toThrow();
  });

  it("assertTestModeInputSafe does not throw for sk_test_", () => {
    expect(() => assertTestModeInputSafe({ stripeKeyPrefix: "sk_test_abc" })).not.toThrow();
  });

  it("GO_LIVE_08_TEST_PROOF_IDS contains all required proof IDs", () => {
    const ids = GO_LIVE_08_TEST_PROOF_IDS as readonly string[];
    expect(ids).toContain("STRIPE_TEST_PAYMENT_SUCCESS_E2E_VERIFIED");
    expect(ids).toContain("STRIPE_TEST_WEBHOOK_RECEIVED");
    expect(ids).toContain("PIERRE_ACCESS_AFTER_TEST_PAYMENT_VERIFIED");
    expect(ids).toContain("PIERRE_SETUP_AFTER_TEST_PAYMENT_VERIFIED");
    expect(ids).toContain("PIERRE_COCKPIT_AFTER_TEST_PAYMENT_VERIFIED");
    expect(ids).toContain("STRIPE_TEST_SUBSCRIPTION_CANCEL_VERIFIED");
    expect(ids).toContain("PIERRE_BLOCK_AFTER_TEST_CANCEL_VERIFIED");
    expect(ids).toContain("PAID_CUSTOMER_TESTMODE_E2E_COMPLETED");
  });
});

// ── Safety: no public launch flag or proof auto-verified ──────────────────────

describe("go-live-08 — no forbidden modifications", () => {
  it("PS1 script does not set B48_PUBLIC_LAUNCH_ENABLED=true", () => {
    expect(readScript("pfinal08-paid-customer-testmode-e2e.ps1")).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });

  it("MJS script does not set B48_PUBLIC_LAUNCH_ENABLED=true", () => {
    expect(readScript("paid-customer-testmode-e2e.mjs")).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });

  it("PS1 script does not call markProofVerified", () => {
    expect(readScript("pfinal08-paid-customer-testmode-e2e.ps1")).not.toMatch(/markProofVerified/);
  });

  it("MJS script does not call markProofVerified", () => {
    expect(readScript("paid-customer-testmode-e2e.mjs")).not.toMatch(/markProofVerified/);
  });

  it("PS1 script does not add forbidden claims", () => {
    const content = readScript("pfinal08-paid-customer-testmode-e2e.ps1");
    expect(content).not.toMatch(/zéro erreur/i);
    expect(content).not.toMatch(/conformité garantie/i);
    expect(content).not.toMatch(/remplace (?:un |votre )?avocat(?! ni| pas)/i);
  });
});

// ── Package script ─────────────────────────────────────────────────────────────

describe("go-live-08 — package.json script", () => {
  it("package.json has check:paid-customer-testmode script", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf-8");
    expect(pkg).toContain("check:paid-customer-testmode");
    expect(pkg).toContain("pfinal08-paid-customer-testmode-e2e.ps1");
  });
});
