// BLOC 3 — Preuve par lecture du source que `/api/checkout/route.ts` importe
// réellement le bridge BLOC 3 + l'appelle. Ce test interdit la régression
// "helper disponible mais jamais importé".

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CHECKOUT_ROUTE = readFileSync(
  join(__dirname, "..", "..", "..", "..", "app", "api", "checkout", "route.ts"),
  "utf8",
);

const WEBHOOK_ROUTE = readFileSync(
  join(__dirname, "..", "..", "..", "..", "app", "api", "webhooks", "stripe", "route.ts"),
  "utf8",
);

describe("BLOC 3 — preuve d'intégration /api/checkout/route.ts", () => {
  it("importe readConversionSessionId depuis @/lib/clonestore/conversion/session", () => {
    expect(CHECKOUT_ROUTE).toMatch(
      /from\s+["']@\/lib\/clonestore\/conversion\/session["']/,
    );
    expect(CHECKOUT_ROUTE).toContain("readConversionSessionId");
  });
  it("importe bridgeCheckoutStarted et buildConversionCheckoutMetadata depuis checkout-bridge", () => {
    expect(CHECKOUT_ROUTE).toMatch(
      /from\s+["']@\/lib\/clonestore\/conversion\/checkout-bridge["']/,
    );
    expect(CHECKOUT_ROUTE).toContain("bridgeCheckoutStarted");
    expect(CHECKOUT_ROUTE).toContain("buildConversionCheckoutMetadata");
  });
  it("appelle bridgeCheckoutStarted (call site, pas juste import)", () => {
    expect(CHECKOUT_ROUTE).toMatch(/bridgeCheckoutStarted\s*\(/);
  });
  it("appelle buildConversionCheckoutMetadata (call site)", () => {
    expect(CHECKOUT_ROUTE).toMatch(/buildConversionCheckoutMetadata\s*\(/);
  });
  it("lit le cookie via readConversionSessionId(request.headers.get(\"cookie\"))", () => {
    expect(CHECKOUT_ROUTE).toMatch(/readConversionSessionId\s*\(\s*request\.headers\.get\(\s*["']cookie["']/);
  });
  it("ne lit JAMAIS conversion_session_id depuis le body (politique trust the cookie)", () => {
    // Le body est lu pour agent_slug + founder_reservation_id ; on s'assure
    // qu'aucune lecture de `body.conversion_session_id` ne soit présente.
    expect(CHECKOUT_ROUTE).not.toMatch(/body\s*\.\s*conversion_session_id/);
    expect(CHECKOUT_ROUTE).not.toMatch(/body\s*\[\s*["']conversion_session_id["']\s*\]/);
  });
  it("le pont est gardé par isConversionBackendAvailable() (fail-closed)", () => {
    expect(CHECKOUT_ROUTE).toContain("isConversionBackendAvailable");
  });
});

describe("BLOC 3 — preuve d'intégration /api/webhooks/stripe/route.ts", () => {
  it("importe bridgeCheckoutCompleted, bridgePierreActivated, bridgeCheckoutFailed depuis checkout-bridge", () => {
    expect(WEBHOOK_ROUTE).toMatch(
      /from\s+["']@\/lib\/clonestore\/conversion\/checkout-bridge["']/,
    );
    expect(WEBHOOK_ROUTE).toContain("bridgeCheckoutCompleted");
    expect(WEBHOOK_ROUTE).toContain("bridgePierreActivated");
    expect(WEBHOOK_ROUTE).toContain("bridgeCheckoutFailed");
  });
  it("appelle bridgeCheckoutCompleted UNIQUEMENT si metadata['conversion_session_id'] est présent", () => {
    // Pattern attendu : meta?.["conversion_session_id"] && isConversionBackendAvailable() ... bridgeCheckoutCompleted
    expect(WEBHOOK_ROUTE).toMatch(/conversion_session_id["']\s*\]\s*&&\s*isConversionBackendAvailable\s*\(\s*\)/);
    expect(WEBHOOK_ROUTE).toMatch(/bridgeCheckoutCompleted\s*\(/);
  });
  it("appelle bridgePierreActivated SEULEMENT quand isAccessGranted(status)", () => {
    expect(WEBHOOK_ROUTE).toMatch(/isAccessGranted\s*\(\s*validation\.status\s*\)/);
    expect(WEBHOOK_ROUTE).toMatch(/bridgePierreActivated\s*\(/);
  });
  it("appelle bridgeCheckoutFailed sur invoice.payment_failed", () => {
    expect(WEBHOOK_ROUTE).toMatch(/event\.type\s*===\s*["']invoice\.payment_failed["']/);
    expect(WEBHOOK_ROUTE).toMatch(/bridgeCheckoutFailed\s*\(/);
  });
  it("le pont reste APRÈS validation Stripe (signature + checkout session valide)", () => {
    const sig = WEBHOOK_ROUTE.indexOf("validateCheckoutSession");
    const bridge = WEBHOOK_ROUTE.indexOf("bridgeCheckoutCompleted");
    expect(sig).toBeGreaterThan(-1);
    expect(bridge).toBeGreaterThan(sig); // bridge appelé APRÈS validation
  });
  it("n'expose pas conversion_session_id dans le body de la réponse 200 (no leak)", () => {
    // Les retours 200 utilisent { received: true, type, ... } — pas de session id leak.
    expect(WEBHOOK_ROUTE).not.toMatch(/json\(\s*200\s*,\s*\{[^}]*conversion_session_id/);
  });
});
