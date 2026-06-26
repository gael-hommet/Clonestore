// GO-LIVE 09 — First Customer Onboarding & Activation Polish Tests
// Static content tests only. No Stripe. No Supabase. No OpenAI. No Anthropic.
// Only readFileSync (NOT existsSync — causes TypeError in Vitest).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readPage(relPath: string): string {
  return readFileSync(join(ROOT, "src/app", relPath), "utf-8");
}

function readDoc(relPath: string): string {
  return readFileSync(join(ROOT, "docs", relPath), "utf-8");
}

// ── /paiement/success page ────────────────────────────────────────────────────

describe("go-live-09 — /paiement/success page", () => {
  it("success page exists", () => {
    const content = readPage("paiement/success/page.tsx");
    expect(content.length).toBeGreaterThan(500);
  });

  it("Configurer Pierre CTA points to /agents/pierre/setup (not /use)", () => {
    const content = readPage("paiement/success/page.tsx");
    // The "Configurer Pierre" button must link to /agents/pierre/setup
    expect(content).toMatch(/href="\/agents\/pierre\/setup"[\s\S]{0,200}Configurer Pierre|Configurer Pierre[\s\S]{0,200}href="\/agents\/pierre\/setup"/);
  });

  it("Configurer Pierre CTA does NOT point to /agents/pierre/use", () => {
    const content = readPage("paiement/success/page.tsx");
    // No ActionButton with label "Configurer Pierre" pointing to /use
    // The href /agents/pierre/use is allowed for "Accéder à Pierre" button
    const configurerBlock = content.match(/label="Configurer Pierre"[\s\S]{0,300}/)?.[0] ?? "";
    expect(configurerBlock).not.toContain('href="/agents/pierre/use"');
  });

  it("Step card is named Empreinte Entreprise (not just Configuration)", () => {
    const content = readPage("paiement/success/page.tsx");
    expect(content).toContain("Empreinte Entreprise");
  });

  it("Step card text mentions identity/rules/valideurs", () => {
    const content = readPage("paiement/success/page.tsx");
    expect(content).toMatch(/identit|r.gles|valideurs|ton/i);
  });

  it("activation states include checking, active, pending, unauthenticated", () => {
    const content = readPage("paiement/success/page.tsx");
    expect(content).toContain('"checking"');
    expect(content).toContain('"active"');
    expect(content).toContain('"pending"');
    expect(content).toContain('"unauthenticated"');
  });

  it("auto-retry mechanism present (retryCount)", () => {
    expect(readPage("paiement/success/page.tsx")).toContain("retryCount");
  });

  it("calls /api/checkout/confirm on mount", () => {
    expect(readPage("paiement/success/page.tsx")).toContain("/api/checkout/confirm");
  });

  it("calls /api/checkout for status check", () => {
    expect(readPage("paiement/success/page.tsx")).toContain("/api/checkout");
  });

  it("Accéder à Pierre CTA links to /agents/pierre/use", () => {
    const content = readPage("paiement/success/page.tsx");
    expect(content).toContain("/agents/pierre/use");
  });

  it("page does not contain raw sk_live_ or stripe secret", () => {
    const content = readPage("paiement/success/page.tsx");
    expect(content).not.toMatch(/sk_live_|sk_test_/);
  });
});

// ── /agents/pierre/use cockpit page ──────────────────────────────────────────

describe("go-live-09 — /agents/pierre/use cockpit access gate", () => {
  it("cockpit page exists", () => {
    const content = readPage("agents/pierre/use/page.tsx");
    expect(content.length).toBeGreaterThan(200);
  });

  it("cockpit page has NoAccessGate component", () => {
    expect(readPage("agents/pierre/use/page.tsx")).toContain("NoAccessGate");
  });

  it("cockpit page has CockpitWrapper component", () => {
    expect(readPage("agents/pierre/use/page.tsx")).toContain("CockpitWrapper");
  });

  it("NoAccessGate links to /checkout?agent=pierre for activation", () => {
    const content = readPage("agents/pierre/use/page.tsx");
    expect(content).toContain("/checkout?agent=pierre");
  });

  it("access check uses /api/checkout endpoint", () => {
    expect(readPage("agents/pierre/use/page.tsx")).toContain("/api/checkout");
  });

  it("access check reads Supabase session token", () => {
    const content = readPage("agents/pierre/use/page.tsx");
    expect(content).toContain("getSessionClient");
    expect(content).toContain("getSession");
  });

  it("access states include checking, active, no_access, unauthenticated", () => {
    const content = readPage("agents/pierre/use/page.tsx");
    expect(content).toContain('"checking"');
    expect(content).toContain('"active"');
    expect(content).toContain('"no_access"');
    expect(content).toContain('"unauthenticated"');
  });

  it("usePierreCockpit is only called inside CockpitWrapper", () => {
    const content = readPage("agents/pierre/use/page.tsx");
    // usePierreCockpit must be inside CockpitWrapper function, not in top-level page
    const wrapperBlock = content.match(/function CockpitWrapper[\s\S]+?^}/m)?.[0] ?? "";
    expect(wrapperBlock).toContain("usePierreCockpit");
  });

  it("cockpit page uses Suspense boundary", () => {
    expect(readPage("agents/pierre/use/page.tsx")).toContain("Suspense");
  });

  it("NoAccessGate does not leak Stripe or payment internals", () => {
    const content = readPage("agents/pierre/use/page.tsx");
    expect(content).not.toMatch(/sk_live_|sk_test_|STRIPE_SECRET/);
  });

  it("cockpit page does not call OpenAI or Anthropic", () => {
    const content = readPage("agents/pierre/use/page.tsx");
    expect(content).not.toMatch(/api\.openai\.com|api\.anthropic\.com/);
  });

  it("NoAccessGate links to /profile as fallback", () => {
    expect(readPage("agents/pierre/use/page.tsx")).toContain('href="/profile"');
  });
});

// ── /agents/pierre/setup page ─────────────────────────────────────────────────

describe("go-live-09 — /agents/pierre/setup onboarding banner", () => {
  it("setup page exists", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content.length).toBeGreaterThan(1000);
  });

  it("setup page contains onboarding welcome banner", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content).toMatch(/Bienvenue|onboarding|configur.*quelques minutes/i);
  });

  it("onboarding banner lists 4 steps", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content).toContain("1.");
    expect(content).toContain("2.");
    expect(content).toContain("3.");
    expect(content).toContain("4.");
  });

  it("setup page contains first mission suggestions section", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content).toMatch(/premi.res missions|mission.*sugg/i);
  });

  it("mission suggestions only shown on saveState === success", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content).toMatch(/saveState.*success|success.*saveState/);
  });

  it("mission templates include CDI contract suggestion", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content).toMatch(/contrat CDI|CDI/i);
  });

  it("mission templates include onboarding email suggestion", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content).toMatch(/onboarding|email.*bienvenue|bienvenue.*email/i);
  });

  it("mission templates link to /agents/pierre/use cockpit", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content).toContain("/agents/pierre/use");
  });

  it("setup page contains Empreinte Entreprise label", () => {
    expect(readPage("agents/pierre/setup/page.tsx")).toContain("Empreinte Entreprise");
  });

  it("setup page does not call OpenAI or Anthropic", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content).not.toMatch(/api\.openai\.com|api\.anthropic\.com/);
  });
});

// ── /profile/agents page ─────────────────────────────────────────────────────

describe("go-live-09 — /profile/agents isActiveOrder trialing fix", () => {
  it("profile agents page exists", () => {
    const content = readPage("profile/agents/page.tsx");
    expect(content.length).toBeGreaterThan(500);
  });

  it("isActiveOrder includes trialing status", () => {
    const content = readPage("profile/agents/page.tsx");
    expect(content).toMatch(/isActiveOrder[\s\S]{0,200}trialing/);
  });

  it("isActiveOrder handles both active and trialing", () => {
    const content = readPage("profile/agents/page.tsx");
    const fn = content.match(/function isActiveOrder[\s\S]+?^}/m)?.[0] ?? "";
    expect(fn).toContain("active");
    expect(fn).toContain("trialing");
  });

  it("isActiveOrder does not use === active only (regression guard)", () => {
    const content = readPage("profile/agents/page.tsx");
    const fn = content.match(/function isActiveOrder[\s\S]+?^}/m)?.[0] ?? "";
    // Must not be a single-condition check (would miss trialing)
    expect(fn).not.toMatch(/=== "active"\s*;?\s*\}/);
  });
});

// ── Doc checklist ─────────────────────────────────────────────────────────────

describe("go-live-09 — doc checklist", () => {
  it("doc exists", () => {
    const doc = readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md");
    expect(doc.length).toBeGreaterThan(500);
  });

  it("doc includes access state matrix with 6 states", () => {
    const doc = readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md");
    expect(doc).toContain("not_authenticated");
    expect(doc).toContain("not_paid");
    expect(doc).toContain("payment_pending");
    expect(doc).toContain("active_not_configured");
    expect(doc).toContain("active_configured");
    expect(doc).toContain("canceled");
  });

  it("doc mentions trialing in active order definition", () => {
    expect(readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md")).toContain("trialing");
  });

  it("doc references /paiement/success", () => {
    expect(readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md")).toContain("/paiement/success");
  });

  it("doc references /agents/pierre/setup", () => {
    expect(readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md")).toContain("/agents/pierre/setup");
  });

  it("doc references /agents/pierre/use", () => {
    expect(readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md")).toContain("/agents/pierre/use");
  });

  it("doc lists fixes applied in GO-LIVE 09", () => {
    const doc = readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md");
    expect(doc).toMatch(/fixes applied|fix/i);
  });

  it("doc states no live Stripe keys", () => {
    const doc = readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md");
    expect(doc).toMatch(/no stripe live|sk_live_/i);
  });

  it("doc does not contain sk_live_ as a usable value", () => {
    const doc = readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md");
    expect(doc).not.toMatch(/STRIPE_SECRET_KEY=sk_live_/);
  });

  it("doc includes proof IDs", () => {
    const doc = readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md");
    expect(doc).toContain("GOLIVE_09_FIRST_CUSTOMER_ONBOARDING_COMPLETED");
  });

  it("doc does not make forbidden claims", () => {
    const doc = readDoc("GO_LIVE_09_FIRST_CUSTOMER_ONBOARDING.md");
    expect(doc).not.toMatch(/z.ro erreur/i);
    expect(doc).not.toMatch(/conformit. garantie/i);
    expect(doc).not.toMatch(/remplace (?:un |votre )?avocat(?! ni| pas)/i);
  });
});

// ── Safety — no forbidden modifications ──────────────────────────────────────

describe("go-live-09 — no forbidden modifications", () => {
  it("cockpit page does not set B48_PUBLIC_LAUNCH_ENABLED=true", () => {
    expect(readPage("agents/pierre/use/page.tsx")).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });

  it("success page does not call markProofVerified", () => {
    expect(readPage("paiement/success/page.tsx")).not.toMatch(/markProofVerified/);
  });

  it("setup page does not contain forbidden claims", () => {
    const content = readPage("agents/pierre/setup/page.tsx");
    expect(content).not.toMatch(/z.ro erreur/i);
    expect(content).not.toMatch(/conformit. garantie/i);
    expect(content).not.toMatch(/remplace (?:un |votre )?avocat(?! ni| pas)/i);
  });

  it("no file uses 'Logo' as component/type name in golive-09 files", () => {
    const files = [
      "agents/pierre/use/page.tsx",
      "paiement/success/page.tsx",
    ];
    for (const f of files) {
      const content = readPage(f);
      expect(content).not.toMatch(/(?:function|type|const|interface)\s+Logo/);
    }
  });

  it("cockpit page does not send real email", () => {
    expect(readPage("agents/pierre/use/page.tsx")).not.toMatch(/resend\.com|sendEmail.*live/i);
  });
});
