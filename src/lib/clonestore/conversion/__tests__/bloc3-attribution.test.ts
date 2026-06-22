import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeAttributionSignature,
  issueAttributionToken,
  parseAttributionToken,
  safeProspectToken,
  tokenFingerprint,
  verifyAttributionToken,
} from "../attribution-token";

const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "leadforge-contract-db9b166.json"), "utf8"),
) as {
  token_vectors: {
    fixture_secret_utf8: string;
    valid: { token_id: string; signature_hex: string; public_token: string; expected_valid: boolean };
    tampered_signature: { public_token: string; expected_valid: boolean; expected_reason: string };
    tampered_token_id: { public_token: string; expected_valid: boolean; expected_reason: string };
    malformed_no_dot: { public_token: string; expected_valid: boolean; expected_reason: string };
    malformed_empty: { public_token: string; expected_valid: boolean; expected_reason: string };
  };
};

const SECRET = FIXTURE.token_vectors.fixture_secret_utf8;

describe("BLOC 3 — attribution token (compat Python LeadForge db9b166)", () => {
  beforeEach(() => {
    delete process.env.LEADFORGE_ATTRIBUTION_SIGNING_KEY;
  });

  it("test vector valide produit par Python LeadForge → accepté par TS CloneStore", () => {
    const v = FIXTURE.token_vectors.valid;
    const verification = verifyAttributionToken(v.public_token, { secret: SECRET });
    expect(verification.ok).toBe(true);
    expect(verification.tokenId).toBe(v.token_id);
    expect(verification.reason).toBe("ok");
  });

  it("compute signature TS = signature Python (HMAC-SHA256 hex)", () => {
    const v = FIXTURE.token_vectors.valid;
    const sig = computeAttributionSignature(v.token_id, SECRET);
    expect(sig).toBe(v.signature_hex);
  });

  it("test vector signature modifiée → refusé en temps constant", () => {
    const v = FIXTURE.token_vectors.tampered_signature;
    const verification = verifyAttributionToken(v.public_token, { secret: SECRET });
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe("bad_signature");
  });

  it("test vector token_id modifié → refusé", () => {
    const v = FIXTURE.token_vectors.tampered_token_id;
    const verification = verifyAttributionToken(v.public_token, { secret: SECRET });
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe("bad_signature");
  });

  it("test vector malformed (pas de point / vide) → refusé", () => {
    for (const v of [FIXTURE.token_vectors.malformed_no_dot, FIXTURE.token_vectors.malformed_empty]) {
      const verification = verifyAttributionToken(v.public_token, { secret: SECRET });
      expect(verification.ok).toBe(false);
      expect(verification.reason).toBe("malformed");
    }
  });

  it("mauvais secret → refusé", () => {
    const v = FIXTURE.token_vectors.valid;
    const verification = verifyAttributionToken(v.public_token, { secret: "another-secret" });
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe("bad_signature");
  });

  it("secret manquant en production → secret_missing", () => {
    const prev = process.env.NODE_ENV;
    try {
      // @ts-expect-error — test override
      process.env.NODE_ENV = "production";
      const verification = verifyAttributionToken(FIXTURE.token_vectors.valid.public_token);
      expect(verification.ok).toBe(false);
      expect(verification.reason).toBe("secret_missing");
    } finally {
      // @ts-expect-error — restore
      process.env.NODE_ENV = prev;
    }
  });

  it("parseAttributionToken rejette tout sauf 40 hex + 64 hex", () => {
    expect(parseAttributionToken("not.a.token")).toBeNull();
    expect(parseAttributionToken("abcd.ef")).toBeNull();
    expect(parseAttributionToken("g".repeat(40) + "." + "0".repeat(64))).toBeNull(); // g non-hex
    expect(parseAttributionToken("0".repeat(40) + "." + "0".repeat(64))).toEqual({
      tokenId: "0".repeat(40),
      signatureHex: "0".repeat(64),
    });
  });

  it("tokenFingerprint stable et dépendant du token_id", () => {
    const fp1 = tokenFingerprint("a".repeat(40));
    const fp2 = tokenFingerprint("a".repeat(40));
    const fp3 = tokenFingerprint("b".repeat(40));
    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("issueAttributionToken roundtrip", () => {
    const token = issueAttributionToken("a".repeat(40), { secret: SECRET });
    expect(token).not.toBeNull();
    expect(verifyAttributionToken(token!, { secret: SECRET }).ok).toBe(true);
  });

  it("safeProspectToken réduit au token_id, refuse les emails", () => {
    const v = FIXTURE.token_vectors.valid;
    expect(safeProspectToken(v.public_token)).toBe(v.token_id);
    expect(safeProspectToken("leak@example.com")).toBe("");
    expect(safeProspectToken("")).toBe("");
    expect(safeProspectToken(v.token_id)).toBe(v.token_id);
  });
});
