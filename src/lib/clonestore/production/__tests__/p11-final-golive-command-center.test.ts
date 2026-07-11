// src/lib/clonestore/production/__tests__/p11-final-golive-command-center.test.ts
// P11 §9 — final go-live readiness + command center: fail-closed, no LAUNCHED without deploy proof.
import { describe, it, expect } from "vitest";
import { evaluateP11FinalGoLiveReadiness, readOwnerApproval } from "../p11-final-golive-readiness";
import { evaluateP11CommandCenter } from "../p11-final-golive-command-center";

// Env réel (rien de configuré) → tout externe/owner en attente → NOT_READY.
const EMPTY: NodeJS.ProcessEnv = {} as never;

// Env où l'owner a attesté TOUS les items techniques externes (dry-runs/reviews faits) MAIS pas le sign-off.
const ALL_EXTERNAL_VERIFIED: NodeJS.ProcessEnv = {
  STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_eur", STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_chf",
  STRIPE_COUNTRY_PRICING_ENABLED: "true", CLONESTORE_STRIPE_LIVE_VERIFIED: "true",
  CLONESTORE_LEGAL_REVIEW_PROOF: "true", CLONESTORE_TAX_REVIEW_PROOF: "true",
  CLONESTORE_SIGNATURE_PROVIDER: "yousign", CLONESTORE_SIGNATURE_API_URL: "https://api.yousign.com",
  CLONESTORE_SIGNATURE_API_KEY: "k", CLONESTORE_SIGNATURE_WEBHOOK_SECRET: "w", CLONESTORE_SIGNATURE_LIVE_VERIFIED: "true",
  CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED: "true", CLONESTORE_MONITORING_ROLLBACK_VERIFIED: "true",
} as never;

const withOwner = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => ({ ...env, CLONESTORE_OWNER_GOLIVE_APPROVED: "true", CLONESTORE_OWNER_GOLIVE_APPROVED_BY: "Owner Name" } as never);

describe("P11 final go-live readiness + command center", () => {
  it("current/empty env → NOT_READY, production NOT authorized, launches false", () => {
    const cc = evaluateP11CommandCenter(EMPTY);
    expect(cc.globalStatus).toBe("NOT_READY");
    expect(cc.productionAuthorized).toBe(false);
    expect(cc.publicLaunchAllowed).toBe(false);
    expect(cc.privatePilotAllowed).toBe(false);
    expect(cc.paidCustomerAllowed).toBe(false);
    expect(cc.ownerApprovalRequired).toBe(true);
    expect(cc.blockersCount).toBeGreaterThan(0);
    expect(cc.missingProofs.length).toBeGreaterThan(0);
  });

  it("finalVerdict for empty env = TECHNICAL_READINESS_VERIFIED_EXTERNAL_GOLIVE_BLOCKED", () => {
    const r = evaluateP11FinalGoLiveReadiness(EMPTY);
    expect(r.finalVerdict).toBe("TECHNICAL_READINESS_VERIFIED_EXTERNAL_GOLIVE_BLOCKED");
    expect(r.productionAuthorized).toBe(false);
    expect(r.runtimeProductionAuthorizedConst).toBe(false); // P10 const stays false (defense in depth)
  });

  it("owner approval is derived from an explicit artifact, never hardcoded", () => {
    expect(readOwnerApproval(EMPTY).artifactPresent).toBe(false);
    expect(readOwnerApproval({ CLONESTORE_OWNER_GOLIVE_APPROVED: "true" } as never).artifactPresent).toBe(false); // needs signer too
    const ok = readOwnerApproval({ CLONESTORE_OWNER_GOLIVE_APPROVED: "true", CLONESTORE_OWNER_GOLIVE_APPROVED_BY: "X" } as never);
    expect(ok.artifactPresent).toBe(true);
    expect(ok.signer).toBe("X");
  });

  it("all external verified but NO owner sign-off → READY_FOR_OWNER_REVIEW (still not authorized)", () => {
    const cc = evaluateP11CommandCenter(ALL_EXTERNAL_VERIFIED);
    expect(cc.globalStatus).toBe("READY_FOR_OWNER_REVIEW");
    expect(cc.productionAuthorized).toBe(false);
    expect(cc.publicLaunchAllowed).toBe(false);
    expect(cc.ownerApprovalRequired).toBe(true);
  });

  it("all external verified + owner sign-off, NO deploy proof → OWNER_APPROVED_READY_TO_LAUNCH (never LAUNCHED)", () => {
    const cc = evaluateP11CommandCenter(withOwner(ALL_EXTERNAL_VERIFIED));
    expect(cc.globalStatus).toBe("OWNER_APPROVED_READY_TO_LAUNCH");
    expect(cc.publicLaunchAllowed).toBe(false); // still not launched (no deploy proof)
    expect(cc.paidCustomerAllowed).toBe(false);
  });

  it("P10 const is a HARD FLOOR: all external + owner + deploy proof but const=false → stays OWNER_APPROVED_READY_TO_LAUNCH, NOT LAUNCHED, productionAuthorized false", () => {
    const cc = evaluateP11CommandCenter({ ...withOwner(ALL_EXTERNAL_VERIFIED), CLONESTORE_DEPLOY_PROOF: "true" } as never);
    // LAUNCHED + productionAuthorized require the P10 runtime const (false) → unreachable via env flags.
    expect(cc.globalStatus).toBe("OWNER_APPROVED_READY_TO_LAUNCH");
    expect(cc.globalStatus).not.toBe("LAUNCHED");
    expect(cc.productionAuthorized).toBe(false); // hard floor: deliberate code change required
    expect(cc.publicLaunchAllowed).toBe(false);
  });

  it("a single missing external item (e.g. CHF price) drops back to NOT_READY", () => {
    const cc = evaluateP11CommandCenter({ ...withOwner(ALL_EXTERNAL_VERIFIED), STRIPE_PRICE_PIERRE_CHF_MONTHLY: "" } as never);
    expect(cc.globalStatus).toBe("NOT_READY");
    expect(cc.productionAuthorized).toBe(false);
  });

  it("test Stripe key can never satisfy stripe live even with the verified flag", () => {
    const cc = evaluateP11CommandCenter({ ...withOwner(ALL_EXTERNAL_VERIFIED), STRIPE_SECRET_KEY: "sk_test_x" } as never);
    expect(cc.dimensions.stripeLive).toBe(false);
    expect(cc.globalStatus).toBe("NOT_READY");
  });
});
