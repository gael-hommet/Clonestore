import { describe, it, expect, beforeEach } from "vitest";
import {
  computeAttributionSignature,
  issueAttributionToken,
  parseAttributionToken,
  tokenFingerprint,
  verifyAttributionToken,
} from "../attribution-token";

const VALID_TOKEN_ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("BLOC 3 — attribution token", () => {
  beforeEach(() => {
    // En dev/test, fallback secret intégré. On le rend déterministe.
    delete process.env.CLONESTORE_CONVERSION_ATTRIBUTION_SECRET;
    delete process.env.CLONESTORE_FOUNDER_RESERVATION_COOKIE_SECRET;
  });

  it("issueAttributionToken produit un token signé vérifiable", () => {
    const token = issueAttributionToken(VALID_TOKEN_ID, 1);
    expect(token).not.toBeNull();
    const verification = verifyAttributionToken(token!);
    expect(verification.ok).toBe(true);
    expect(verification.tokenId).toBe(VALID_TOKEN_ID);
    expect(verification.keyVersion).toBe(1);
  });

  it("refuse une signature modifiée (timing-safe)", () => {
    const token = issueAttributionToken(VALID_TOKEN_ID, 1)!;
    // On flip le dernier caractère significatif de la signature.
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    const verification = verifyAttributionToken(tampered);
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe("signature_mismatch");
    expect(verification.tokenId).toBeNull();
  });

  it("refuse un token de forme invalide", () => {
    expect(verifyAttributionToken("not-a-token").ok).toBe(false);
    expect(verifyAttributionToken("v1.short.sig").ok).toBe(false);
    expect(verifyAttributionToken("").ok).toBe(false);
    expect(verifyAttributionToken(null as unknown as string).ok).toBe(false);
    expect(verifyAttributionToken(undefined as unknown as string).ok).toBe(false);
  });

  it("refuse un keyVersion incorrect (signature ne reconstruit pas)", () => {
    const token = issueAttributionToken(VALID_TOKEN_ID, 1)!;
    const parts = token.split(".");
    const forged = `v2.${parts[1]}.${parts[2]}`;
    const verification = verifyAttributionToken(forged);
    expect(verification.ok).toBe(false);
  });

  it("parse renvoie null sur formats hors gabarit", () => {
    expect(parseAttributionToken("v1." + "x".repeat(31) + ".sig123")).toBeNull(); // tokenId 31 hex
    expect(parseAttributionToken("v0." + VALID_TOKEN_ID + ".aaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
    expect(parseAttributionToken("v1." + VALID_TOKEN_ID + ".!!@@##")).toBeNull(); // sig non base64url
  });

  it("computeAttributionSignature stable", () => {
    const a = computeAttributionSignature(VALID_TOKEN_ID, 1);
    const b = computeAttributionSignature(VALID_TOKEN_ID, 1);
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });

  it("computeAttributionSignature change avec keyVersion", () => {
    const a = computeAttributionSignature(VALID_TOKEN_ID, 1);
    const b = computeAttributionSignature(VALID_TOKEN_ID, 2);
    expect(a).not.toBe(b);
  });

  it("fingerprint SHA-256 stable et dépendant de keyVersion+tokenId", () => {
    const fp1 = tokenFingerprint(VALID_TOKEN_ID, 1);
    const fp2 = tokenFingerprint(VALID_TOKEN_ID, 1);
    const fp3 = tokenFingerprint(VALID_TOKEN_ID, 2);
    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("en production, aucun secret = pas de signature calculée", () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      // @ts-expect-error — assignation pour test
      process.env.NODE_ENV = "production";
      const sig = computeAttributionSignature(VALID_TOKEN_ID, 1);
      expect(sig).toBeNull();
      const verification = verifyAttributionToken(`v1.${VALID_TOKEN_ID}.aaaaaaaaaaaaaaaaaaaaaaaa`);
      expect(verification.ok).toBe(false);
      expect(verification.reason).toBe("secret_missing");
    } finally {
      // @ts-expect-error — restauration
      process.env.NODE_ENV = prevEnv;
    }
  });
});
