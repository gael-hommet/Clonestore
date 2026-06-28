// ONBOARDING SEAMLESS — décision d'auth (pure) + jeton de statut (signé). Unitaire.
import { describe, it, expect } from "vitest";

process.env.CLONESTORY_LOCAL_MODE = "1";

import { decideAuthAction } from "../auth-onboarding";
import { buildStatusToken, readStatusToken } from "../session";
import { randomUUID } from "node:crypto";

describe("decideAuthAction", () => {
  it("aucune session → mint", () => {
    expect(decideAuthAction("a@x.test", null)).toBe("mint");
    expect(decideAuthAction("a@x.test", "")).toBe("mint");
  });
  it("même adresse connectée → reuse (insensible à la casse / espaces)", () => {
    expect(decideAuthAction("a@x.test", "a@x.test")).toBe("reuse");
    expect(decideAuthAction("A@X.TEST", "a@x.test")).toBe("reuse");
    expect(decideAuthAction(" a@x.test ", "a@x.test")).toBe("reuse");
  });
  it("AUTRE adresse connectée → conflict (jamais de liaison auto)", () => {
    expect(decideAuthAction("a@x.test", "b@y.test")).toBe("conflict");
  });
});

describe("jeton de statut d'inscription (signé, opaque)", () => {
  it("aller-retour : on récupère le partnerId (UUID)", () => {
    const pid = randomUUID();
    const t = buildStatusToken(pid);
    expect(readStatusToken(t)).toBe(pid);
  });
  it("jeton falsifié / absent / non-UUID → null", () => {
    expect(readStatusToken("tampered.value")).toBeNull();
    expect(readStatusToken(null)).toBeNull();
    const t = buildStatusToken(randomUUID());
    expect(readStatusToken(t.slice(0, -4) + "AAAA")).toBeNull(); // HMAC altéré
  });
});
