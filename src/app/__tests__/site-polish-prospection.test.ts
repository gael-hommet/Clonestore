// Site Polish — prospection readiness — non-regression tests.
// Static file content + pure-logic tests. No AI, Supabase, Stripe or real data.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  PUBLIC_EMPLOYEES,
  FUTURE_DEPARTMENTS,
  RETIRED_PUBLIC_SLUGS,
  EMPLOYEE_PRICE,
  isPublicEmployeeSlug,
  getActiveEmployees,
  getActivationCta,
} from "@/lib/catalog/public-catalog";
import { isCloneChatEnabled } from "@/lib/features/product-availability";

const ROOT = process.cwd();
const readSrc = (rel: string) => readFileSync(join(ROOT, "src", rel), "utf-8");

// ── Source de vérité commerciale unique ───────────────────────────────────────

describe("public-catalog — single source of truth", () => {
  it("Pierre is the only active employee", () => {
    const active = getActiveEmployees();
    expect(active).toHaveLength(1);
    expect(active[0].slug).toBe("pierre");
    expect(active[0].status).toBe("active");
  });

  it("price reference is 449 € HT/mois (from commercial-state)", () => {
    expect(EMPLOYEE_PRICE).toMatch(/449/);
    expect(EMPLOYEE_PRICE).toContain("HT");
  });

  it("Clara is NOT on the public surface", () => {
    expect(isPublicEmployeeSlug("clara")).toBe(false);
    expect(PUBLIC_EMPLOYEES.some((e) => e.slug === "clara")).toBe(false);
    expect(RETIRED_PUBLIC_SLUGS).toContain("clara");
  });

  it("no other employee is named publicly (Emma/Lucas/Sophie/Alex/Noah/Adrien)", () => {
    for (const slug of ["emma", "lucas", "sophie", "alex", "noah", "adrien"]) {
      expect(isPublicEmployeeSlug(slug)).toBe(false);
      expect(RETIRED_PUBLIC_SLUGS).toContain(slug);
    }
  });

  it("Pierre is the only named public employee", () => {
    expect(PUBLIC_EMPLOYEES.map((e) => e.slug)).toEqual(["pierre"]);
  });

  it("future is shown as nameless departments (no employee name, no price, no date)", () => {
    expect(FUTURE_DEPARTMENTS.length).toBeGreaterThan(0);
    const blob = JSON.stringify(FUTURE_DEPARTMENTS).toLowerCase();
    for (const name of ["emma", "lucas", "sophie", "clara", "alex", "noah"]) {
      expect(blob).not.toContain(name);
    }
    expect(blob).not.toContain("449");
  });

  it("Pierre is never positioned as a simple assistant", () => {
    const pierre = PUBLIC_EMPLOYEES.find((e) => e.slug === "pierre")!;
    expect(pierre.role.toLowerCase()).toContain("rh");
    expect(pierre.role.toLowerCase()).not.toContain("assistant");
  });

  it("activation CTA is phase-aware (reservation before launch, activation after)", () => {
    expect(getActivationCta("before_launch")).toEqual({
      label: "Réserver Pierre",
      href: "/reserver/pierre",
    });
    expect(getActivationCta("launched").href).toContain("/checkout");
  });
});

// ── Boutique : Clara retirée, prix depuis la source ───────────────────────────

describe("boutique — Clara removed, single price source", () => {
  it("/agents reads the price from the catalog (no hardcoded old format)", () => {
    const page = readSrc("app/agents/page.tsx");
    expect(page).toContain("EMPLOYEE_PRICE");
    expect(page).not.toContain("449€/mois"); // old un-normalized format
  });

  it("/agents names no employee other than Pierre", () => {
    const page = readSrc("app/agents/page.tsx");
    for (const name of ["clara", "emma", "lucas", "sophie", "alex", "noah", "adrien"]) {
      expect(page.toLowerCase()).not.toContain(name);
    }
  });

  it("retired agent routes redirect to the boutique", () => {
    for (const slug of ["clara", "alex", "noah"]) {
      const page = readSrc(`app/agents/${slug}/page.tsx`);
      expect(page).toContain('redirect("/agents")');
    }
  });

  it("the dynamic [slug] detail page no longer leaks internal design notes", () => {
    const page = readSrc("app/agents/[slug]/page.tsx");
    expect(page).not.toMatch(/cette (page|fiche) doit/i);
    expect(page).not.toMatch(/vision produit/i);
    expect(page).not.toMatch(/référence affichée/i);
  });
});

// ── CloneChat : bloqué par défaut (serveur + API), page intacte ───────────────

describe("CloneChat — really blocked while disabled", () => {
  const original = process.env.CLONECHAT_ENABLED;

  beforeEach(() => {
    delete process.env.CLONECHAT_ENABLED;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.CLONECHAT_ENABLED;
    else process.env.CLONECHAT_ENABLED = original;
  });

  it("is disabled by default (no env)", () => {
    expect(isCloneChatEnabled()).toBe(false);
  });

  it("is enabled only via an explicit env flag", () => {
    process.env.CLONECHAT_ENABLED = "true";
    expect(isCloneChatEnabled()).toBe(true);
    process.env.CLONECHAT_ENABLED = "false";
    expect(isCloneChatEnabled()).toBe(false);
  });

  it("the assistant API returns 503 when disabled", async () => {
    const { GET } = await import("@/app/api/assistant/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("CLONECHAT_DISABLED");
  });

  it("a server layout gates the page (page source untouched)", () => {
    const layout = readSrc("app/assistant/layout.tsx");
    expect(layout).toContain("isCloneChatEnabled");
    expect(layout).toContain("AccessLockScreen");
    // The visually-perfect page must still contain its own UI (not replaced).
    const page = readSrc("app/assistant/page.tsx");
    expect(page).toContain("clonechat");
  });
});

// ── Machine à états d'accès + gardes serveur ──────────────────────────────────

describe("operational access — centralized state machine", () => {
  it("only employee_active unlocks operations", async () => {
    const { isOperationalUnlocked, buildOperationalLock } = await import(
      "@/lib/access/operational-access"
    );
    expect(isOperationalUnlocked("employee_active")).toBe(true);
    expect(buildOperationalLock("employee_active", "cockpit")).toBeNull();
    for (const state of [
      "authenticated_without_employee",
      "payment_pending",
      "activation_pending",
      "subscription_suspended",
      "subscription_ended",
    ] as const) {
      expect(isOperationalUnlocked(state)).toBe(false);
      const lock = buildOperationalLock(state, "cockpit");
      expect(lock).not.toBeNull();
      expect(lock!.actions.length).toBeGreaterThan(0);
    }
  });

  it("payment/activation pending shows an 'in progress' screen (not a no-employee lock)", async () => {
    const { buildOperationalLock } = await import("@/lib/access/operational-access");
    expect(buildOperationalLock("payment_pending", "cockpit")!.title).toMatch(/paiement/i);
    expect(buildOperationalLock("activation_pending", "cockpit")!.title).toMatch(/activation/i);
    expect(buildOperationalLock("authenticated_without_employee", "cockpit")!.title).toMatch(
      /s'active avec votre premier employé/i,
    );
  });

  it("messages route gates directly; cockpit route gates via the unified shell", () => {
    const messages = readSrc("app/profile/messages/layout.tsx");
    expect(messages).toContain("resolveOperationalAccess");
    expect(messages).toContain("buildOperationalLock");
    expect(messages).toContain("AccessLockScreen");

    // The cockpit gate lives in OperationalRouteShell (unified app shell + lock).
    const cockpit = readSrc("app/agents/pierre/use/layout.tsx");
    expect(cockpit).toContain("OperationalRouteShell");
    const shell = readSrc("components/app/OperationalRouteShell.tsx");
    expect(shell).toContain("resolveOperationalAccess");
    expect(shell).toContain("buildOperationalLock");
    expect(shell).toContain("AccessLockScreen");
  });
});

// ── App shell connecté unifié + navigation unique ─────────────────────────────

describe("connected app shell — unified, single navigation", () => {
  it("isConnectedRoute covers profile + Pierre operational routes (not the public fiche)", async () => {
    const { isConnectedRoute } = await import("@/lib/nav/connected-routes");
    for (const p of [
      "/profile",
      "/profile/messages",
      "/agents/pierre/use",
      "/agents/pierre/setup",
      "/agents/pierre/employees",
    ]) {
      expect(isConnectedRoute(p)).toBe(true);
    }
    // Public surfaces keep the public header.
    for (const p of ["/", "/agents", "/agents/pierre", "/demo/pierre", "/questions"]) {
      expect(isConnectedRoute(p)).toBe(false);
    }
  });

  it("the public header hides itself on connected routes", () => {
    const header = readSrc("components/site/site-header.tsx");
    expect(header).toContain("isConnectedRoute");
    expect(header).toMatch(/isConnectedRoute\([^)]*\)\s*\)\s*\{\s*return null/);
  });

  it("all Pierre operational routes use the unified OperationalRouteShell", () => {
    for (const rel of [
      "app/agents/pierre/use/layout.tsx",
      "app/agents/pierre/setup/layout.tsx",
      "app/agents/pierre/employees/layout.tsx",
    ]) {
      expect(readSrc(rel)).toContain("OperationalRouteShell");
    }
  });

  it("the app shell exposes logo, site return and logout", () => {
    const shell = readSrc("components/app/AppShell.tsx");
    expect(shell).toContain("Se déconnecter");
    expect(shell).toContain("Retour au site");
    expect(shell).toContain("signOut");
  });
});

// ── Cockpit actif : une seule navigation latérale principale ──────────────────

describe("active cockpit — single main lateral navigation (no double rail)", () => {
  it("the cockpit shell uses a horizontal workspace tab bar, not a second left rail", () => {
    const shell = readSrc("app/agents/pierre/use/components/PierreCockpitShell.tsx");
    expect(shell).toContain("WorkspaceTabBar");
    // The vertical LeftRail (second main sidebar) is removed.
    expect(shell).not.toMatch(/function LeftRail/);
    expect(shell).not.toMatch(/<LeftRail\b/);
  });

  it("the cockpit can be rendered for QA via the NODE_ENV-gated bypass (never in prod)", () => {
    const page = readSrc("app/agents/pierre/use/page.tsx");
    expect(page).toContain("isAuthBypassEnabled");
    const hook = readSrc("app/agents/pierre/use/hooks/usePierreCockpit.ts");
    expect(hook).toContain("isAuthBypassEnabled");
  });
});

// ── Droit opérationnel canonique + test mechanism ─────────────────────────────

describe("operational access — canonical entitlement + safe test override", () => {
  it("uses hasPierreAccess as the canonical active decision", () => {
    const src = readSrc("lib/access/operational-access.ts");
    expect(src).toContain("hasPierreAccess");
    // honest rename: no fake read-only state
    expect(src).not.toContain("subscription_ended_readonly");
    expect(src).toContain("subscription_ended");
  });

  it("the dev state override is gated by NODE_ENV (never in production)", () => {
    const src = readSrc("lib/access/operational-access.ts");
    expect(src).toMatch(/NODE_ENV === "production"\)\s*return null/);
  });

  it("the auth bypass is gated by NODE_ENV (never in production)", () => {
    const src = readSrc("lib/auth/dev-bypass.ts");
    expect(src).toMatch(/NODE_ENV !== "production"/);
  });
});

// ── Régressions CSS (sticky + contraste bouton) ───────────────────────────────

describe("CSS — no sticky-breaking body scroll container", () => {
  it("globals.css does not make <body> a scroll container", () => {
    const css = readSrc("app/globals.css");
    expect(css).not.toMatch(/body\s*\{[^}]*overflow-y:\s*auto/);
  });

  it("appearance.css keeps the dark button readable on the graphite theme", () => {
    const css = readSrc("app/styles/appearance.css");
    // The graphite override must NOT force dark text on the dark button.
    expect(css).not.toMatch(/graphite"\]\s*\.clone-liquid-button--dark\s*\{[^}]*#151923/);
  });
});
