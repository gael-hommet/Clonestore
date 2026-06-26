// GO-LIVE 02 -- Stripe Live Checkout Readiness Tests
// Static file-content tests. No real Stripe calls. No proof auto-verified.
// Covers: PS1 wrapper, mjs script, checkout route, webhook route, billing lib, docs.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readScript(filename: string): string {
  return readFileSync(join(ROOT, "scripts", filename), "utf-8");
}

function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, "src", relPath), "utf-8");
}

function readDoc(filename: string): string {
  return readFileSync(join(ROOT, "docs", filename), "utf-8");
}

function readPkg(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
}

// ── pfinal02-stripe-live-verify.ps1 ──────────────────────────────────────────

describe("pfinal02-stripe-live-verify.ps1 — script safety", () => {
  it("file exists and is readable", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content.length).toBeGreaterThan(0);
  });

  it("reads .env.local for Stripe keys (not $env: process variables)", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).toContain(".env.local");
  });

  it("uses STRIPE_PRICE_PIERRE — correct env var name matching the code", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).toContain("STRIPE_PRICE_PIERRE");
  });

  it("does NOT use STRIPE_PIERRE_ANNUAL_PRICE_ID as active variable (may mention in correction note)", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    // The PS1 may mention the wrong name in a correction comment — check it's not assigned or matched as a live var
    const nonCommentLines = content.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    expect(nonCommentLines).not.toContain("STRIPE_PIERRE_ANNUAL_PRICE_ID");
  });

  it("requires STRIPE_SECRET_KEY and detects sk_live_ prefix", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).toContain("STRIPE_SECRET_KEY");
    expect(content).toContain("sk_live_");
  });

  it("warns when STRIPE_SECRET_KEY is sk_test_ (test mode)", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).toContain("sk_test_");
  });

  it("requires STRIPE_WEBHOOK_SECRET with whsec_ prefix", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).toContain("STRIPE_WEBHOOK_SECRET");
    expect(content).toContain("whsec_");
  });

  it("masks Stripe secret keys — never echoes raw value", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content.toLowerCase()).toMatch(/masqu|hidden|\[set\]/i);
  });

  it("states Pierre price is 449 EUR/mois (monthly, not annual)", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).toContain("449");
    expect(content.toLowerCase()).toMatch(/mensuel|mois|monthly/i);
  });

  it("uses correct webhook URL /api/webhooks/stripe (wrong URL only appears in ATTENTION warnings)", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).toContain("/api/webhooks/stripe");
    // The PS1 may warn "pas /api/stripe/webhook" — the wrong URL should only appear in negative/warning context
    // Check it's not set as the actual recommended URL (e.g. not "URL : .../api/stripe/webhook")
    expect(content).not.toMatch(/URL\s*[:=].*\/api\/stripe\/webhook/i);
  });

  it("does NOT contact Stripe API (no Invoke-WebRequest or Invoke-RestMethod to stripe)", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content.toLowerCase()).not.toMatch(/invoke-webrequest.*stripe/i);
    expect(content.toLowerCase()).not.toMatch(/invoke-restmethod.*stripe/i);
  });

  it("does NOT auto-mark any proof as verified — all templates use status: pending", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    // All status fields must be "pending"
    const statusVerified = content.match(/"status":\s*"verified"/g);
    expect(statusVerified).toBeNull();
    expect(content).toContain('"status": "pending"');
  });

  it("does NOT set public launch flag to true", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/i);
    expect(content).not.toMatch(/CLONESTORE_PUBLIC_LAUNCH_APPROVED\s*=\s*true/i);
  });

  it("states public launch is NO-GO until all proofs are verified", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content.toUpperCase()).toMatch(/NO-GO/);
  });

  it("covers all 9 GO-LIVE 02 proof IDs", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    const proofIds = [
      "STRIPE_LIVE_SECRET_SET",
      "STRIPE_LIVE_PRICE_PIERRE_449_CREATED",
      "STRIPE_LIVE_WEBHOOK_CONFIGURED",
      "STRIPE_LIVE_CHECKOUT_TESTED",
      "STRIPE_LIVE_PAYMENT_SUCCESS_TESTED",
      "STRIPE_LIVE_PAYMENT_FAILURE_TESTED",
      "STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED",
      "PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED",
      "PIERRE_BLOCK_AFTER_CANCEL_VERIFIED",
    ];
    for (const id of proofIds) {
      expect(content).toContain(id);
    }
  });

  it("does NOT import or invoke OpenAI or Anthropic SDKs", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).not.toMatch(/Invoke-WebRequest.*openai|Invoke-RestMethod.*openai/i);
    expect(content).not.toMatch(/Invoke-WebRequest.*anthropic|Invoke-RestMethod.*anthropic/i);
  });

  it("does NOT send email (no Invoke-WebRequest to resend or smtp)", () => {
    const content = readScript("pfinal02-stripe-live-verify.ps1");
    expect(content).not.toMatch(/Invoke-WebRequest.*resend|Invoke-RestMethod.*resend/i);
    expect(content.toLowerCase()).not.toContain("smtp");
    expect(content.toLowerCase()).not.toContain("sendmail");
  });
});

// ── stripe-live-readiness.mjs ─────────────────────────────────────────────────

describe("stripe-live-readiness.mjs — Node.js ESM readiness script", () => {
  it("file exists and is readable", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content.length).toBeGreaterThan(0);
  });

  it("loads .env.local manually (not process.env only)", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).toContain(".env.local");
    expect(content).toContain("loadEnvLocal");
  });

  it("uses STRIPE_PRICE_PIERRE — correct env var name", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).toContain("STRIPE_PRICE_PIERRE");
  });

  it("does NOT reference STRIPE_PIERRE_ANNUAL_PRICE_ID (wrong name)", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).not.toContain("STRIPE_PIERRE_ANNUAL_PRICE_ID");
  });

  it("validates STRIPE_SECRET_KEY for sk_live_ prefix", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).toContain("STRIPE_SECRET_KEY");
    expect(content).toContain("sk_live_");
  });

  it("validates STRIPE_WEBHOOK_SECRET for whsec_ prefix", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).toContain("STRIPE_WEBHOOK_SECRET");
    expect(content).toContain("whsec_");
  });

  it("validates STRIPE_PRICE_PIERRE for price_ prefix", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).toContain("price_");
  });

  it("sets EXPECTED_PIERRE_PRICE_CENTS to 44900 (449.00 EUR/mois)", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).toContain("44900");
    expect(content).toContain("449");
  });

  it("detects and warns on live/test key mismatch", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content.toLowerCase()).toMatch(/mismatch|mélange|alerte/i);
  });

  it("states it does NOT contact Stripe API", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content.toLowerCase()).toMatch(/does not contact|not contact|no.*stripe api|sans.*api/i);
  });

  it("does NOT import Stripe SDK", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).not.toMatch(/import.*from\s+['"]stripe['"]/i);
    expect(content).not.toMatch(/new Stripe\(/i);
  });

  it("does NOT import OpenAI or Anthropic SDK", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).not.toMatch(/import.*from\s+['"]openai['"]/i);
    expect(content).not.toMatch(/import.*from\s+['"]@anthropic/i);
  });

  it("does NOT import Resend or email SDKs", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).not.toMatch(/import.*from\s+['"]resend['"]/i);
    expect(content.toLowerCase()).not.toContain("nodemailer");
  });

  it("writes evidence file to go-live-evidence/stripe/ (not to go-live-proofs)", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).toContain("go-live-evidence");
    expect(content).toContain("stripe-live-env-check.txt");
  });

  it("does NOT write go-live-proofs.local.json automatically", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content).not.toMatch(/writeFileSync[^;]*go-live-proofs/);
    expect(content).not.toMatch(/writeFile\([^)]*go-live-proofs/);
  });

  it("displays proof templates with all 9 proof IDs, all status: pending", () => {
    const content = readScript("stripe-live-readiness.mjs");
    const proofIds = [
      "STRIPE_LIVE_SECRET_SET",
      "STRIPE_LIVE_PRICE_PIERRE_449_CREATED",
      "STRIPE_LIVE_WEBHOOK_CONFIGURED",
      "STRIPE_LIVE_CHECKOUT_TESTED",
      "STRIPE_LIVE_PAYMENT_SUCCESS_TESTED",
      "STRIPE_LIVE_PAYMENT_FAILURE_TESTED",
      "STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED",
      "PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED",
      "PIERRE_BLOCK_AFTER_CANCEL_VERIFIED",
    ];
    for (const id of proofIds) {
      expect(content).toContain(id);
    }
    expect(content).toMatch(/status:\s*['"]pending['"]/);
    expect(content).not.toMatch(/status:\s*['"]verified['"]/);
  });

  it("states proof must be updated manually (not auto-written)", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content.toLowerCase()).toMatch(/does not write|manually|manuel/i);
  });

  it("states public launch is NO-GO", () => {
    const content = readScript("stripe-live-readiness.mjs");
    expect(content.toUpperCase()).toContain("NO-GO");
  });
});

// ── src/app/api/checkout/route.ts ─────────────────────────────────────────────

describe("checkout/route.ts — security invariants", () => {
  it("resolves price_id from process.env.STRIPE_PRICE_PIERRE (server-side only)", () => {
    const content = readSrc("app/api/checkout/route.ts");
    expect(content).toContain("process.env.STRIPE_PRICE_PIERRE");
  });

  it("does NOT accept price_id from the request body or query params", () => {
    const content = readSrc("app/api/checkout/route.ts");
    // price comes only from getPriceId(agentSlug) → process.env
    // body parsing only extracts agent_slug, never price_id or priceId
    expect(content).not.toMatch(/body\.price_id|body\.priceId|body\[.price/i);
    expect(content).not.toMatch(/searchParams.*price_id|searchParams.*priceId/i);
  });

  it("resolves user_id from Bearer token JWT (authenticate function)", () => {
    const content = readSrc("app/api/checkout/route.ts");
    expect(content).toContain("authenticate(request, supabaseAdmin)");
    expect(content).toContain("supabaseAdmin.auth.getUser(token)");
  });

  it("does NOT read user_id from the request body", () => {
    const content = readSrc("app/api/checkout/route.ts");
    expect(content).not.toMatch(/body\.user_id|body\[.user_id/i);
  });

  it("does NOT use payment_method_collection: 'if_required' (open-bar trial forbidden)", () => {
    const content = readSrc("app/api/checkout/route.ts");
    expect(content).not.toContain("if_required");
    expect(content).not.toMatch(/payment_method_collection/i);
  });

  it("sets trial_period_days from TRIAL_PERIOD_DAYS constant (not hardcoded)", () => {
    const content = readSrc("app/api/checkout/route.ts");
    expect(content).toContain("TRIAL_PERIOD_DAYS");
    expect(content).toContain("trial_period_days");
  });

  it("verifies pierre price against EXPECTED_PIERRE_PRICE_AMOUNT in production", () => {
    const content = readSrc("app/api/checkout/route.ts");
    expect(content).toContain("EXPECTED_PIERRE_PRICE_AMOUNT");
    expect(content).toContain("PRICE_MISMATCH");
  });
});

// ── src/app/api/webhooks/stripe/route.ts ────────────────────────────────────

describe("webhooks/stripe/route.ts — signature verification", () => {
  it("verifies Stripe signature via stripe.webhooks.constructEvent", () => {
    const content = readSrc("app/api/webhooks/stripe/route.ts");
    expect(content).toContain("stripe.webhooks.constructEvent");
  });

  it("reads stripe-signature header before processing any event", () => {
    const content = readSrc("app/api/webhooks/stripe/route.ts");
    expect(content).toContain('stripe-signature');
    // Must check for missing signature and return early
    expect(content).toMatch(/if.*!sig/);
  });

  it("reads STRIPE_WEBHOOK_SECRET from process.env (never hardcoded)", () => {
    const content = readSrc("app/api/webhooks/stripe/route.ts");
    expect(content).toContain("process.env.STRIPE_WEBHOOK_SECRET");
  });

  it("returns 400 if signature verification fails (not 200)", () => {
    const content = readSrc("app/api/webhooks/stripe/route.ts");
    // constructEvent is in a try/catch that returns 400 on error
    expect(content).toContain("json(400");
  });

  it("handles checkout.session.completed event", () => {
    const content = readSrc("app/api/webhooks/stripe/route.ts");
    expect(content).toContain("checkout.session.completed");
  });

  it("handles customer.subscription.deleted and marks canceled", () => {
    const content = readSrc("app/api/webhooks/stripe/route.ts");
    expect(content).toContain("customer.subscription.deleted");
    expect(content).toContain('"canceled"');
  });

  it("handles invoice.payment_failed and marks past_due", () => {
    const content = readSrc("app/api/webhooks/stripe/route.ts");
    expect(content).toContain("invoice.payment_failed");
    expect(content).toContain('"past_due"');
  });
});

// ── src/lib/billing/stripe-activation.ts ────────────────────────────────────

describe("stripe-activation.ts — constants and pure logic", () => {
  it("exports EXPECTED_PIERRE_PRICE_AMOUNT = 44900 (449.00 EUR)", () => {
    const content = readSrc("lib/billing/stripe-activation.ts");
    expect(content).toContain("EXPECTED_PIERRE_PRICE_AMOUNT = 44900");
  });

  it("exports TRIAL_PERIOD_DAYS = 7", () => {
    const content = readSrc("lib/billing/stripe-activation.ts");
    expect(content).toContain("TRIAL_PERIOD_DAYS = 7");
  });

  it("accepts trialing status as access granted", () => {
    const content = readSrc("lib/billing/stripe-activation.ts");
    expect(content).toContain('"trialing"');
    expect(content).toContain("ACTIVE_STATUSES");
  });

  it("accepts no_payment_required payment_status for trial checkout sessions", () => {
    const content = readSrc("lib/billing/stripe-activation.ts");
    expect(content).toContain("no_payment_required");
    expect(content).toContain("trialing");
  });
});

// ── docs/GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md ─────────────────────────────────

describe("docs/GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md — checklist completeness", () => {
  it("file exists and is readable", () => {
    const content = readDoc("GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md");
    expect(content.length).toBeGreaterThan(0);
  });

  it("documents STRIPE_PRICE_PIERRE (correct env var name)", () => {
    const content = readDoc("GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md");
    expect(content).toContain("STRIPE_PRICE_PIERRE");
  });

  it("does NOT use STRIPE_PIERRE_ANNUAL_PRICE_ID as required var (may warn against it)", () => {
    const content = readDoc("GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md");
    // The doc may mention the wrong name in an ATTENTION note — verify correct name is present
    expect(content).toContain("STRIPE_PRICE_PIERRE");
    // Must not list the wrong name in the env var TABLE (first column, required vars section)
    expect(content).not.toMatch(/^\|\s*`STRIPE_PIERRE_ANNUAL_PRICE_ID`/m);
  });

  it("documents correct webhook URL /api/webhooks/stripe (may warn against the wrong one)", () => {
    const content = readDoc("GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md");
    expect(content).toContain("/api/webhooks/stripe");
    // Doc may say "ATTENTION: NOT /api/stripe/webhook" — that's a correct warning. Verify the correct URL is present.
    // The route must NOT be listed in the architecture table as the active route:
    expect(content).not.toMatch(/^POST\s+\/api\/stripe\/webhook/m);
  });

  it("states Pierre price is 449 EUR/mois", () => {
    const content = readDoc("GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md");
    expect(content).toContain("449");
    expect(content.toLowerCase()).toMatch(/mensuel|mois|monthly/i);
  });

  it("documents 7-day trial requiring a card (not open-bar)", () => {
    const content = readDoc("GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md");
    expect(content).toMatch(/7.*(jours?|days?)/i);
    expect(content.toLowerCase()).toMatch(/carte requise|card required/i);
  });

  it("lists all 9 GO-LIVE 02 proof IDs", () => {
    const content = readDoc("GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md");
    const proofIds = [
      "STRIPE_LIVE_SECRET_SET",
      "STRIPE_LIVE_PRICE_PIERRE_449_CREATED",
      "STRIPE_LIVE_WEBHOOK_CONFIGURED",
      "STRIPE_LIVE_CHECKOUT_TESTED",
      "STRIPE_LIVE_PAYMENT_SUCCESS_TESTED",
      "STRIPE_LIVE_PAYMENT_FAILURE_TESTED",
      "STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED",
      "PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED",
      "PIERRE_BLOCK_AFTER_CANCEL_VERIFIED",
    ];
    for (const id of proofIds) {
      expect(content).toContain(id);
    }
  });

  it("states public launch remains false until all proofs verified", () => {
    const content = readDoc("GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md");
    expect(content).toContain("B48_PUBLIC_LAUNCH_ENABLED");
    expect(content.toLowerCase()).toMatch(/false|no-go/i);
  });

  it("documents user_id from Bearer token (never from body)", () => {
    const content = readDoc("GO_LIVE_02_STRIPE_LIVE_CHECKOUT.md");
    expect(content.toLowerCase()).toMatch(/bearer/i);
    expect(content.toLowerCase()).toMatch(/user_id.*bearer|bearer.*user_id/is);
  });
});

// ── package.json — check:stripe-live script ───────────────────────────────────

describe("package.json — GO-LIVE 02 scripts", () => {
  it("has check:stripe-live script", () => {
    const pkg = readPkg();
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts).toHaveProperty("check:stripe-live");
  });

  it("check:stripe-live references pfinal02-stripe-live-verify.ps1", () => {
    const pkg = readPkg();
    const scripts = pkg.scripts as Record<string, string>;
    const cmd = scripts["check:stripe-live"] || "";
    expect(cmd).toContain("pfinal02-stripe-live-verify.ps1");
  });

  it("check:stripe-live uses ExecutionPolicy Bypass", () => {
    const pkg = readPkg();
    const scripts = pkg.scripts as Record<string, string>;
    const cmd = scripts["check:stripe-live"] || "";
    expect(cmd.toLowerCase()).toContain("executionpolicy bypass");
  });
});
