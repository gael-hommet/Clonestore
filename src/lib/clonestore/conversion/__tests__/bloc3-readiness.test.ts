import { describe, it, expect } from "vitest";
import { buildB3ConversionVerdict } from "../readiness";
import { LEADFORGE_FIXTURE_FINGERPRINT } from "../contract";

describe("BLOC 3 — readiness gate evidence-based", () => {
  it("verdict par défaut sans evidence → BLOCKED_MISSING_EVIDENCE", () => {
    const r = buildB3ConversionVerdict();
    expect(r.verdict).toBe("V0_CONVERSION_ENGINE_BLOCKED_MISSING_EVIDENCE");
    expect(r.leadforge_commit).toBe("db9b166");
    expect(r.fixture_fingerprint).toBe(LEADFORGE_FIXTURE_FINGERPRINT);
    expect(r.failed_checks.length).toBeGreaterThan(0);
  });

  it("première preuve manquante → verdict spécifique à cette preuve", () => {
    const r = buildB3ConversionVerdict({
      fixtureFingerprintMatches: false,
      parityWithFixture: true,
    });
    expect(r.verdict).toBe("V0_CONVERSION_ENGINE_BLOCKED_CONTRACT_DRIFT");
  });

  it("verdict CODE_READY UNIQUEMENT quand TOUTES les preuves sont true", () => {
    const r = buildB3ConversionVerdict({
      fixtureFingerprintMatches: true,
      parityWithFixture: true,
      tokenVectorsPass: true,
      storageFailsClosedInProd: true,
      checkoutRouteBridged: true,
      webhookRouteBridged: true,
      tenancyAttachWired: true,
      surfaceEventsWired: true,
      demoContractPass: true,
      diagnosticContractPass: true,
      tscZeroErrors: true,
      bloc3TestsPass: true,
      phaseETestsPass: true,
      fullSuitePass: true,
      buildPass: true,
      adversarialReviewPass: true,
      sharedRouteIsolationProven: true,
    });
    expect(r.verdict).toBe("V0_CONVERSION_ENGINE_CODE_READY_EXTERNAL_ACTIVATION_REQUIRED");
    expect(r.failed_checks.length).toBe(0);
  });

  it("preuves partielles → première FAIL détermine le verdict", () => {
    const r = buildB3ConversionVerdict({
      fixtureFingerprintMatches: true,
      parityWithFixture: true,
      tokenVectorsPass: true,
      storageFailsClosedInProd: false, // FAIL ici
      checkoutRouteBridged: true,
    });
    expect(r.verdict).toBe("V0_CONVERSION_ENGINE_BLOCKED_STORAGE_NOT_FAIL_CLOSED");
  });

  it("claims audit présent dans le rapport", () => {
    const r = buildB3ConversionVerdict();
    expect(r.claims_audit.total).toBe(8);
    expect(r.claims_audit.pendingProductIds.length).toBeGreaterThanOrEqual(5);
  });

  it("blocking_external listé même quand verdict = CODE_READY", () => {
    const r = buildB3ConversionVerdict({
      fixtureFingerprintMatches: true, parityWithFixture: true, tokenVectorsPass: true,
      storageFailsClosedInProd: true, checkoutRouteBridged: true, webhookRouteBridged: true,
      tenancyAttachWired: true, surfaceEventsWired: true, demoContractPass: true,
      diagnosticContractPass: true, tscZeroErrors: true, bloc3TestsPass: true,
      phaseETestsPass: true, fullSuitePass: true, buildPass: true,
      adversarialReviewPass: true, sharedRouteIsolationProven: true,
    });
    expect(r.blocking_external.length).toBeGreaterThan(0);
    expect(r.blocking_external.some((b) => b.includes("Stripe live"))).toBe(true);
  });
});
