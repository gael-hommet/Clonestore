// CloneStory — token de vérification STATELESS (unitaire).

import { describe, it, expect } from "vitest";

process.env.CLONESTORY_LOCAL_MODE = "1"; // secret HMAC de dev

import { buildVerificationToken, parseVerificationToken, isVerificationTokenExpired } from "../verification-token";

const PID = "3f1a9c2e-1b4d-4c8a-9e2f-7a6b5c4d3e2f";
const EXP = 1893456000000;

describe("verification token stateless", () => {
  it("déterministe : mêmes (partnerId, generation, exp) → MÊME token (retry technique)", () => {
    expect(buildVerificationToken(PID, 1, EXP)).toBe(buildVerificationToken(PID, 1, EXP));
  });

  it("génération différente → token différent", () => {
    expect(buildVerificationToken(PID, 1, EXP)).not.toBe(buildVerificationToken(PID, 2, EXP));
  });

  it("round-trip parse (partnerId, generation, exp)", () => {
    const t = buildVerificationToken(PID, 3, EXP);
    expect(parseVerificationToken(t)).toEqual({ partnerId: PID, generation: 3, expMs: EXP });
  });

  it("token falsifié / malformé / absent → null", () => {
    const t = buildVerificationToken(PID, 1, EXP);
    expect(parseVerificationToken(t.slice(0, -4) + "AAAA")).toBeNull(); // HMAC altéré
    expect(parseVerificationToken("csyv1.x.y")).toBeNull();
    expect(parseVerificationToken("nope")).toBeNull();
    expect(parseVerificationToken(null)).toBeNull();
  });

  it("expiration détectée", () => {
    expect(isVerificationTokenExpired(1000, 2000)).toBe(true);
    expect(isVerificationTokenExpired(5000, 2000)).toBe(false);
  });
});
