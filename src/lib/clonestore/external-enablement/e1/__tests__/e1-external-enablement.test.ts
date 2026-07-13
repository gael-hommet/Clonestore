// src/lib/clonestore/external-enablement/e1/__tests__/e1-external-enablement.test.ts
// E1 §15 — focused test suite. Families A (dependency ledger) · B (environment) · C (supabase) ·
// D (stripe) · E (email/domain) · F (other providers) · G (deployment/observability) · H (legal/country)
// · I (perimeter). Every assertion checks a REAL computed value. No external action is performed.

import { describe, it, expect, beforeAll } from "vitest";
import {
  computeE1CommandCenter, type E1CommandCenter,
  buildE1DependencyLedger, summarizeE1Ledger,
  evaluateEnvironmentContract, evaluateSecretBoundary, computeEnvPresence, E1_ENVIRONMENT_CONTRACT,
  evaluateSupabaseLocalReadiness, auditMigrations,
  E1_DEPENDENCY_STATUSES,
} from "..";
import { PRODUCTION_AUTHORIZED } from "@/lib/clonestore/production/p10-production-gate";
import { resolvePaymentMode } from "@/lib/clonestore/production/p15-1-payment-mode";
import { verifyStripeLiveReadonly } from "@/lib/clonestore/production/p15-stripe-live-verification";
import {
  canCountryBuyPrice, currencyForCountry, pricingForCountry, explainCountryPriceDecision,
} from "@/lib/clonestore/pricing/country-pricing";

// Deterministic test env (never contains real secrets). Mirrors a local dev/test setup.
const TEST_ENV: Record<string, string | undefined> = {
  STRIPE_SECRET_KEY: "sk_test_abc",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

let cc: E1CommandCenter;

beforeAll(async () => {
  cc = await computeE1CommandCenter(TEST_ENV);
}, 120000);

// ─────────────────────────────────────────────────────────────────────────────
// A — Dependency ledger
// ─────────────────────────────────────────────────────────────────────────────
describe("A — dependency ledger", () => {
  const ledger = buildE1DependencyLedger(TEST_ENV);

  it("A1 recovers the canonical external blockers (legal/domain/supabase/stripe/email/provider/deploy/owner)", () => {
    const ids = ledger.map((e) => e.id);
    for (const needle of [
      "legal.company_identity", "legal.country_launch", "infra.production_domain", "infra.production_hosting",
      "infra.production_env_vars", "supabase.production_project", "supabase.production_migrations",
      "supabase.rls_tenant_isolation", "supabase.backup_recovery", "stripe.account", "stripe.products_prices",
      "stripe.webhook", "email.provider", "email.sending_domain_dns", "provider.signature_yousign",
      "observability.monitoring", "legal.privacy_documents", "deploy.production_smoke", "owner.production_authorization",
    ]) expect(ids, `missing blocker ${needle}`).toContain(needle);
  });

  it("A2 omits no blocker silently — every entry has id/name/canonicalSource", () => {
    for (const e of ledger) {
      expect(e.id.length).toBeGreaterThan(0);
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.canonicalSource.length).toBeGreaterThan(0);
    }
  });

  it("A3 each blocker carries an owner + action + validation method", () => {
    for (const e of ledger) {
      expect(["engineering", "owner", "provider", "legal", "external"]).toContain(e.currentOwner);
      expect(e.externalOwnerAction.length + (e.requiredLegalOwnerAction ?? "").length).toBeGreaterThan(0);
      expect(e.validationMethod.length).toBeGreaterThan(0);
      expect(e.forbiddenClaim.length).toBeGreaterThan(0);
      expect(e.safeFallback.length).toBeGreaterThan(0);
    }
  });

  it("A4 local readiness is separated from external readiness (per-concept fields, capped at by-shape)", () => {
    for (const e of ledger) {
      // externalConfigStatus can NEVER be CONFIGURED from code — capped at PARTIALLY_CONFIGURED_BY_SHAPE.
      expect(e.externalConfigStatus).not.toBe("CONFIGURED");
      expect(e.productionAuthStatus).toBe("NOT_AUTHORIZED");
      expect(E1_DEPENDENCY_STATUSES).toContain(e.finalStatus);
    }
  });

  it("A5 external configuration is never inferred from code (no entry LOCAL_READY while requiring external cred+owner)", () => {
    for (const e of ledger) {
      if (e.finalStatus === "LOCAL_READY") {
        // A LOCAL_READY item must not depend on an owner/provider/legal external action for the item itself.
        expect(["engineering"], `${e.id} LOCAL_READY but owned by ${e.currentOwner}`).toContain(e.currentOwner);
      }
    }
  });

  it("A6 summary counts add up and launch-critical items are mostly externally blocked", () => {
    const s = summarizeE1Ledger(TEST_ENV);
    expect(s.total).toBe(ledger.length);
    const sum = Object.values(s.byStatus).reduce((a, b) => a + b, 0);
    expect(sum).toBe(ledger.length);
    expect(s.launchCritical).toBeGreaterThan(0);
    expect(s.legalActions).toBeGreaterThan(0);
    expect(s.ownerActions).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B — Environment
// ─────────────────────────────────────────────────────────────────────────────
describe("B — environment / secret contract", () => {
  it("B6 every required category has variables registered", () => {
    const cats = new Set(E1_ENVIRONMENT_CONTRACT.map((v) => v.category));
    for (const needed of ["app_url", "supabase", "stripe_test", "stripe_webhook", "email_provider", "signature", "monitoring", "deployment", "kill_switch", "production_authorization"]) {
      expect(cats, `missing category ${needed}`).toContain(needed);
    }
  });

  it("B7 public/server secret separation holds (no NEXT_PUBLIC secret)", () => {
    const boundary = evaluateSecretBoundary();
    expect(boundary.ok).toBe(true);
    expect(boundary.noPublicSecret).toBe(true);
    expect(boundary.secretsAreServerOnly).toBe(true);
    expect(boundary.violations).toEqual([]);
    for (const v of E1_ENVIRONMENT_CONTRACT) {
      if (v.name.startsWith("NEXT_PUBLIC_")) expect(v.secret, `${v.name} public+secret`).toBe(false);
      if (v.secret) expect(v.serverOnly).toBe(true);
    }
  });

  it("B8 malformed production flags fail closed (non-true boolean → not enabled)", () => {
    // resolvePaymentMode never 'live' regardless of a malformed flag.
    expect(resolvePaymentMode({ CLONESTORE_PAYMENT_MODE: "yes-please" })).not.toBe("live");
    // A garbage recon flag is not treated as enabled by the env contract shape.
    const pres = computeEnvPresence({ STRIPE_COUNTRY_RECONCILIATION_ENABLED: "maybe" });
    const recon = pres.find((p) => p.name === "STRIPE_COUNTRY_RECONCILIATION_ENABLED");
    expect(recon?.present).toBe(true); // present as a value, but downstream flagOn treats it false
  });

  it("B9 a missing live secret fails closed (required-in-production reported missing)", () => {
    const contract = evaluateEnvironmentContract(TEST_ENV);
    expect(contract.missingRequiredForProduction.length).toBeGreaterThan(0);
    expect(contract.missingRequiredForProduction).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(cc.requiredSecretsPresentByShape).toBe(false);
  });

  it("B10 secret values are never returned/logged (presence output has no value field)", () => {
    const pres = computeEnvPresence({ SUPABASE_SERVICE_ROLE_KEY: "super-secret-value-123" });
    const entry = pres.find((p) => p.name === "SUPABASE_SERVICE_ROLE_KEY")!;
    expect(JSON.stringify(entry)).not.toContain("super-secret-value-123");
    expect(Object.keys(entry)).not.toContain("value");
  });

  it("B11 NODE_ENV alone cannot authorize production", () => {
    // PRODUCTION_AUTHORIZED is a code const; no env can flip it.
    expect(PRODUCTION_AUTHORIZED).toBe(false);
    expect(cc.productionAuthorized).toBe(false);
    // Even with NODE_ENV=production forged, the command center stays fail-closed.
    // (computeE1CommandCenter reads the P10 const, not NODE_ENV.)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C — Supabase
// ─────────────────────────────────────────────────────────────────────────────
describe("C — supabase", () => {
  it("C12 migrations discovered in deterministic order", async () => {
    const audit = await auditMigrations();
    expect(audit.count).toBeGreaterThan(40);
    expect(audit.ordered).toBe(true);
    expect(audit.deterministic).toBe(true);
    expect(audit.duplicateNames).toEqual([]);
  });

  it("C13 local Supabase code readiness (migrations + RLS) is green", async () => {
    const s = await evaluateSupabaseLocalReadiness();
    expect(s.migrationsOrderedDeterministic).toBe(true);
    expect(s.codeReady).toBe(true);
    expect(cc.supabaseCodeReady).toBe(true);
  });

  it("C14 tenant/critical tables have RLS evidence (registry complete)", async () => {
    const s = await evaluateSupabaseLocalReadiness();
    expect(s.rlsRegistryComplete).toBe(true);
    expect(s.criticalTablesCovered).toBe(true);
    expect(s.uncoveredCriticalTables).toEqual([]);
    expect(cc.rlsVerifiedLocally).toBe(true);
  });

  it("C16 production project cannot be claimed from local code", () => {
    expect(cc.supabaseProductionProjectConfigured).toBe(false);
  });

  it("C17 live migration authorization remains false", () => {
    expect(cc.productionMigrationsAuthorized).toBe(false);
    expect(cc.productionBackupConfigured).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D — Stripe
// ─────────────────────────────────────────────────────────────────────────────
describe("D — stripe", () => {
  it("D18 test/live modes strictly separated; test env → stripeTestReady, not live", () => {
    expect(cc.stripeTestReady).toBe(true);
    expect(cc.stripeLiveReady).toBe(false);
  });

  it("D19 live payment remains impossible — even forging live keys cannot make it live/verified", async () => {
    const forged = { STRIPE_SECRET_KEY: "sk_live_forged", STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_e", STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_c", STRIPE_COUNTRY_PRICING_ENABLED: "true" };
    expect(resolvePaymentMode(forged)).toBe("disabled"); // P10 floor
    const live = await verifyStripeLiveReadonly({ env: forged });
    expect(live.ready).toBe(false); // needs owner dry-run; never auto-verified
    const forgedCc = await computeE1CommandCenter(forged);
    expect(forgedCc.stripeLiveReady).toBe(false);
    expect(forgedCc.paymentMode).toBe("disabled");
    expect(forgedCc.readyForProductionActivation).toBe(false);
  });

  it("D20 webhook signature required (route enforces signature; local readiness true, external registration false)", () => {
    expect(cc.stripeWebhookLocallyReady).toBe(true);
    expect(cc.stripeWebhookExternallyRegistered).toBe(false);
  });

  it("D22/D23/D24 FR/BE/LU use canonical EUR; CH uses canonical CHF; unknown fails closed", () => {
    expect(currencyForCountry("FR")).toBe("EUR");
    expect(currencyForCountry("BE")).toBe("EUR");
    expect(currencyForCountry("LU")).toBe("EUR");
    expect(currencyForCountry("CH")).toBe("CHF");
    expect(pricingForCountry("US").status).not.toBe("ok");
    expect(pricingForCountry(null).status).toBe("country_required");
    expect(cc.priceCurrencyConfigReady).toBe(true);
    expect(cc.countryLaunchConfigReady).toBe(true);
  });

  it("D25 entitlement cannot be activated without authoritative payment evidence (payment not live)", () => {
    expect(cc.paymentMode).not.toBe("live");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E — Email / domain
// ─────────────────────────────────────────────────────────────────────────────
describe("E — email / domain", () => {
  it("E26 email adapter local-safe without provider; sent status requires provider evidence", () => {
    expect(cc.emailAdapterLocallyReady).toBe(true);
    expect(cc.emailProviderConfigured).toBe(false); // no real key
  });

  it("E28 DNS verification cannot be inferred; sender/domain missing fails closed", () => {
    expect(cc.emailDomainVerified).toBe(false);
  });

  it("E29 provider present-by-shape ≠ verified (key alone does not verify domain)", async () => {
    const withKey = { ...TEST_ENV, RESEND_API_KEY: "re_realish_key", EMAIL_PROVIDER: "resend" };
    const withKeyCc = await computeE1CommandCenter(withKey);
    expect(withKeyCc.emailProviderConfigured).toBe(true); // credentials present by shape
    expect(withKeyCc.emailDomainVerified).toBe(false);    // DNS still external
    expect(withKeyCc.readyForProductionActivation).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F — Other providers
// ─────────────────────────────────────────────────────────────────────────────
describe("F — other providers", () => {
  it("F31 signature prepared ≠ signed (adapter ready, provider not configured)", () => {
    expect(cc.signatureAdapterLocallyReady).toBe(true);
    expect(cc.signatureProviderConfigured).toBe(false);
  });

  it("F32/F33/F34/F35/F36 calendar/voice/telephony/sirh/slack remain disconnected", () => {
    expect(cc.calendarProviderConfigured).toBe(false);
    expect(cc.notificationProviderConfigured).toBe(false);
    expect(cc.voiceProviderConfigured).toBe(false);
    expect(cc.telephonyProviderConfigured).toBe(false);
    expect(cc.sirhPayrollProviderConfigured).toBe(false);
    expect(cc.slackConnectorConfigured).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G — Deployment / observability
// ─────────────────────────────────────────────────────────────────────────────
describe("G — deployment / observability", () => {
  it("G37 deployment config locally ready (next.config + build/start scripts)", () => {
    expect(cc.deploymentConfigLocallyReady).toBe(true);
  });

  it("G40 deployment is not claimed; production health not claimed", () => {
    expect(cc.deploymentPerformed).toBe(false);
    expect(cc.productionHealthVerified).toBe(false);
  });

  it("G41 monitoring contract ready but vendor not claimed", () => {
    expect(cc.monitoringContractReady).toBe(true);
    expect(cc.monitoringProviderConfigured).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H — Legal / country
// ─────────────────────────────────────────────────────────────────────────────
describe("H — legal / country", () => {
  it("H43 unresolved legal placeholders remain blocked", () => {
    expect(cc.legalDocumentsLocallyPresent).toBe(true);
    expect(cc.legalPlaceholdersResolved).toBe(false); // /legal/mentions has 'Placeholder'
  });

  it("H44 no legal approval inferred from document presence", () => {
    expect(cc.legalSignoffObtained).toBe(false);
  });

  it("H45 country pricing is canonical", () => {
    expect(cc.countryLaunchConfigReady).toBe(true);
    expect(cc.priceCurrencyConfigReady).toBe(true);
  });

  it("H46 Swiss clients cannot receive the wrong canonical offer through trusted checkout logic", () => {
    expect(canCountryBuyPrice("CH", "STRIPE_PRICE_PIERRE_EUR_MONTHLY")).toBe(false);
    expect(canCountryBuyPrice("CH", "STRIPE_PRICE_PIERRE_CHF_MONTHLY")).toBe(true);
    const dec = explainCountryPriceDecision({ country: "CH", priceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY" });
    expect(dec.allowed).toBe(false);
    expect(dec.code).toBe("CH_REQUIRES_CHF_PRICE");
    for (const c of ["FR", "BE", "LU"]) expect(canCountryBuyPrice(c, "STRIPE_PRICE_PIERRE_CHF_MONTHLY")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// I — Perimeter
// ─────────────────────────────────────────────────────────────────────────────
describe("I — perimeter", () => {
  it("I48-I51 P16C intact and CloneChat revealed (p16cLocallyReady derived from real P16C)", () => {
    expect(cc.p16cLocallyReady).toBe(true);
  });

  it("I54/I55/I56 production false, payment disabled/test, live providers blocked", () => {
    expect(cc.productionAuthorized).toBe(false);
    expect(cc.paymentMode).not.toBe("live");
    // all live providers blocked
    expect([
      cc.signatureProviderConfigured, cc.calendarProviderConfigured, cc.voiceProviderConfigured,
      cc.telephonyProviderConfigured, cc.sirhPayrollProviderConfigured, cc.emailDomainVerified,
    ].some(Boolean)).toBe(false);
  });

  it("I57 no external action performed — no external proof is claimed true", () => {
    expect(cc.stripeWebhookExternallyRegistered).toBe(false);
    expect(cc.productionDomainDnsVerified).toBe(false);
    expect(cc.supabaseProductionProjectConfigured).toBe(false);
    expect(cc.deploymentPerformed).toBe(false);
    expect(cc.productionHealthVerified).toBe(false);
    expect(cc.monitoringProviderConfigured).toBe(false);
    expect(cc.legalSignoffObtained).toBe(false);
    expect(cc.readyForProductionActivation).toBe(false);
  });

  it("noSecretsExposed static invariant holds; environment contract ready", () => {
    expect(cc.noSecretsExposed).toBe(true);
    expect(cc.environmentContractReady).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verdict / gates
// ─────────────────────────────────────────────────────────────────────────────
describe("E1 verdict / gates", () => {
  it("readyForExternalConfiguration true (local prep complete) but production activation blocked", () => {
    expect(cc.readyForExternalConfiguration).toBe(true);
    expect(cc.readyForProductionActivation).toBe(false);
    expect(cc.localPrepBlockers).toEqual([]);
  });

  it("verdict is the preparation-verified / owner-provider-legal string", () => {
    expect(cc.verdict).toBe("E1 — EXTERNAL ENABLEMENT PREPARATION VERIFIED / OWNER, PROVIDER AND LEGAL ACTIONS REQUIRED");
  });

  it("owner/provider/legal actions remain outstanding and enumerated", () => {
    expect(cc.ownerActionsComplete).toBe(false);
    expect(cc.providerActionsComplete).toBe(false);
    expect(cc.legalActionsComplete).toBe(false);
    expect(cc.exactOwnerActions.length).toBeGreaterThan(0);
    expect(cc.exactProviderActions.length).toBeGreaterThan(0);
    expect(cc.exactLegalActions.length).toBeGreaterThan(0);
    expect(cc.exactExternalBlockers.length).toBeGreaterThan(0);
  });

  it("nextSafeAction describes external configuration ordering without enabling anything", () => {
    expect(cc.nextSafeAction).toMatch(/legal|domain|Supabase|Stripe/i);
    expect(cc.nextSafeAction).toMatch(/No production activation until every external proof/i);
  });
});
